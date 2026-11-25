---
name: Assessment timer stability
description: Keep High Court and Allahabad HC countdowns running through React rerenders and browser throttling.
---

All assessment pages should use the shared countdown hook. Arm its deadline when the student starts, calculate remaining seconds from the monotonic clock, refresh after background-tab throttling, and keep the expiry callback current without restarting the deadline on rerenders.

**Why:** Response state changes frequently during typing, browsers throttle background tabs, and wall-clock adjustments can jump a `Date.now()` timer forward or backward. Independent timer implementations had different reset and expiry behavior across test types.

**How to apply:** Use `useAssessmentTimer` for every test page. Start a fresh duration for each attempt, and stop the active timer after either timed or manual submission succeeds.