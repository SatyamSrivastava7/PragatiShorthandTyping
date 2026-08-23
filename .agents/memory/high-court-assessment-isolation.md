---
name: High Court assessment isolation
description: Boundary and scoring rules for the standalone High Court assessment feature.
---

High Court assessments are English-only and are intentionally isolated from the legacy Typing, Shorthand, Pitman, Allahabad HC, generic result, and PDF paths.

**Why:** The High Court exam combines three distinct papers into one 400-mark assessment with independent deductions and reporting. Reusing generic behavior would let legacy result processing overwrite or misrepresent High Court marks.

**How to apply:** Add High Court functionality only through the dedicated High Court data/API/UI/PDF layers. Preserve the folder-first student journey, the three-paper batch upload, and one grouped result per exam folder. Keep server-side scoring authoritative: Typing 100 (0.20/full), Pitman 100 (0.40/full), Shorthand 200 (0.40/full and 0.20/half). Reimplement legacy-equivalent comparison semantics independently in the High Court scorer and renderer; do not import generic comparison code.