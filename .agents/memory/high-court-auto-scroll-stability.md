---
name: High Court auto-scroll stability
description: Prevent visible question-paper shaking during High Court Typing auto-scroll.
---

High Court Typing should reposition the active-word marker immediately when the marker changes. Do not use smooth scrolling there because the marker is rebuilt on each typed character and repeated smooth animations interrupt one another. The marker styling must also avoid padding or font-weight changes that alter line width.

**Why:** The user-recorded High Court test showed the question paper visibly shivering while typing, while the regular Typing tab remained acceptable. Both interrupted scroll animations and marker-induced reflow can create that effect.

**How to apply:** Keep the shared scroll helper's smooth behavior for existing tabs, but pass immediate scroll behavior from the High Court workspace only.