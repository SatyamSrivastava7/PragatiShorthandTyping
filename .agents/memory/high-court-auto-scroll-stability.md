---
name: Typing auto-scroll stability
description: Prevent visible question-paper shaking in regular and High Court Typing auto-scroll.
---

Regular Typing and High Court Typing should reposition the active-word marker only when the marker changes. Keep the question HTML and word elements stable for the entire test, then toggle the active class instead of rebuilding markup. This prevents older browsers from remeasuring the question on each keystroke. If regular Typing Auto-scroll is enabled, manual question scrolling must restore the active word, while guarding programmatic scroll events from feedback loops. High Court response editors must also disable browser spell checking.

**Why:** A user recording showed the regular Typing question paper visibly jumping while typing. Both interrupted scroll animations and marker-induced reflow can create that effect, and the same implementation pattern existed in High Court.

**How to apply:** Keep the shared scroll helper's smooth behavior for unrelated tabs, but only scroll from Typing workspaces when the current word changes. Use plain inline marker styles without padding or font-weight changes, and pass spellCheck=false to every High Court response control.