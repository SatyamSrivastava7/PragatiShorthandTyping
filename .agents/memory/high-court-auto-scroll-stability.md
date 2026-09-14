---
name: High Court auto-scroll stability
description: Prevent visible question-paper shaking during High Court Typing auto-scroll.
---

High Court Typing should reposition the active-word marker immediately when the marker changes. Do not use smooth scrolling there because the marker is rebuilt on each typed character and repeated smooth animations interrupt one another.

**Why:** The user-recorded High Court test showed the question paper visibly shivering while typing, while the regular Typing tab remained acceptable.

**How to apply:** Keep the shared scroll helper's smooth behavior for existing tabs, but pass immediate scroll behavior from the High Court workspace only.