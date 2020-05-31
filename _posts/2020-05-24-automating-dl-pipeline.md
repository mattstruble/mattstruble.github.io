---
title: Automating Deep Learning Pipeline With NAS
tags: [Automation, Bash, NAS]
style: border
color: info
description: How I leveraged Synology NAS to automate the execution, and backup, of my machine learning model training environments. 
---

The past few days I've been working on improving my machine learning pipeline in preparation of some upcoming projects. I wanted to create a system that would allow me to easily train a model 
from any thin client, while also preserving a history of work done on a per-project basis. 

## The Goal 

I had three main goals in mind for my automated pipeline:
1. I wanted to be able to dynamically configure settings on a per-run basis, settings like:
* Which server to execute the training on
* How long to let the training session run for
* How frequently to back up the checkpoint directory
* What tensorflow version and conda environment to use. 
2. Next, I wanted to be able to start training from any device.
3. Lastly, I wanted to backup everything that went into each run. 
* This way I would be able to reproduce the exact same results.

## The Solution

Enter Synology NAS. The pure functionality of a NAS is to provide redundant high-capacity storage on a Linux OS, which conveniently allows the execution of custom bash scripts. 
This allowed me to write a series of scripts, each of which satisfied one of the goals above. 

#### 1. Dynamically Configuring Settings
 
The first of the goals I tackled above was finding a way to easily change run settings on the fly, allowing my scripts dynamically change on a per-project basis. 
I determined early on that this would require a both a global config, as well as project-specific configs. The end result involved creating a volume on my NAS and setting up the following file structure:

```
deeplearning/
|-- auto_runner.config
|-- auto_runner.sh
|-- example_proj/
    |-- example_proj.config
    |-- bin
``` 

The global auto_runner config contains the overarching control settings of training timeout, backup timing,  server information, and the target project directory:

```bash 
#!/bin/bash
# auto_runner.config
target_proj=example_proj

timeout=2h

backup_every_h=0
backup_every_m=30
backup_every_s=0

dl_user=user
dl_host=server

working_dir=$1
source ${working_dir}/${target_proj}/${target_proj}.config
```

While each project config contains specific environmental and runtime information:

```bash 
#!/bin/bash 
# example_proj.config
tensorflow_version=tensorflow-1.13
conda_env=tensorflow-1.13
run_script=run.sh
output_dir=output
```

By structuring it this way any script can source `auto_runner.config` and automatically get all the information it needs for the current run that's being executed. 

I'm sure you noticed that `auto_runner.config` takes in a command line argument to set the `working_dir` of the project. This came up due to the differences of trying to run the autmated scripts from
a network mounted drive on my computer, versus trying to run them from within the NAS itself. Synology provides a way for a user to define custom scripts, but they require the full working path in order to target each script,
where running the scripts locally has the benefit of starting from the deep learning directory. By passing in the working dir it allows supporting scripts to be written for each use case:

```bash 
#!/bin/bash
# server_runner.sh

working_dir="/xxx/xxx/deeplearning"
bash ${working_dir}/auto_runner.sh ${working_dir}
```

```bash 
#!/bin/bash
# local_runner.sh

working_dir=$(pwd)
${working_dir}/auto_runner.sh ${working_dir}
```

This inheritance structure allows for easy  reuse of `auto_runner.sh` for any system environment. 

#### 2. Starting and Storing A Run From Anywhere 

The config files naturally cascade into the next goal I conquered of starting the runs from anywhere, and was teased in the previous section when talking about the argument passed
into `auto_runner.config`. 

```bash 
#!/bin/bash
working_dir=$1

export PATH="${working_dir}/scripts:$PATH"

source ${working_dir}/auto_runner.config ${working_dir}

results_dir=${working_dir}/${target_proj}/results
bin_dir=${working_dir}/${target_proj}/bin

mkdir -p ${results_dir}
```

The first thing `auto_runner.sh` does is source the configuration file talked about in the previous section, using the information within to set up the results directory and to isolate the bin directory. 

```bash 
# Check if server is available before continuing with anything. 
count=0
while ! ping -c 1 -W 1 ${dl_host}; do
	count=$((${count}+1))
	if [ $count -gt 4 ]; then 
		echo "Failed to connect to ${dl_host} more than 4 times. Terminating."
		exit 1
	fi
	
	sleep 60s
done 

echo "Connected to ${dl_host}..."

# Cancel any pending shutdown that would interfere with the upcoming run
ssh ${dl_user}@${dl_host} "sudo /sbin/shutdown -c"
```

The next important step is to make sure that the server is available, by iterating over a simple loop/sleep cycle. This is due to my personal deep learning machine sometimes taking a few minutes to connect
to the network when it's first turned on, so I needed to wait in case the script was started while the server was still standing itself up. 

```bash 
# Generate results directory, and populate with the current run_X folder
mkdir -p ${results_dir}

run_num=$(ls ${results_dir} | wc -l)
run_name=run_${run_num}

export curr_run_dir=${results_dir}/${run_name}

mkdir -p ${curr_run_dir}

# Tar and gz bin and store it in current run 
tar -zcf ${curr_run_dir}/bin.tar.gz ${bin_dir} &

# Make a folder on the server named the same as the current run and populate it with the bin contents. 
ssh ${dl_user}@${dl_host} "mkdir ${run_name}" >> ${curr_run_dir}/log.log 2>&1

echo "Exporting ${bin_dir} to server.."

scp -rq ${bin_dir}/* ${dl_user}@${dl_host}:${run_name}
```

