---
name: Settings QR payload
description: Keep the large payment QR data URL out of general settings traffic.
---

The general settings contract must expose only lightweight payment settings and a `hasQrCode` flag. The QR data URL belongs behind the dedicated QR endpoint and should be queried only when the payment modal or admin QR viewer is opened.

**Why:** The QR image is stored as a large data URL and is not needed by most settings consumers, so including it in every settings response wastes transfer and parsing work.

**How to apply:** Keep QR reads and cache entries separate from the shared settings query. Preserve QR uploads through the existing settings update flow, and invalidate or update the QR-specific cache when the image changes.