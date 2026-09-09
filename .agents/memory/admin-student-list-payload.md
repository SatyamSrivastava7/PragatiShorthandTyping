---
name: Admin student list payload
description: Keep the admin Students list response small and separate from full user records.
---

The admin Students list should return only fields needed for identity, search, display, access status, expiry, and related-result batch labels. Do not include profile media, purchased PDF arrays, session data, payment details, password fields, or other full-record fields.

**Why:** The dashboard loads hundreds of students at once and large per-user fields make the request and browser cache unnecessarily heavy.

**How to apply:** Use a database projection for the list endpoint and keep full user retrieval limited to targeted detail or mutation flows. If the Students table needs a new field, add it deliberately to the summary type and projection rather than reverting to selecting the entire users table.