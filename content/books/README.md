# SchoolSpec mini books — the format

One file per book: `content/books/<level>-<subject>.md`. Committed = published at
`/textbooks/<level>/<subject>`. Nothing touches the database.

Levels: `creche nursery1 nursery2 kg1 kg2 b1 b2 b3 b4 b5 b6 b7 b8 b9`
Subjects: `maths english science social computing`

## Front matter

```
---
title: Counting to Ten
subject: maths
level: kg1
topic: Numbers 1 to 10
description: One sentence a parent would read on the shelf.
color: #1F6F78
---
```

`color` is the cover/spine colour. Use the subject colour:
maths `#1F6F78` · english `#8A3B12` · science `#2E6B3A` · social `#8a6b12` · computing `#12608a`.

## Pages

Pages are separated by a line that is exactly `===`. The cover is generated;
do not write it. A page is Markdown (headings `##`/`###`, paragraphs, lists,
**bold**, blockquotes) plus these directives, each on its own line:

```
@image <url> | <caption> | <credit: author · licence> | <source page url>
@video <youtubeId> | <video title> | <channel name>
```

Rules for a page: one idea, 60–220 words (Creche/Nursery/KG: 10–60 words, big
idea, a picture most pages). A page must fit a phone screen without feeling
crowded. Start most pages with a `##` heading.

## Media

* Images come from Wikimedia Commons only (free licences, hotlinking allowed).
  Use the direct `https://upload.wikimedia.org/...` URL from the API, never a
  page URL. Credit = `Artist · LicenseShortName` from the API's extmetadata,
  source = `https://commons.wikimedia.org/wiki/File:<name>`.
  If the artist is unknown, write `Wikimedia Commons contributor · <licence>`.
  Our own drawings: credit `SchoolSpec · own illustration`.
* Videos are YouTube. The reader plays them in place and labels them as the
  channel's work, not ours. Only use IDs you verified with
  `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`
  (200 = exists; its `title` and `author_name` are the credit).
* 4–8 images and 2–4 videos per book, each on the page it illustrates.

## The last three pages, always, in this order

```
## Learn more
- [Title](https://...) — one line on what it is
...
===
## Watch more
@video ...
@video ...
===
## Think about it
1. ...
2. ...   (3–6 questions, no answers)
```
