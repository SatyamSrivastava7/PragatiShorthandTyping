---
name: Development user schema drift
description: Avoid an incorrect users-column rename when bringing the development database in sync.
---

The development `users` table may retain an unrelated legacy `current_session_id` column while lacking the required `access_months` column. Create `access_months` independently; do not rename `current_session_id`.

**Why:** Schema synchronization can incorrectly suggest that `current_session_id` was renamed to `access_months`. They represent different concepts, and accepting that rename causes login queries to remain semantically wrong.

**How to apply:** When login fails with a missing `access_months` database error, verify the live development columns and add `access_months` with the schema default while leaving `current_session_id` untouched.