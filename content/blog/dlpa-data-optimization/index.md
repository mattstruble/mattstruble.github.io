---
comments: true
date: "2020-12-17T00:00:00Z"
description: Optimizing image-based TFRecords to reduce storage space and improve
  training times.
series: dlpa
tags:
- ML
- Deep Learning
- Computer Vision
- Aesthetics
- TensorFlow
- TFRecord
title: Deep Learning Photo Aesthetics - Data Pipeline Optimization
---

In my [last post](https://struble.dev/blog/dlpa-data-preprocessing) I talked briefly about my data preparation pipeline and how I encoded the 200k images into TFRecords. As part of this step I first serialized an image into a tensor prior to storing it as a TFRecord. This method of first serializing the image as a tensor is a fairly common step in other tutorials that talk about TFRecord image preparation
[[1](https://towardsdatascience.com/working-with-tfrecords-and-tf-train-example-36d111b3ff4d), [2](https://medium.com/swlh/using-tfrecords-to-train-a-cnn-on-mnist-aec141d65e3d), [3](https://medium.com/ai-in-plain-english/a-quick-and-simple-guide-to-tfrecord-c421337a6562), [4](https://www.kaggle.com/ryanholbrook/tfrecords-basics)].

```python
# Previous encoding method of serializing the image
def create_example(image, score):
    image = cv2.imread(image_path)

    if image.shape[2] < 3: # Reshape BW photos to RGB
       image = cv2.cvtColor(image, cv2.COLORGRAY2RGB)

    image_data = tf.io.serialize_tensor(image)

    return Example(
        features=Features(
            feature={
                "image/encoded": Feature(bytes_list=BytesList(value=[image_data.numpy()])),
                "image/height": Feature(int64_list=Int64List(value=[image.shape[0]])),
                "image/width": Feature(int64_list=Int64List(value=[image.shape[1]])),
                "image/channels": Feature(int64_list=Int64List(value=[image.shape[2]])),
                "image/label": Feature(float_list=FloatList(value=[score]))
            }
        )
    )
```

Preparing the data this way created two major flaws. One flaw was that reading the data out of the TFRecord required additional computation to reshape the tensor back into an image. Second, the encoded TFRecords took up almost 3x the disk space as the raw image data, which when dealing with hundreds of thousands of images ended up being hundreds of gigabytes.

The extra computational complexity and large data size caused random slowdowns during training on simple CNNs and OOM errors on larger models.

Needing to change batch sizes and buffer sizes dependent on the model, and having training randomly crash halfway through was unacceptable. I didn’t want to deal with so much variability when researching models, especially when trying to compare the performance of different hyperparameters.

I needed a better solution which, at bare minimum, took up less memory.

## Optimizing TFRecords

After extensive Google searches I found my answer in this [Medium article](https://medium.com/coinmonks/storage-efficient-tfrecord-for-images-6dc322b81db4), which talked about the exact same frustrations I listed above. I followed Bruno’s advice and changed my TFRecord generation to save the JPEG bytes directly instead of transforming them into a tensor first.

```python
# Save the images as TFRecords
def create_example(image, score):
    image = cv2.imread(image_path)
    image = cv2.imencode('.jpg', image)[1].tostring()

    return Example(
        features=Features(
            feature={
                "image/image": Feature(bytes_list=BytesList(value=[tf.compat.as_bytes(image)])),
                "image/label": Feature(float_list=FloatList(value=[score]))
            }
        )
    )

# Process the TFRecords back into images as part of tf.data.TFRecordDataset().map(preprocess) pipeline
def preprocess(tfrecord):
    feature_descriptions = {
        "image/image": tf.io.FixedLenFeature([], tf.string, default_value=""),
        "image/label": tf.io.FixedLenFeature([], tf.float32, default_value=-1.)
    }

    example = tf.io.parse_single_example(tfrecord, feature_descriptions)

    # Automatically ensures image has 3 channels, replacing the need to manually convert B&W to RGB
    image = tf.image.decode_jpeg(example['image/image'], channels=3)

    # Standardize image for model input shape and expected value range of 0-1.
    image = tf.cast(image, tf.float32) * (1. / 255.)
    image = tf.image.resize(image, [224, 224])

    return image, example["image/label"]
```

My entire dataset including training, test, and validation data, took up less than 30GB of disk space after being regenerated using the above `create_example` function. That is almost 1/10th of the size it was previously, and almost half the size of the raw data itself.

The small size of the dataset enabled it to be cached entirely in RAM during training, preventing the need to read from disk every time a new image needed to be processed. This, combined with the smaller data in general, led to a 4x speed improvement on my training times. What previously would take 6 hours to train, now only took 1.5 hours.

By taking the time to sit down and analyze my data pipeline I not only removed the OOM crashes, but drastically improved performance which will reduce the time required for hyperparameter optimization.

{% include elements/signature.html %}
