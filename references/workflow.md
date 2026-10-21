# CLI and workspaces

Run `node <skill-dir>/scripts/room.mjs --help` for exact arguments. Commands run from
any working directory. Quote paths containing spaces. Relative input/output paths
resolve against the caller's working directory, not the installed Skill.

- `create --scene INPUT --dir WORKSPACE`: normalize, validate and create a room.
- `validate --scene INPUT` or `validate --dir WORKSPACE`: check without writing.
- `apply --dir WORKSPACE --change REQUEST`: validate and commit a transaction.
- `build --dir WORKSPACE --out NEW_DIRECTORY`: portable site, refuses overwrite.
- `serve --dir WORKSPACE --port 5173`: live loopback preview; valid edits reload it.
- `serve --static EXPORTED_DIRECTORY --port 5174`: serve an exported site independently.
- `history --dir WORKSPACE`: list successful immutable versions.
- `restore --dir WORKSPACE --hash HASH --expected REVISION`: old content as a new revision.
- `recover-lock --dir WORKSPACE`: remove a stale lock only when its process is gone.

Outputs are JSON. Errors exit 2 with code/path/message/objects. Do not interpret a
rejected request as partial success. Address conflicts by ID without moving other objects.

scene.json is the only authoritative current state. `.room-builder/builds/<hash>`
contains complete immutable versions with their own scene, compiled graph and manifest.
A complete build is written before scene.json is atomically replaced. The live server
reads that scene, not a separately maintained latest pointer. An interrupted precommit
can leave an unused build but cannot activate an invalid room. Do not edit cached builds
or delete history during an ordinary edit. Use history/restore for recovery.

The workspace allows one writer. Wait for that writer or confirm it has exited before
recover-lock. A lock is never automatically stolen from a running process.

Exported sites only need a static HTTP server and WebGL2 browser; they contain their
own required modules. No CDN, font, texture, music or API requests. Do not open file://.
Live preview binds 127.0.0.1 only. Port 0 selects a free port and prints it. Stop only
the task's own server process; keep the delivered preview server alive if possible.
Pointer lock can be denied by the browser; dragging remains available. Desktop is the MVP.
