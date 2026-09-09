---
name: Typing result display
description: Preserve uploaded formatting when showing English Typing source text in result analysis.
---

Admin result analysis must render stored HTML for English Typing original text instead of converting it to plain text and rebuilding paragraphs.

**Why:** The uploaded paper can contain justified alignment, font choices, spacing, headings, and inline formatting. Stripping the HTML makes the result view look left-aligned and unlike the paper the admin uploaded.

**How to apply:** Keep plain-text rendering for comparison/scoring and for content types that intentionally require it, but use the persisted HTML for the English Typing original-text display. Avoid inherited utility styles that override the uploaded document’s alignment.