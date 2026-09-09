---
name: Notice list payload
description: Keep notice list responses small while preserving on-demand PDF downloads.
---

Notice list endpoints must return a boolean attachment flag rather than the stored PDF data URL. The full PDF is fetched through the targeted notice-PDF endpoint only after a user clicks Download.

**Why:** Notice PDFs are stored as large data URLs, so including them in every public, landing-page, notice-page, and admin list response makes otherwise small API calls unnecessarily heavy.

**How to apply:** Use a database projection for active/admin notice lists with `hasPdf`, and keep PDF retrieval separate. Update every download button to request the attachment lazily; do not reintroduce `pdfUrl` into list responses.