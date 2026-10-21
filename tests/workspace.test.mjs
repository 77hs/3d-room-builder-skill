import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createWorkspace, readScene, applyChange, history, restore, exportBuild, digest, locked, recoverLock } from '../src/workspace.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)), run = promisify(execFile);
const sample = async n => JSON.parse(await fs.readFile(path.join(root, 'examples', n), 'utf8'));
const temp = async t => { const p = await fs.mkdtemp(path.join(os.tmpdir(), 'room-builder-test-')); t.after(() => fs.rm(p, { recursive: true, force: true })); return p; };
async function treeHash(dir) {
  const rows = [];
  async function visit(folder, prefix = '') { for (const e of (await fs.readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(folder, e.name); if (e.isDirectory()) await visit(p, prefix + e.name + '/'); else rows.push([prefix + e.name, digest(await fs.readFile(p))]); } }
  await visit(dir); return digest(rows);
}
test('CLI creates, validates, applies C, builds a portable site and rejects all D without changing state', async t => {
  const parent = await temp(t), dir = path.join(parent, 'my study');
  const cli = (...args) => run(process.execPath, [path.join(root, 'scripts/room.mjs'), ...args], { cwd: parent });
  const created = JSON.parse((await cli('create', '--scene', path.join(root, 'examples/b-study.json'), '--dir', dir)).stdout);
  assert.equal(created.ok, true); assert.equal(created.revision, 1);
  assert.equal(JSON.parse((await cli('validate', '--dir', dir)).stdout).valid, true);
  await cli('apply', '--dir', dir, '--change', path.join(root, 'examples/c-study.change.json'));
  const out = path.join(parent, 'independent preview'); await cli('build', '--dir', dir, '--out', out);
  const sceneBefore = await fs.readFile(path.join(dir, 'scene.json')), siteBefore = await treeHash(out), allBefore = await treeHash(dir);
  for (const file of ['d-overlap.change.json', 'd-bounds.change.json', 'd-door.change.json', 'd-spawn.change.json']) {
    await assert.rejects(cli('apply', '--dir', dir, '--change', path.join(root, 'examples', file)), e => { assert.equal(e.code, 2); const report = JSON.parse(e.stderr); assert.equal(report.ok, false); assert.ok(report.errors[0].code); return true; });
    assert.deepEqual(await fs.readFile(path.join(dir, 'scene.json')), sceneBefore); assert.equal(await treeHash(dir), allBefore); assert.equal(await treeHash(out), siteBefore);
  }
  const exported = JSON.parse(await fs.readFile(path.join(out, 'compiled.json'), 'utf8'));
  assert.equal(exported.revision, 2); assert.ok(await fs.stat(path.join(out, 'vendor/three.core.js')));
  assert.ok(!(await fs.readFile(path.join(out, 'index.html'), 'utf8')).includes(root));
  await assert.rejects(cli('build', '--dir', dir, '--out', out)); assert.equal(await treeHash(out), siteBefore);
});
test('immutable history and restore recover a previous valid scene as a new revision', async t => {
  const dir = await temp(t), first = await createWorkspace(dir, await sample('b-study.json'));
  await applyChange(dir, await sample('c-study.change.json'));
  await restore(dir, first.hash, 2); const restored = await readScene(dir);
  assert.equal(restored.revision, 3); assert.equal(restored.room.width, 3.6); assert.ok(restored.furniture.some(f => f.id === 'chair-b'));
  assert.equal((await history(dir)).length, 3);
  await assert.rejects(restore(dir, first.hash, 1), e => e.errors[0].code === 'REVISION_CONFLICT');
});
test('interrupted precommit build failure leaves scene untouched and releases the workspace lock', async t => {
  const dir = await temp(t); await createWorkspace(dir, await sample('b-study.json')); const previous = await fs.readFile(path.join(dir, 'scene.json'));
  // Block the build parent to emulate a filesystem failure without modifying the package.
  const builds = path.join(dir, '.room-builder/builds'), saved = builds + '-saved';
  await fs.rename(builds, saved); await fs.writeFile(builds, 'blocked');
  await assert.rejects(applyChange(dir, await sample('c-study.change.json')));
  assert.deepEqual(await fs.readFile(path.join(dir, 'scene.json')), previous);
  await fs.unlink(builds); await fs.rename(saved, builds); await applyChange(dir, await sample('c-study.change.json'));
  assert.equal((await readScene(dir)).revision, 2);
});
test('concurrent writers are excluded, active locks stay intact, stale locks can be recovered', async t => {
  const dir = await temp(t); await createWorkspace(dir, await sample('b-study.json'));
  await locked(dir, async () => { await assert.rejects(applyChange(dir, await sample('c-study.change.json')), e => e.errors[0].code === 'WORKSPACE_LOCKED'); await assert.rejects(recoverLock(dir), /still running/); });
  await fs.writeFile(path.join(dir, '.room-builder/lock'), JSON.stringify({ pid: 2147483647 }));
  assert.equal((await recoverLock(dir)).recovered, true); await applyChange(dir, await sample('c-study.change.json'));
});
test('create refuses to overwrite an existing scene and malicious unknown input never commits', async t => {
  const dir = await temp(t); await createWorkspace(dir, await sample('a-bedroom.json')); const before = await fs.readFile(path.join(dir, 'scene.json'));
  await assert.rejects(createWorkspace(dir, await sample('b-study.json')), /already has/);
  await assert.rejects(applyChange(dir, { expectedRevision: 1, operations: [{ op: 'runShell', value: 'anything' }] }));
  assert.deepEqual(await fs.readFile(path.join(dir, 'scene.json')), before);
});
test('tampered cached build cannot be silently exported', async t => {
  const dir = await temp(t), built = await createWorkspace(dir, await sample('a-bedroom.json'));
  await fs.appendFile(path.join(dir, '.room-builder/builds', built.hash, 'compiled.json'), 'tampered');
  await assert.rejects(exportBuild(dir, path.join(dir, 'export')), e => e.errors?.[0].code === 'ARTIFACT_INTEGRITY');
});
test('published lounge demonstration reproduces both accepted edits exactly and keeps unrelated IDs stable', async t => {
  const dir = await temp(t); await createWorkspace(dir, await sample('lounge-initial.json'));
  await applyChange(dir, await sample('lounge-resize.change.json'));
  await applyChange(dir, await sample('lounge-finish.change.json'));
  const scene = await readScene(dir); assert.deepEqual(scene, await sample('lounge-demo.json'));
  const out = path.join(await temp(t), 'portable lounge'); await exportBuild(dir, out);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(out, 'scene.json'))), scene);
});
