---
name: Regenerate-results script flags
description: CLI flags supported by server/scripts/regenerate-results.ts for recalculating stored result metrics after a scoring-logic change.
---

`server/scripts/regenerate-results.ts` selects the latest N rows per requested test type, ordered by `submittedAt` descending (default 50). The Shorthand path uses the shared `calculateShorthandResultMetrics` helper against the saved original and typed content, so HTML is stripped for scoring without overwriting the raw HTML/display fields. It refreshes plain-text clean snapshots and metric fields only.

Supported type/language/limit flags:
- `--typing`, `--shorthand`, `--pitman`, `--allahabad-hc` — restrict to specific test type(s). No type flag = typing+shorthand+pitman (default).
- `--hindi` / `--english` — restrict to a language (filters on `results.language`).
- `--limit=N` — override the per-type row count processed (default 50), ordered by latest `submittedAt` first.

The `results:recalculate:shorthand` package command selects exactly the latest 50 shorthand rows. It defaults to dry-run; writes require `--apply` and an explicit `--production` or `--development` target. `--production` also requires `NODE_ENV=production` and uses the current runtime's configured database connection. Run production mode only inside the deployed runtime, not from the development workspace. Publishing does not execute this one-off script automatically.

**Why:** Old results retain metrics computed under the old logic until explicitly regenerated. Using the live Shorthand scorer prevents historical recalculations from drifting, while dry-run and explicit target flags reduce accidental production writes.

**How to apply:** After publishing the updated code, run the package command in the deployed production runtime without `--apply` to review the latest-50 calculation, then run it again with `--apply` once. The development database test is not a production backfill.
