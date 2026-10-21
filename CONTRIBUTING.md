# Contributing

Use Node.js 22+ and `npm ci --ignore-scripts`. Run `npm test`; for viewer changes,
run `npm run test:browser` after installing Chromium (or select installed Chrome).
Keep geometry/collision derived from scene data, preserve stable IDs and transactional
edits, and add focused tests for observable failures. Do not special-case example rooms.

Use only original procedural examples or assets with documented redistribution rights.
Do not submit real homes, personal media, credentials, generated workspaces, node_modules
or local logs. New dependencies need an upstream source and full license notice.
Changes should preserve the current rectangular single-room scope unless separately agreed.
See docs/VALIDATION.md for tested and untested environments. The repository is prepared
locally; this document does not authorize publication or create a public support service.
