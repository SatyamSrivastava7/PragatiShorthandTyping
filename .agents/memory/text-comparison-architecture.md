---
name: Text comparison architecture
description: How word alignment/mistake-counting is shared across test types and flows in the typing/shorthand platform.
---

All four test types (typing, shorthand, allahabad-hc, pitman) compute mistakes via the same underlying word-alignment pipeline in `client/src/lib/utils.ts`:
- `calculateTypingMetrics` (used by typing, allahabad-hc) and `calculateShorthandMetrics` (used by shorthand, pitman) both funnel through `getTypingAlignment` / `alignWordsDP` / `alignWordsWindowed`, which all call `normalizeForComparison`.
- Result review (`ResultTextAnalysis.tsx`) and PDF generation (`generateResultPDF`) reuse these same exported functions rather than duplicating comparison logic.
- The server (`server/routes.ts`) does not recompute alignment itself — it trusts mistake counts computed client-side at submission time.
- Two standalone scripts (`scripts/recalc-allahabad.ts`, `server/scripts/regenerate-results.ts`) keep their own copies of this logic since they run outside the browser bundle — any future fix to comparison logic in `utils.ts` must be manually mirrored into both scripts.

**Why:** Hindi (Devanagari) text can encode visually-identical words with different Unicode sequences (matra/conjunct ordering), causing false mistakes unless normalized. `normalizeForComparison` now applies `.normalize("NFC")` first; this is a no-op for English/ASCII text so English scoring is unaffected.

**How to apply:** When changing comparison/mistake logic, apply the change in `client/src/lib/utils.ts` AND mirror it into the two standalone scripts. All four test types and all display/PDF flows will pick it up automatically since they share the same functions.
