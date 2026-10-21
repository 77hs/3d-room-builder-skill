# v0.1.1

Create parameterized, walkable 3D rooms through natural-language requests in Codex.

- Generate independent rectangular rooms from JSON, with doors/windows and seven types
  of procedural furniture. Geometry and collision share normalized scene data.
- Continue editing dimensions, furniture positions/90° rotations, basic materials and lights.
- Browser overview and first-person movement, collision and position reset.
- Layout validation reports overlap, out-of-bounds objects, blocked doors and invalid spawn.
- Stable IDs, revision checks, immutable builds and history restore; failed edits preserve
  the current scene. Exported previews run independently with a static HTTP server.
- English/Chinese installation guides, reproducible synthetic examples and original screenshots.

Install the complete Skill folder, then run `npm ci --omit=dev --ignore-scripts`.
Requires Node.js 22+, npm, a Skills-capable Codex host and a desktop WebGL2 browser.
Download either installation archive and check it against SHA256SUMS. Archives contain
source, examples, docs, tests and licenses; dependency installation is required.

Validation: 20 automated tests; real Codex creation/continuous edits/error rejection,
actual Chrome rendering/walking, and independent export migration. See
[validation](VALIDATION.md) and the repository's Actions for scoped evidence.

MVP limits: one rectangular single-floor room, orthogonal furniture, static open doorframes,
fixed windows, conservative footprint/route checks and page reload after edits. No third person,
seating, stairs, arbitrary models, physics or guaranteed mobile/cross-browser support.
Windows, Firefox/Safari, mobile and physical GPU performance remain unverified.
Implicit Skill selection depends on the host/model; explicit invocation is supported.

Original code/examples/demo: MIT. Third-party dependencies retain their own bundled notices.
No private home assets or external models/music are included. No OpenAI benefit application
is performed by this release.
