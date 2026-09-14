---
name: High Court typing workspace sizing
description: Preserve usable question-paper and response height in normal and full-screen High Court Typing tests.
---

The High Court Typing workspace is fixed to the viewport, so increasing one card alone reduces the other. Reclaim padding, gaps, and card chrome first, then adjust the question-paper share so both areas gain usable content height.

**Why:** Students need more visible text in both panels, but the test page must remain non-scrolling and stable in normal and full-screen modes.

**How to apply:** Keep the outer workspace `h-full`/full-screen fixed layout, use compact responsive spacing, and keep both panels `min-h-0` with independently scrollable content.