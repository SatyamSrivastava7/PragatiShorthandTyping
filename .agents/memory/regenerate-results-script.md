---
name: Regenerate-results script flags
description: CLI flags supported by server/scripts/regenerate-results.ts for recalculating stored result metrics after a scoring-logic change.
---

`server/scripts/regenerate-results.ts` recalculates and overwrites stored metrics (words/mistakes/speed/pass-fail) for existing `results` rows, using the current (patched) comparison logic it duplicates internally.

Supported flags (combinable):
- `--typing`, `--shorthand`, `--pitman`, `--allahabad-hc` — restrict to specific test type(s). No type flag = typing+shorthand+pitman (default).
- `--hindi` / `--english` — restrict to a language (filters on `results.language`).
- `--limit=N` — override the per-type row count processed (default 50), ordered by latest `submittedAt` first.

Example: `npx tsx server/scripts/regenerate-results.ts --typing --shorthand --hindi --limit=100`

**Why:** Useful after any change to the shared alignment/mistake-counting logic in `client/src/lib/utils.ts`, since old results retain metrics computed under the old logic until explicitly regenerated. Since this script has its own duplicated comparison logic (doesn't import from client code), any fix must be mirrored here too.

**How to apply:** Run targeted regeneration (by type/language/limit) rather than a full unfiltered run, to avoid recalculating unaffected rows (e.g. English results, which are unaffected by NFC-normalization fixes).
