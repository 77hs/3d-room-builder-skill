# Validation and release readiness

Date: 2026-10-21. Version: 0.1.1.
P3: **PASS / CLOSED**, approved by the owner. P4: completed for the tested environment.
P5: complete. The owner explicitly authorized public MIT release v0.1.1.
Machine-readable scoped results: [validation-summary.json](validation-summary.json).

## Real fresh-user workflow

This was a real authenticated Codex CLI workflow (not a fabricated transcript or direct
CLI substitution for Skill selection). A complete P3 installation archive was extracted
into a new workspace's `.agents/skills`, with production-only npm ci, no symlink to the
development checkout. Workspace and room paths contained spaces.
The final 0.1.1 release retains byte-identical generator, viewer, schema and room CLI
from that tested runtime (10 files); changes concern docs, packaging and release checks.

| Step | Observed result |
| --- | --- |
| Implicit creation | A new Chinese request without naming the Skill loaded the local SKILL.md and executed its real tools |
| New room | 4.8 × 4.4 × 2.8m lounge, south door, north/east windows, sofa/coffee table/desk/chair/bookshelf; revision 1 |
| Actual browser | Chrome WebGL rendered the saved room; UI dimensions, height and furniture count matched data |
| Movement | Keyboard walking, desk collision, bounded floor and saved-position reset checked |
| Explicit first edit | Width 5.2m, desk turned 90° and moved; revision 2; all other data exactly preserved |
| Implicit second edit | Coffee table removed, 0.8 × 0.5 × 0.7m side table added, wall color/ambient light changed; revision 3; other data equal |
| Invalid edit | Codex actually called apply on a bookshelf/sofa overlap; CLI exit 2 / OVERLAP with both IDs |
| Preservation | Invalid edit left scene and immutable build file hashes, browser URL and revision unchanged |
| Negative routing | Conceptual projection question produced text, zero tool calls and no new files |
| Export migration | Export moved elsewhere; original installation and whole user workspace hidden; generic static server still rendered/walked |
| Installation integrity | All installed source manifest hashes unchanged after the workflow |

The browser session recorded zero page errors and zero nonlocal requests. All five Codex
runs completed without timeout. Raw authenticated-host logs remain local and are excluded
from distribution. The synthetic scenes and screenshots in examples/ and docs/demo/ are
safe, reproducible demonstration material, not a private layout.

## Automated verification

`npm test`: **20 passed / 0 failed**. This includes P3's 17 accepted tests, two distribution
checks and one exact reproduction of the public lounge edit sequence. Tests cover:

- CLI create/validate/apply/build, A/B/C/D and transaction/history recovery;
- 64 parameter combinations and 9,600 seeded movement steps;
- seven furniture kinds × four rotations and visible-component footprint bounds;
- interrupted precommit, concurrent/stale writer and cached-build tampering;
- package hash inventory, documentation links, licenses, spaces/temporary path aliases;
- rejection of personal-path injection, extra artifacts, modified files and symlinks;
- refusal to package inside an installed Skill, preventing duplicate discovery;
- deterministic two-edit demo equals the accepted final scene, then exports correctly.

P3's browser suite also passed six live updates with one canvas and stable sampled
renderer counts. This sampling is not proof of long-running GPU memory or performance.
The official bundled Skill validator passed; it validates metadata, not semantic routing.
Real-host procedures are documented in [host cases](../tests/codex-cases.md).

## Fixes found during preparation

- Moved a nested uncompressed development package outside the installed Skill: it exposed
  a duplicate name through user-scope discovery. Packaging now refuses nested targets.
- Corrected the new release checker's direct-entry detection for filesystem path aliases
  as well as spaces; an executable-path regression test covers it.
- Corrected test-harness assumptions about step-sized collision clearance and a nested
  subprocess's exit status after inspecting actual evidence. No runtime rewrite was needed.

## Privacy, dependencies and rights

No private reference project was read, modified, copied or needed during P3/P4/P5.
All original code, procedural geometry, virtual scenes and demo screenshots use MIT.
Eight installed dependency license files were byte-compared with the bundled notices;
versions and licenses match package-lock.json. The saved npm audit returned 0 vulnerabilities
at the time of the check. See [third-party notices](../THIRD_PARTY_NOTICES.md).

Distribution uses a file allowlist and hash manifest, excludes development outputs/logs,
node_modules, Git metadata and environment files, and checks local documentation links,
credential/personal-path patterns and PNG metadata. No external model, photograph, video,
music, credential or personal absolute path belongs to the package. These scoped checks
are not a guarantee for future user-added content. Public release v0.1.1 has owner approval; future user assets require their own rights.

## Tested environment and Pending

Actual: macOS, Node.js 22.23.3 and 24.18.0, Codex CLI 0.163.0-alpha.10.2, desktop Chrome using headless
SwiftShader for repeatable WebGL checks. This is not physical GPU, frame-rate or thermal testing.

Node 22.23.3 release preflight: fresh full npm ci, 20/20 tests, actual create → two
edits → export → validate all passed. Node 22 was installed only in a temporary directory. The full actual Chrome browser
suite also passed on Node 22: A/B/C/D, movement/collision/reset, six live edits and
standalone rendering after removing its source workspace (zero page errors/external requests).

GitHub-hosted Ubuntu CI passed both Node 22 and 24 jobs: fresh dependency installation,
20 automated tests, packaging and offline release checks in each job.
The [initial public run](https://github.com/77hs/3d-room-builder-skill/actions/runs/39601096007)
is recorded evidence; consult [Actions](https://github.com/77hs/3d-room-builder-skill/actions)
for subsequent commit/tag runs. Linux browser interaction was not tested by CI.

A second fresh authenticated Codex release workflow also passed: implicit creation of a
4.4 × 5.6m studio, explicit continuous resize to 4.9 × 5.6m and desk rotation/move,
then wall/ambient changes (revisions 1 → 2 → 3). A real conflicting bookshelf/sofa
apply returned exit 2 and preserved the committed scene. Independent comparison confirmed
every unrelated property unchanged. The exported final scene actually rendered in Chrome,
showed five furniture items, and passed keyboard movement, bounds and reset checks with
zero page errors or external requests. This supplements rather than replaces the earlier
implicit-edit/negative-routing and migration cases.

Pending: Windows/Linux browser behavior, Firefox/Safari, mobile and physical GPU
performance. No deployment or benefit application is part of this release.

The product scope remains a single rectangle, orthogonal furniture, static open doorframes
and fixed windows. Whole-footprint and sampled route checks can conservatively reject narrow
paths; walking stops within a collision substep of a boundary. Edits reload the viewer.
Implicit invocation depends on host/model; explicit invocation is available. No architecture,
accessibility, mobile or universal implicit-trigger certification is claimed.
