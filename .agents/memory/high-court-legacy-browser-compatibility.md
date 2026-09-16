---
name: High Court legacy browser compatibility
description: Keep the High Court student experience usable in older Windows browsers.
---

High Court student UI compatibility must not depend on Tailwind v4 color-space output, modern gradient syntax, ResizeObserver, smooth scroll options, or a PDF worker being available. Keep plain-color fallbacks and main-thread/native PDF recovery paths in the isolated High Court surface.

**Why:** Many students use Windows 7, where the installed browser may support the application but reject newer CSS color functions or browser APIs. Missing fallbacks appeared as invisible colors, PDF failures, and unstable typing behavior.

**How to apply:** Scope legacy-safe color variables and RGB gradients to High Court student views, use window resize as a ResizeObserver fallback, assign scrollTop for immediate marker correction, and retry PDF.js without a worker before offering the browser PDF renderer.