The next step is to create a folder within results to store all the run information. I simply chose to number it based on the previous runs within the folder, creating a simple structure of numbered runs. 
It is within this folder that the current project bin is zipped up and stored, prior to being exported to the deep learning server. By backing up the bin contents prior to starting the run it ensures that all
the requirements for the run can easily be replicated. 

```bash 
echo "Executing ${dl_user}@${dl_host}:${run_name}/${run_script} and starting automatic backups.."
# Kick off runner and backup scripts with a timeout to auto-kill
bash ${working_dir}/scripts/runner.sh ${working_dir} ${timeout} ${run_name}

# Clean up server
ssh ${dl_user}@${dl_host} "rm -rf ${run_name}"

# Schedule shutdown in 1 hour
ssh ${dl_user}@${dl_host} "sudo /sbin/shutdown -P +60" 
```

Lastly an external script is called which handles all of the logic of backing up the run information, and waiting for the actual training to complete or timeout. Once the supporting run script
has finished executing `auto_runner.sh` cleans up the files on the server and initiates a shutdown with a delay of 1hr. The 1hr delay allows for any immediate subsequent runs, while also allowing any
long overnight runs to properly shutdown the server and conserve power/money. 

#### 3. Backing Run Output 
 
 Finally, now that all the supporting framework is in place comes the most important part: storing output and information regarding the run. I wanted to be able to reference the
 Tensorflow console output, maintain periodic backups of checkpoints to fallback on for faster retraining, as well as maintain meta data about the run for client billing. All of this is handled
 within `runner.sh`, which is called from `auto_runner.sh`. 
 
 ```bash 
#!bin/bash
# runner.sh

working_dir=$1
timeout=$2
run_name=$3

# Load run config
source ${working_dir}/auto_runner.config ${working_dir}

# Store start times
echo "start_time|$(date)" >> ${curr_run_dir}/run.info
echo "start_epoch|$(date +%s)" >> ${curr_run_dir}/run.info

# Start recurring backup
bash backup.sh ${working_dir} ${run_name} &
backup_pid=$!

# Start remote training
timeout ${timeout} ssh ${dl_user}@${dl_host} "chmod u+x ${run_name}/${run_script}; source ./activate_env.sh ${tensorflow_version} ${conda_env} && cd ${run_name} && source /usr/share/anaconda3/bin/activate ${conda_env} && ./${run_script}" >> ${curr_run_dir}/log.log 2>&1

kill ${backup_pid}

# Kill the learning process on the server 
ssh ${dl_user}@${dl_host} "kill `pgrep python`"

# Copy any remaining output files over
scp -rq ${dl_user}@${dl_host}:${run_name}/${output_dir}/* ${curr_run_dir}/output/

# Store end times
echo "end_time|$(date)" >> ${curr_run_dir}/run.info
echo "end_epoch|$(date +%s)" >> ${curr_run_dir}/run.info
```

The runner script is rather short, but manages to pull a lot of weight. The first thing the script does, after reading in the command line arguments, is to record the start time, followed by initiating the automatic checkpoint backups. 
The automatic checkpoint backups uses the user-defined timeout to periodically copy the output folder contents into the NAS run location:

```bash 
#!bin/bash
#backup.sh

working_dir=$1
run_name=$2
source ${working_dir}/auto_runner.config $1
wait_seconds=$((${backup_every_h}*60*60+${backup_every_m}*60+${backup_every_s}))

mkdir -p ${curr_run_dir}/output

while : 
do 
	sleep ${wait_seconds}s 
	echo "Copying files from ${dl_user}@${dl_host}:${run_name}/${output_dir}/* to ${curr_run_dir}/output/"
	scp -rq ${dl_user}@${dl_host}:${run_name}/${output_dir}/* ${curr_run_dir}/output/
done
```

While `backup.sh` is running in the background, `runner.sh` passes a long command to the server over ssh, which:
1. Allows the execution of the project defined run script.
2. Sets the working PATH to include the correct Tensorflow and Conda environments.
3. Activates the conda environment.
4. Starts the run script. 

Since the run script continues to run until the training is over, the output can be piped back across into the runs log.log file on the NAS machine. The call to `timeout ${timeout} ssh ...` ensures that the training
session doesn't exceed the user-defined timeout period, killing the ssh session which also kills the run on the server. 

When the training finishes, or times out, the backup script is killed and the final output file is copied over to storage and the end time is stored in the info file. 

## The Results

After execution of `auto_runner.sh` is completed the deep learning directory tree is now: 

```
deeplearning/
|-- auto_runner.config
|-- auto_runner.sh
|-- example_proj/
    |-- example_proj.config
    |-- bin
    |-- results
        |-- run_0
            |-- run.info
            |-- log.log
            |-- bin.tar.gz
            |-- output/
                |-- checkpoint
                |-- graph.pbtxt
                |-- events.out.tfevents.[..]
                |-- model.ckpt-x.data-yyyyy-of-zzzzz
                |-- model.ckpt-x.index
                |-- model.ckpt-x.meta
                |-- ...
``` 

This meets all the requirements going into this project. The training can be started from anywhere, all of the output is stored, and settings can be dynamically changed per run. 
Best of all the NAS handles all the scripting logic, which means that any thin client that connects to kick things off can safely disconnect in the middle of a run without stopping the run. 

Now with any new project I can easily reference previous runs from anywhere in the world, allowing for rapid model iteration and quicker turnaround times.  