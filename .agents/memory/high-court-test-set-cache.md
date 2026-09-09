---
name: High Court test-set cache
description: Avoid repeated High Court test-set list requests while keeping mutations visible.
---

High Court paged test-set responses are cached by limit and offset in the client and reused when the Manage Tests tab remounts.

**Why:** The dashboard can unmount and remount tab content, and repeatedly fetching the same 50-folder page wastes network and database work.

**How to apply:** Invalidate all cached pages after creating, editing, or deleting a High Court folder/paper, and allow the explicit Refresh action to bypass the cache. Keep full paper loading separate from cached list summaries.