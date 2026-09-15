---
name: High Court Pitman PDF loading
description: Reliable student delivery of High Court Pitman question-paper PDFs.
---

High Court Pitman PDFs should be fetched once by the PDF.js viewer from the authenticated `/api/high-court/tests/:id/pdf` endpoint. Do not first download the endpoint into a browser blob URL and then fetch that blob again for rendering.

**Why:** The extra blob-URL hop can fail in the student preview even when the authenticated API request returns the PDF successfully.

**How to apply:** Keep the API route responsible for authentication and base64 normalization; let the viewer fetch the route and pass the response bytes directly to PDF.js. Require a non-empty Pitman PDF when creating or editing a High Court folder so students do not receive a missing-attachment response.