# Third-party notices and provenance

The engine, procedural furniture, viewer, virtual examples and Skill instructions are
independently authored for this project. No personal media, models, music, configuration
or project-specific source code were imported from another project.

Pinned npm dependencies (exact versions and integrity hashes in package-lock.json):

| Dependency | Purpose | License | Upstream |
| --- | --- | --- | --- |
| three | Rendering, OrbitControls | MIT | https://github.com/mrdoob/three.js |
| ajv | JSON Schema validation | MIT | https://github.com/ajv-validator/ajv |
| fast-deep-equal | Ajv dependency | MIT | https://github.com/epoberezkin/fast-deep-equal |
| fast-uri | Ajv dependency | BSD-3-Clause | https://github.com/fastify/fast-uri |
| json-schema-traverse | Ajv dependency | MIT | https://github.com/epoberezkin/json-schema-traverse |
| require-from-string | Ajv dependency | MIT | https://github.com/floatdrop/require-from-string |
| playwright, playwright-core | Development browser tests | Apache-2.0 | https://github.com/microsoft/playwright |

Keep upstream licenses with redistributed dependencies. Generated sites include the
full Three.js LICENSE. npm installs dependency licenses with each package. Playwright
browser binaries have separate notices and are not distributed with this Skill or rooms.
The self-authored MIT license does not relicense third-party code. Future user assets
require separate provenance and redistribution rights before they can be packaged.
