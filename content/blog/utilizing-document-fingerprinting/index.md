---
comments: true
date: "2020-04-16T00:00:00Z"
description: Using plagiarism detection algorithms to track the phrases my friends
  use in group chats.
tags:
- Python
- Template Matching
- Hashing
title: Utilizing Document Fingerprinting for Variable String Matching
---

A question was posted in a group chat: how many times does my one friend say the phrase “gamers in chat”? At the time I was beginning to dabble with the Discord API, so I took it upon myself to figure out the actual count. The algorithm can be seen in action within my [Discord GamerBot](https://github.com/mattstruble/gamer-bot).

## The Problem

User submitted text, especially in a group chat, is variable, prone to spelling mistakes, and all-around unreliable data. A simple string compare will only catch an exact match, missing any of the following potential variations: “gamer in the chat”, “gamers int he chat” , “gamers in this chat?”, “gamers get in chat”.

A couple of naïve approaches would be try to keep a list of the most common similar phrases and combine the counts, or to split the words up and look for them individually in the string. Both run the risk of quickly becoming difficult to manage and neither solves the issue of spelling mistakes.

## Research

The time I was researching a solution to the problem just so happened to coincide with final assignments being due in many colleges, so my social media was overwhelmed with jokes about the automatic plagiarism detectors. Automatic plagiarism detectors can isolate substrings from an entire document and match it back to the source material, even if the match is not a one-to-one match.

Plagiarism detectors each use a form of document fingerprinting, the specific algorithm I used is a variation of [Winnowing: Local Algorithms for Document Fingerprinting](https://theory.stanford.edu/~aiken/publications/papers/sigmod03.pdf), my implementation can be seen in [sigmod-fingerprinting](https://github.com/mattstruble/sigmod-fingerprinting). First the input string is sanitized to remove URLs and any remaining non-alphanumeric characters, next contiguous substrings of length k are generated. These k-grams are then hashed and processed by a moving window of size n, guaranteeing at least every n hash is chosen, creating a set of “fingerprints” for the provided string.

Given the nature of the k-grams having overlap with each other, the [Rabin-Karp algorithm](https://courses.csail.mit.edu/6.006/spring11/rec/rec06.pdf) was used for quick hashing by allowing each subsequent k-gram to use the previous hash when generating its own. Similarly, the windows have overlap, allowing subsequent windows to only look at their last index, so long as the previously selected index is in range of the current window.

Below outlines some examples using the target phrase “gamers in chat”:

##### k-gram = 5, window = 2

```
kgrams ['gamer', 'amers', 'mersi', 'ersin', 'rsinc', 'sinch', 'incha', 'nchat']
windows [['gamer', 'amers'], ['amers', 'mersi'], ['mersi', 'ersin'], ['ersin', 'rsinc'], ['rsinc', 'sinch'], ['sinch', 'incha'], ['incha', 'nchat']]
fingerprints [[674605035, 1], [3187479848, 3], [11292792147, 4], [5664108189, 6]]
```

##### k-gram = 2, window = 4

```
kgrams ['ga', 'am', 'me', 'er', 'rs', 'si', 'in', 'nc', 'ch', 'ha', 'at']
windows [['ga', 'am', 'me', 'er'], ['am', 'me', 'er', 'rs'], ['me', 'er', 'rs', 'si'], ['er', 'rs', 'si', 'in'], ['rs', 'si', 'in', 'nc'], ['si', 'in', 'nc', 'ch'], ['in', 'nc', 'ch', 'ha'], ['nc', 'ch', 'ha', 'at']]
fingerprints [[171, 1], [808, 3], [1436, 6], [482, 8], [178, 10]]
```

##### k-gram = 4, window = 4

```
kgrams ['game', 'amer', 'mers', 'ersi', 'rsin', 'sinc', 'inch', 'ncha', 'chat']
windows [['game', 'amer', 'mers', 'ersi'], ['amer', 'mers', 'ersi', 'rsin'], ['mers', 'ersi', 'rsin', 'sinc'], ['ersi', 'rsin', 'sinc', 'inch'], ['rsin', 'sinc', 'inch', 'ncha'], ['sinc', 'inch', 'ncha', 'chat']]
fingerprints [[4269652, 1], [20173923, 3], [35848786, 6], [12032826, 8]]
```

Both the k-gram, and window length, determine how frequently in the string you want to generate a hashed fingerprint. If k-gram is too small then it loses perspective of the individual words, but if it is too large then smaller words get wrapped up into each other. Similarly, if the window length is too small then you lose the ability to filter out irrelevant k-grams, but if it is too large then some information can be lost.

In the end I found that using the average word length in the target string provided a fair middle ground for both the k-gram length and window length. This way a decent chunk of each word is preserved in hashing, allowing for more reliable matching, and a decent chunk of k-gram are skipped during windowing. In the above examples this is shown when both k-gram and window length are 4.

## My Solution

Now that I have found a way to determine fingerprints of similar strings, it is time to move on to searching “gamers in chat” within any user provided string. At first, I naively assumed that by checking if the user string fingerprints contained the phrase fingerprints then that guaranteed a match. Unfortunately, this ignored the order of the phrase’s fingerprints, allowing any string that happened to have coinciding fingerprints to match, e.g.
"In a few minutes I'm going to join voice chat, does anyone want to play a game?"

In order to resolve this I developed a form of template matching which required the fingerprints to go in order, but also has lenience in terms of which phrase fingerprint can start, or stop, the template as well as how many non-matching fingerprints can exist in between and the percentage matched fingerprints required.

I start out by utilizing [numpy](https://numpy.org/) to search through the user's source hashes to find the indexes that match the hashes in the phrase's template.
This way I know exactly where each part of the hash is located within the user's string, via a dictionary lookup to an array of indices.

```python
template_locs = {}
for t_hash in template_hashes:
    template_locs[t_hash] = np.where(np.array(source_hashes) == t_hash)[0]
```

Next I define some arrays to store variables, like which indices have already been checked, and define the starting hashes of the template.
I define the hashes that can "start" the template to the first fourth of the template hashes, since anything past that most likely does not contain the full range of words we're searching for.

```python
checked_idxs = []
matched_ranges = []
template_len = len(template_hashes)
template_start_size = math.ceil(template_len/4)
```

Lastly, for each starting hash we iterate over each source indices associated with it, making sure not to consider any index that may have been already been marked.
Starting from the starting hash index, the algorithm looks at any subsequent hash and counts matching hashes that follow the order of the template. After all the matches are counted, if the percent matched meets the `match_percent` criteria, and the total
counted hashes is at least the template size then the range is considered a match.

```python
for i in range(template_start_size): # only first fourth of template can "start" the template
        start_idxs = template_locs[template_hashes[i]]
        for start_idx in start_idxs: # Try to find a template match for each starting index
            if start_idx in checked_idxs:
                continue # don't recount already counted starts

            matched = 0
            counted = 0
            template_idx = i
            # Look for matching hashes starting from the start index, extend search range to allow for filler values
            for j in range(start_idx, min(len(source_hashes), start_idx + int(template_len * 1.8))):
                # only match if not already seen and only if comes after the current value in the template
                if source_hashes[j] in template_hashes[template_idx:] and j not in checked_idxs:
                    # update template index to force progression through the template instead of allowing multiple loops
                    template_idx = template_hashes.index(source_hashes[j], template_idx, len(template_hashes))
                    matched += 1

                counted += 1

                if source_hashes[j] == template_hashes[-1] or (source_hashes[j] == template_hashes[i] and j != start_idx):
                    break # early break for hitting end of template, or hitting another of the same start

                checked_idxs.append(j)

            # only record if percent matched is >= than match_percent, and number of counted >= template_len.
            if matched / counted >= match_percent and counted >= template_len:
                matched_ranges.append(range(start_idx, j+1))

return matched_ranges
```

The algorithm avoids false positives by requiring the matched count to be at least the size of the template, so that the matched percent calculation isn't thrown off by substrings. Similarly
false negatives are avoided by extending the search by 80% of the template length, allowing for a small amount of fluff to exist between matched hashes.

## Results

After putting the above code into production, I can confidently say that my friend has said a variation of "gamers in chat" 26 times.

However, it isn't perfect. Even with all my attempts to limit false positives, a few still slipped through.
Out of 42,000 messages, the algorithm found 32 matching "gamers in chat", including the variations listed in the problem statement, however 4 of the matches were false positives.
That means on average the algorithm, albeit with its small sample size, has an accuracy 87.5%, which seems pretty decent for a simple language processor.

## Full Template Matching Source

Full integration with the discord app can be seen in the [GamerBot](https://github.com/mattstruble/gamer-bot) repository.

```python
import numpy as np
import math

def template_match_hashes(template_hashes, source_hashes, match_percent=0.6):
    """
    Takes in array of template fingerprint hashes, and an array of hashes to search through. Looks through the search
    array for the template, and registers a match so long as the percent of matches exceeds the provided match_percent.

    i.e:
    template = [171, 808]
    source = [1442, 2938, 1107, 171, 808, 2780, 3169, 1435]
    return = [range(3, 5)]

    template = [171, 808, 2863, 2938, 1436, 2148, 482, 178]
    source = [1279, 2393, 3570, 2055, 172, 2237, 3886, 1107, 171, 808, 2863, 2938, 176, 726, 1436, 2148, 3168, 1269, 726,
              482, 178, 3096, 337, 3096, 170, 1915, 2306, 1279, 2393, 3570, 2055, 172, 2237, 3886, 1107, 171, 808, 2863,
              2938, 176, 726, 1436, 2148, 3168, 1273, 1441, 2938, 482, 178, 3096, 2853, 1429, 1114, 1284, 3096, 2227]
    return = [range(8, 22), range(35, 49)]

    template = [171, 808, 2863, 2938, 1436, 2148, 482, 178]
    source = [1436, 2148, 1107, 171, 726, 1107, 171, 808, 2863, 2938, 1436, 2148, 482, 178]
    return = [range(6, 15)]

    :param template_prints: Searched template.
    :param source_prints: Array where the search is running.
    :param match_percent: Percent of acceptance for template to match.
    :return: Array of ranges that match the provided template in the source.
    """
    # Store source indexes each template hash
    template_locs = {}
    for t_hash in template_hashes:
        template_locs[t_hash] = np.where(np.array(source_hashes) == t_hash)[0]

    checked_idxs = []
    matched_ranges = []
    template_len = len(template_hashes)
    template_start_size = math.ceil(template_len/4)
    for i in range(template_start_size): # only first fourth of template can "start" the template
        start_idxs = template_locs[template_hashes[i]]
        for start_idx in start_idxs: # Try to find a template match for each starting index
            if start_idx in checked_idxs:
                continue # don't recount already counted starts

            matched = 0
            counted = 0
            template_idx = i
            # Look for matching hashes starting from the start index, extend search range to allow for filler values
            for j in range(start_idx, min(len(source_hashes), start_idx + int(template_len * 1.8))):
                # only match if not already seen and only if comes after the current value in the template
                if source_hashes[j] in template_hashes[template_idx:] and j not in checked_idxs:
                    # update template index to force progression through the template instead of allowing multiple loops
                    template_idx = template_hashes.index(source_hashes[j], template_idx, len(template_hashes))
                    matched += 1

                counted += 1

                if source_hashes[j] == template_hashes[-1] or (source_hashes[j] == template_hashes[i] and j != start_idx):
                    break # early break for hitting end of template, or hitting another of the same start

                checked_idxs.append(j)

            # only record if both the percent matched and number of counted is greater than match_percent.
            if matched / counted >= match_percent and counted >= template_len:
                matched_ranges.append(range(start_idx, j+1))

    return matched_ranges
```
