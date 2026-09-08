---
name: High Court display sanitization
description: Rules for keeping High Court alignment results and exports free of editor-generated HTML artifacts.
---

Decode HTML entities before removing tags in the High Court scoring pipeline, and apply the same display sanitizer to saved alignment data before rendering it on screen or in PDFs.

**Why:** Rich-text and Word-generated content can contain escaped tags such as `&lt;o:p&gt;`. Stripping tags first lets those tags become visible comparison tokens after decoding, and previously saved attempts can still contain those artifacts.

**How to apply:** Keep paragraph/error semantics in the server alignment data for scoring, but hide paragraph markers and Word/HTML artifact tokens from user-facing comparison and PDF output. Reuse the client sanitizer for every High Court result presentation.