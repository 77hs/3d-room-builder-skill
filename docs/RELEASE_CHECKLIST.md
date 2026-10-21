# Release checklist — v0.1.1

The owner explicitly authorized public repository creation, MIT publication, tag and
Release v0.1.1 with ZIP/tar.gz/SHA256SUMS. No additional publication approval is needed
for this version. No other repository or benefit program is in scope.

Repository: https://github.com/77hs/3d-room-builder-skill
Release: https://github.com/77hs/3d-room-builder-skill/releases/tag/v0.1.1
CI: https://github.com/77hs/3d-room-builder-skill/actions

1. Review bilingual README, SKILL.md, validation, original MIT and all third-party notices.
2. Test npm installation and full automated suite on Node 22; keep untested platforms explicit.
3. Package only allowlisted files outside the installed Skill directory; run release-check.
4. Compare staged Git paths to the same allowlist. Exclude node_modules, output, artifacts,
   environment files, local evidence/raw logs and Git metadata from source distribution.
5. Commit, run GitHub CI, tag the tested commit and attach the archives/checksum to Release.
6. Anonymously open repo/README/Skill/Release and download both archives; verify SHA256SUMS.
7. Clone publicly in a fresh directory, install per README, test, create/edit/export a scene.
8. Verify actual Actions results and retain scoped post-publication evidence locally.

Only synthetic project-authored demo scenes/screenshots are included. No private reference
project is accessed. This process does not authorize modifying other repositories,
purchasing services or applying to any OpenAI program.

Workflow references: [checkout](https://github.com/actions/checkout) and
[setup-node](https://github.com/actions/setup-node). CI has read-only repository permissions.
