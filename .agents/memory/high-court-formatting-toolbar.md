---
name: High Court formatting toolbar
description: Preserve formatting controls in High Court typing tests while the student is typing.
---

High Court typing formatting controls must remain visible across responsive widths, and the rich-text toolbar must be a non-shrinking top section above the scrollable editor content.

**Why:** Students need formatting controls while entering the response; breakpoint-hidden controls and non-flex response wrappers can make the toolbar appear to vanish or collapse.

**How to apply:** Avoid `hidden md:flex` for typing formatting controls. Keep the editor toolbar shrink-resistant, visible above the response scroll area, and ensure every full-height wrapper uses a flex column layout.