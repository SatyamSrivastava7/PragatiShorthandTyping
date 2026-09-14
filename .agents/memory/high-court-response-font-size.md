---
name: High Court response font size
description: Keep response font sizing consistent across High Court Typing, Pitman, and Shorthand tests.
---

The High Court response font-size control must apply to the response area in all three modes. Typing uses the rich editor, so its external font-size control must stay synchronized with the editor toolbar; Pitman and Shorthand apply the size directly to their textareas.

**Why:** The original control only changed the question paper in Typing and was absent from Pitman and Shorthand responses.

**How to apply:** Keep the shared response font size in the workspace state, bind it to textarea styles, and expose controlled font-size props when embedding RichTextEditor.