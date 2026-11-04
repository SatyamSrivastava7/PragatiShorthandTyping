---
name: High Court display sanitization
description: Rules for keeping High Court alignment results and exports free of editor-generated HTML artifacts.
---

Decode HTML entities before removing tags in the High Court scoring pipeline. Never turn style-only differences into synthetic `"formatting"` word entries or word-error deductions. Keep display sanitization for genuine Word/HTML artifacts, but do not hide this scorer-generated entry separately in each result view.

**Why:** The High Court typing scorer converted bold/italic/underline differences into a fake `"formatting"` alignment entry, which appeared as a red/green word pair and incorrectly changed mistake totals and marks. Previously saved attempts retain that synthetic entry until they are re-scored.

**How to apply:** Fix the rule in the High Court scorer so all new submissions and metrics use text alignment only. For existing attempts, re-score rows containing the exact legacy formatting-error reason from their saved original and typed text, updating marks and alignment data while preserving source text. Do not add a filter to individual student/admin/PDF views.