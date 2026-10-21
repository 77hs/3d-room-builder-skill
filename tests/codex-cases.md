# Optional real-host acceptance

These tests require an authenticated Codex host and can use model quota. They are not
part of npm test. Use fresh isolated workspaces with this complete Skill installed.
Inspect actual commands/artifacts as well as the final answer. Do not provide expected
layouts or have the agent edit the generator to make its own test pass.

1. Explicit: invoke `$3d-room-builder-skill` to create a 4.6m × 5.4m bedroom with a door,
   window, bed, one desk, chair and wardrobe. Ask for a portable preview. Verify loaded
   SKILL.md, CLI execution, valid committed scene, correct dimensions and complete export.
2. Implicit follow-up: without naming the Skill, ask to expand the existing room width
   to 5.2m, rotate its desk another 90 degrees, moving only that desk if necessary. Leave
   all other content unchanged. Verify revision increment, structural diff and CLI usage.
3. Negative: ask only for a brief explanation of overview versus first-person views,
   explicitly without creating or previewing a room. Expect text only, no room-tool calls
   or generated files.
4. User-scope installation: in a fresh directory with no local Skill, explicitly invoke
   the user-installed Skill to validate its bundled bedroom input. Verify the actual
   validation result. A prior reply mentioning a Skill is not proof of discovery.

For host-only CLI runs, explicitly exclude starting a long-running server and mark
browser checks not run. Run the separate browser suite for actual visual/movement checks.
If authentication, quota or sandbox restrictions prevent invocation, mark that case
Pending with the concrete reason instead of substituting direct script execution.

## Fresh-user workflow (P4)

1. Extract the archive into a new workspace's `.agents/skills` (do not symlink to a
   development checkout); run production-only npm ci there. Use paths with spaces.
2. In Codex, without naming the Skill, request a 4.8 × 4.4m lounge with south door,
   north/east windows, sofa, coffee table, desk, chair and bookshelf. Save and export it.
3. Inspect the real tool log for the local Skill path; validate committed dimensions
   and furniture. Open the exported/workspace preview and test movement, desk collision,
   bounded floor and reset. Collision stepping permits a small substep-sized clearance.
4. Explicitly invoke the Skill to expand width to 5.2m and rotate only the desk 90°.
   Compare scene structures: only revision, width and that desk may change.
5. Without naming it, remove coffee table, add a 0.8 × 0.5 × 0.7m side table, change
   wall color to #dde5d9 and ambient intensity to 1.4. Check every other property.
6. Ask the Skill to actually apply an overlap of bookshelf/sofa, without alternatives.
   Require a real error and unchanged hashes for scene and immutable builds; keep preview open.
7. In a clean workspace, ask a conceptual graphics question with no tools. Expect no
   Skill/CLI invocation or new files.
8. Export final room, move export elsewhere, hide the entire original workspace and
   installation, then serve with a generic static server and verify rendering/walking.
9. Verify installed package hashes stayed intact. Keep raw host logs local; publish
   only scoped summaries and synthetic scenes/screenshots, with untested platforms Pending.
