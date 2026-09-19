---
name: Typing auto-scroll stability
description: Prevent visible question-paper shaking in regular and High Court Typing auto-scroll.
---

Regular Typing and High Court Typing should reposition the active-word marker immediately when the marker changes. Do not use smooth scrolling there because the marker is rebuilt on each typed character and repeated smooth animations interrupt one another. Keep the highlighted question HTML memoized by word index, not raw response text, so typing inside one word does not replace the question DOM. High Court response editors must also disable browser spell checking.

**Why:** A user recording showed the regular Typing question paper visibly jumping while typing. Both interrupted scroll animations and marker-induced reflow can create that effect, and the same implementation pattern existed in High Court.

**How to apply:** Keep the shared scroll helper's smooth behavior for unrelated tabs, but pass immediate scroll behavior from both Typing workspaces. Re-render the marker only when the current word changes, and pass spellCheck=false to every High Court response control.