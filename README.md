# 3D Room Builder Skill

[简体中文](README.zh-CN.md) · [Demo](docs/DEMO.md) · [Validation](docs/VALIDATION.md) · [v0.1.1 downloads](https://github.com/77hs/3d-room-builder-skill/releases/tag/v0.1.1)

Create and keep editing walkable 3D rooms through natural-language requests in Codex.
The Skill translates requests into scene data; a deterministic JavaScript generator
validates it and builds a browser preview. No AI API key or private project is required.

![Procedural room overview](docs/demo/overview.png)

## Install

Requires Node.js **22+**, npm, a Codex host with Skills support and a desktop WebGL2 browser.
Download the ZIP or tar.gz from [Release v0.1.1](https://github.com/77hs/3d-room-builder-skill/releases/tag/v0.1.1), verify
it against the attached SHA256SUMS, then extract it. Copy its entire `3d-room-builder-skill`
folder into **one** location:

- Project: `<your-workspace>/.agents/skills/3d-room-builder-skill`
- User: `$HOME/.agents/skills/3d-room-builder-skill`

From that installed folder, run:

```sh
npm ci --omit=dev --ignore-scripts
```

Alternatively, install the tagged source directly from your workspace root:

```sh
mkdir -p .agents/skills
git clone --branch v0.1.1 --depth 1 https://github.com/77hs/3d-room-builder-skill.git .agents/skills/3d-room-builder-skill
cd .agents/skills/3d-room-builder-skill
npm ci --omit=dev --ignore-scripts
```

To verify downloaded archives on macOS use `shasum -a 256 -c SHA256SUMS`; on Linux use
`sha256sum -c SHA256SUMS`. Download both archives beside SHA256SUMS for this full check.

Open a new Codex conversation in your workspace. Avoid duplicate installations with the
same name. Keep generated rooms outside the installed Skill. On Windows use your user
profile folder for the user installation and quote paths containing spaces.
An initial npm download is required; generated previews use no CDN or remote assets.

## Ask Codex

```text
$3d-room-builder-skill Create a 4m × 5m modern bedroom in my-bedroom,
with a door, window, bed, desk, chair and wardrobe. Start its browser preview.
```

Continue in the same workspace:

```text
Increase the width to 4.5m and rotate the desk 90 degrees.
Move only that desk if needed; keep everything else unchanged.
```

```text
Change the wall color to #dde5d9 and ambient light intensity to 1.4.
```

A request to create or modify a walkable room can trigger the Skill without naming it.
Host/model selection varies; use `$3d-room-builder-skill` when implicit selection misses.
Conceptual explanations, image-only requests and unrelated code changes are outside its scope.
Conflicting changes are rejected with object IDs and reasons; existing data remains intact.

## Supported scope

One rectangular room, 2–20m on each side; walls, floor, ceiling, static open door frames,
fixed windows; seven procedural furniture types (bed, desk, chair, wardrobe, bookshelf,
sofa, table); dimensions, positions and 0/90/180/270° rotations; basic colors and lights;
overview and first-person walking with collision and reset. No external models or textures.

`scene.json` is authoritative. Geometry and collision derive from the same normalized
scene. Stable IDs, revision checks, immutable builds and history/restore support repeated
edits. No automatic rearrangement or silent repair. See [scene specification](references/scene-spec.md)
and [CLI/recovery workflow](references/workflow.md).

## Direct CLI / reproducible examples

From the installed folder, using new output directories:

```sh
node scripts/room.mjs create --scene examples/a-bedroom.json --dir ./output/bedroom
node scripts/room.mjs serve --dir ./output/bedroom --port 5173
```

In another terminal, build a different room and edit it:

```sh
node scripts/room.mjs create --scene examples/b-study.json --dir ./output/study
node scripts/room.mjs apply --dir ./output/study --change examples/c-study.change.json
node scripts/room.mjs validate --dir ./output/study
node scripts/room.mjs build --dir ./output/study --out ./output/study-export
node scripts/room.mjs serve --static ./output/study-export --port 5174
```

Open the printed loopback URL. A generated export contains the required Three.js modules
and licenses: move it anywhere and use any static HTTP server. Do not open `file://`.
Run CLI commands by their installed absolute path when working outside the Skill folder.

Controls: overview drag/scroll; first person WASD/arrows, Q/E turn, drag/click to look,
R reset, Escape release pointer lock. Drag remains available if pointer lock is denied.
Valid edits reload the live preview.

## Development / tests

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:browser
node scripts/package.mjs ../room-builder-package/3d-room-builder-skill
node scripts/release-check.mjs ../room-builder-package/3d-room-builder-skill
```

Use `ROOM_BUILDER_BROWSER_CHANNEL=chrome` for an installed Chrome instead of downloading
Chromium. Real Codex workflow tests require an authenticated host and model quota; see
[host cases](tests/codex-cases.md). CI runs dependency installation, automated tests and package checks on Node 22/24: [Actions](https://github.com/77hs/3d-room-builder-skill/actions). Package outside the installed
Skill directory to avoid exposing a second nested SKILL.md to discovery.

## Limits and license

No third person, seating, stairs, multiple rooms, arbitrary meshes, physics engine,
mobile guarantee or architectural/accessibility certification. Whole-footprint collisions
block gaps under desks. Door approach/path checks are conservative; narrow routes can be
rejected. There is no walkable exterior beyond doorways. Valid edits reload the page.
Actual GPU performance and platforms not listed in [validation](docs/VALIDATION.md)
remain unverified. Initial dependency installation requires registry access.

Original code, virtual scene examples and demo screenshots: [MIT](LICENSE).
Dependencies retain [their own licenses](THIRD_PARTY_NOTICES.md), bundled in
`third-party-licenses/`. No personal layouts, photos, models, music or credentials are
included. User-added assets require their own redistribution rights.

Version 0.1.1 is released under MIT with owner authorization. See [release notes](docs/RELEASE_NOTES.md)
and [project status](PROJECT_STATUS.md). Future publication and account actions are outside normal Skill use.
