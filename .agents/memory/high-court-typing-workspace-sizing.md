---
name: High Court typing workspace sizing
description: Preserve usable question-paper and response height in normal and full-screen High Court Typing tests.
---

The High Court Typing workspace is fixed to the viewport, so increasing one card alone reduces the other. Reclaim padding, gaps, and card chrome first, then adjust the question-paper share so both areas gain usable content height. For phone-only adjustments, identify touch devices as well as narrow viewports so browser desktop mode is covered without changing desktop layouts.

**Why:** Students need more visible text in both panels, but the test page must remain non-scrolling and stable in normal and full-screen modes. A mobile browser requesting the desktop site can report a wide CSS viewport, while viewport-width-only rules could also alter a desktop window.

**How to apply:** Keep the outer workspace `h-full`/full-screen fixed layout, use compact responsive spacing, and keep both panels `min-h-0` with independently scrollable content. Scope phone-only overrides to touch/mobile media conditions and the Typing workspace; do not use viewport width alone, since narrow desktop windows should retain the desktop layout.