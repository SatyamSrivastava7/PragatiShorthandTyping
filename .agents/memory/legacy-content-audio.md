---
name: Legacy content audio data
description: Compatibility decision for old media values still stored on content rows
---

The current app no longer uses content-level audio fields, but development data still contains legacy media values. Keep the nullable legacy column represented in the schema so database sync does not silently delete those values.

**Why:** The schema push detected existing non-null data and correctly stopped before a destructive drop. Preserving the column keeps the pulled app/schema ready without discarding potentially useful audio data.

**How to apply:** Remove the compatibility field only after confirming the remaining values have been migrated or are no longer needed, with an explicit data-retention decision.