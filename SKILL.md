---
name: 3d-room-builder-skill
description: Create, modify and preview runnable single rectangular 3D rooms from natural-language requests, including dimensions, doors, windows, furniture, materials, lighting and first-person walking. Use for room-building tasks or edits to this tool's scene.json. Do not use for explanation-only questions, image-only requests, unrelated application changes or arbitrary 3D models.
license: MIT
---

# 3D Room Builder

Deliver a working local preview, not just an explanation or an example file.

## Locate and prepare

- Resolve this skill's directory from the loaded SKILL.md path. Call its CLI by absolute path; do not assume the current working directory is the skill directory.
- Keep user workspaces separate from the installed skill. Never modify bundled examples to stand in for the user's room.
- If dependencies are missing, run `npm ci --omit=dev --ignore-scripts` in the skill directory. Network is needed for installation, not generated previews. Do not install unrelated software or change host settings.
- Before authoring the first scene or change, read [the specification](references/scene-spec.md). For commands, recovery and preview behavior, read [the workflow](references/workflow.md).

## Create

1. Translate the request into scene JSON in the user's target workspace parent. Infer ordinary unspecified dimensions, palette and initial placements; state material assumptions in the result. Respect explicit dimensions and placements.
2. Support one rectangular, single-level room and the documented furniture catalog. Rotations are 0/90/180/270 degrees. Doors are static open frames; windows are fixed. Do not promise stairs, arbitrary meshes, exterior walkable spaces or unsupported interaction modes.
3. Run `node <skill-dir>/scripts/room.mjs validate --scene <input.json>` and resolve errors within the requested scope. Do not disable validation, shrink requested objects or silently rearrange existing furniture.
4. Run `create --scene <input.json> --dir <room-workspace>`. The committed scene.json is authoritative; subsequent edits use it.

## Modify

1. Read current scene.json, including revision and stable IDs.
2. Write a structured request with that exact expectedRevision. Preserve unspecified objects and properties. Do not regenerate an existing room from an example.
3. Run `apply --dir <room-workspace> --change <change.json>`. A rejected change preserves the committed room. Explain returned conflict IDs and reasons; propose a correction without silently moving other furniture.
4. If the revision changed, reread and reconcile; never force an overwrite.

## Preview and verify

- Run `serve --dir <room-workspace> --port <available-port>` and return its actual loopback URL. Do not terminate an existing process to take its port.
- Verify loading, actual geometry, overview, first-person movement, reset and relevant collision in a browser when tools are available. Otherwise mark browser checks Pending.
- Valid changes reload the live preview from the new immutable build. Use `build --dir <room-workspace> --out <new-directory>` for a self-contained portable preview.
- Report the saved scene, revision, preview URL, modifications and checks performed. Never claim rendering, collision or Skill invocation from a JSON check alone.

## Boundaries

- Only packaged code, npm dependencies and self-authored scene data are needed. Do not import private projects, personal media, models, music or credentials.
- Do not deploy, publish, create accounts or push repositories as part of building a room.
- Keep the engine generic. User edits belong in scene data, not generated JS, templates, compiler branches or collision code.
