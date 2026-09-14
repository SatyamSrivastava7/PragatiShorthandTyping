---
name: Assessment timer stability
description: Keep High Court and Allahabad HC countdowns running through React rerenders and browser throttling.
---

Assessment timers should derive remaining seconds from a stored absolute end timestamp. The interval is only a display/update mechanism and must not depend on the current typed response or recreate its countdown baseline on each keystroke.

**Why:** Response state changes frequently during typing, and browser tabs can throttle intervals. A decrement-only interval tied to response callbacks can be repeatedly cleared, appear stopped, or drift.

**How to apply:** Store the timer end time in a ref when the test starts, update the display from `endAt - Date.now()`, and use refs for the latest response/submission callback so the timer effect does not depend on typed text.