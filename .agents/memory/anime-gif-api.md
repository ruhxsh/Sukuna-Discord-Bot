---
name: Anime GIF provider reliability
description: Project-specific experience testing no-key GIF APIs for Sukuna's Discord interactions.
---

When changing Sukuna's anime GIF source, make a live call to the metadata endpoint and a HEAD request to a returned media URL. Documentation alone won't catch environment or IP filtering: Nekos.best returned 403 in this environment even with its documented User-Agent format, while Gifukai's requested action endpoints and returned CDN images responded successfully.

**Why:** The commands should not post broken images, and third-party API access can differ between the agent environment and the bot runtime.

**How to apply:** Before switching providers, verify every needed action endpoint and confirm a returned image's HTTP status and content type. Keep runtime URL/type validation and a clear failure response.
