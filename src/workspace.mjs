import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalize, validate, changeScene, SceneError } from './core/spec.mjs';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const digest = data => crypto.createHash('sha256').update(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)).digest('hex');
export async function readJSON(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { throw new SceneError([{ code: 'INPUT', path: path.basename(file), message: e instanceof SyntaxError ? 'Invalid JSON' : 'Cannot read JSON file', objects: [] }]); }
}
async function writeAtomic(file, data) {
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    const handle = await fs.open(tmp, 'wx');
    try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(tmp, file);
  } finally { await fs.rm(tmp, { force: true }); }
}
export async function locked(dir, action) {
  await fs.mkdir(path.join(dir, '.room-builder'), { recursive: true });
  const lock = path.join(dir, '.room-builder/lock');
  let handle;
  try { handle = await fs.open(lock, 'wx'); }
  catch (e) { if (e.code !== 'EEXIST') throw e; throw new SceneError([{ code: 'WORKSPACE_LOCKED', path: '/', message: 'Workspace is locked. If an interrupted process is gone, run recover-lock.', objects: [] }]); }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid })); return await action(); }
  finally { await handle.close(); await fs.rm(lock, { force: true }); }
}
export async function recoverLock(dir) {
  const lock = path.join(dir, '.room-builder/lock'), value = await readJSON(lock);
  if (!Number.isInteger(value.pid) || value.pid <= 0) throw Error('Invalid lock; inspect it manually');
  try { process.kill(value.pid, 0); throw Error('Lock owner is still running; not removed'); }
  catch (e) { if (e.code !== 'ESRCH') throw e; }
  await fs.unlink(lock); return { recovered: true };
}
export async function readScene(dir) {
  const file = path.join(dir, 'scene.json');
  if ((await fs.lstat(file)).isSymbolicLink()) throw Error('scene.json must be a regular local file');
  const scene = await readJSON(file); validate(scene); return scene;
}
async function copyFile(source, dest) { await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.copyFile(source, dest); }
export async function materialize(dir, scene) {
  const compiled = validate(scene), hash = digest(scene), parent = path.join(dir, '.room-builder/builds'), dest = path.join(parent, hash);
  if (await fs.lstat(dest).then(() => true, e => { if (e.code !== 'ENOENT') throw e; return false; })) {
    const invalid = () => { throw new SceneError([{ code: 'ARTIFACT_INTEGRITY', path: '/', message: 'An immutable build was modified or is incomplete; do not export it. Restore from an intact history version.', objects: [] }]); };
    if ((await fs.lstat(dest)).isSymbolicLink()) invalid();
    const m = await readJSON(path.join(dest, 'manifest.json'));
    if (m.hash !== hash || !m.files || typeof m.files !== 'object') invalid();
    for (const [name, expected] of Object.entries(m.files)) {
      if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) invalid();
      const file = path.join(dest, name), real = await fs.realpath(file);
      if (!real.startsWith(await fs.realpath(dest) + path.sep) || (await fs.lstat(file)).isSymbolicLink() || digest(await fs.readFile(real)) !== expected) invalid();
    }
    if (digest(await readJSON(path.join(dest, 'scene.json'))) !== hash) invalid();
    return { hash, compiled, directory: dest };
  }
  await fs.mkdir(parent, { recursive: true }); const temp = path.join(parent, `.staging-${crypto.randomUUID()}`); await fs.mkdir(temp);
  try {
    for (const file of ['index.html', 'style.css']) await copyFile(path.join(packageRoot, 'assets/preview', file), path.join(temp, file));
    for (const file of ['main.mjs']) await copyFile(path.join(packageRoot, 'src/viewer', file), path.join(temp, file));
    await copyFile(path.join(packageRoot, 'src/core/collision.mjs'), path.join(temp, 'collision.mjs'));
    for (const file of ['three.module.js', 'three.core.js']) await copyFile(path.join(packageRoot, 'node_modules/three/build', file), path.join(temp, 'vendor', file));
    await copyFile(path.join(packageRoot, 'node_modules/three/examples/jsm/controls/OrbitControls.js'), path.join(temp, 'vendor/OrbitControls.js'));
    await copyFile(path.join(packageRoot, 'node_modules/three/LICENSE'), path.join(temp, 'THREE-LICENSE.txt'));
    await copyFile(path.join(packageRoot, 'LICENSE'), path.join(temp, 'LICENSE'));
    await fs.writeFile(path.join(temp, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
    await fs.writeFile(path.join(temp, 'compiled.json'), JSON.stringify({ ...compiled, hash }));
    const files = {};
    async function record(folder, prefix = '') {
      for (const e of await fs.readdir(folder, { withFileTypes: true })) {
        const rel = prefix + e.name, p = path.join(folder, e.name);
        if (e.isDirectory()) await record(p, rel + '/'); else files[rel] = digest(await fs.readFile(p));
      }
    }
    await record(temp); await fs.writeFile(path.join(temp, 'manifest.json'), JSON.stringify({ hash, revision: scene.revision, files }, null, 2));
    await fs.rename(temp, dest);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
  return { hash, compiled, directory: dest };
}
export async function createWorkspace(dir, input) {
  return locked(dir, async () => {
    try { await fs.lstat(path.join(dir, 'scene.json')); throw Error('Workspace already has scene.json; use apply'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const scene = normalize(input); scene.revision = 1;
    const build = await materialize(dir, scene);
    await writeAtomic(path.join(dir, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
    return { revision: scene.revision, hash: build.hash, furniture: scene.furniture.length };
  });
}
export async function applyChange(dir, request) {
  return locked(dir, async () => {
    const scene = changeScene(await readScene(dir), request), build = await materialize(dir, scene);
    // Builds are complete before this single authoritative commit. A crash before it
    // leaves the previous scene intact; a crash after it has a complete matching build.
    await writeAtomic(path.join(dir, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
    return { revision: scene.revision, hash: build.hash };
  });
}
export async function history(dir) {
  const parent = path.join(dir, '.room-builder/builds');
  const result = [];
  for (const e of await fs.readdir(parent, { withFileTypes: true })) if (e.isDirectory() && /^[a-f0-9]{64}$/.test(e.name)) {
    const scene = await readJSON(path.join(parent, e.name, 'scene.json'));
    result.push({ hash: e.name, revision: scene.revision, name: scene.name });
  }
  return result.sort((a, b) => a.revision - b.revision || a.hash.localeCompare(b.hash));
}
export async function restore(dir, hash, expectedRevision) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('Invalid history hash');
  return locked(dir, async () => {
    const current = await readScene(dir);
    if (current.revision !== expectedRevision) throw new SceneError([{ code: 'REVISION_CONFLICT', path: '/expectedRevision', message: 'Current revision changed', objects: [] }]);
    const scene = await readJSON(path.join(dir, '.room-builder/builds', hash, 'scene.json'));
    if (digest(scene) !== hash) throw Error('History integrity check failed');
    scene.revision = current.revision + 1; const build = await materialize(dir, scene);
    await writeAtomic(path.join(dir, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
    return { revision: scene.revision, hash: build.hash, restoredFrom: hash };
  });
}
export async function exportBuild(dir, out) {
  const build = await materialize(dir, await readScene(dir));
  if (await fs.stat(out).then(() => true, () => false)) throw Error('Export destination already exists; choose a new directory');
  await fs.mkdir(path.dirname(out), { recursive: true });
  const temp = `${out}.staging-${crypto.randomUUID()}`;
  try { await fs.cp(build.directory, temp, { recursive: true, dereference: false }); await fs.rename(temp, out); }
  finally { await fs.rm(temp, { recursive: true, force: true }); }
  return { revision: build.compiled.revision, hash: build.hash, exported: true };
}
