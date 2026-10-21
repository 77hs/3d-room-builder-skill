import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkRelease } from '../scripts/release-check.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = data => createHash('sha256').update(data).digest('hex');

async function fixture(fn) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'room-release-'));
  const dest = path.join(parent, 'Path with spaces', '3d-room-builder-skill');
  try {
    const p = spawnSync(process.execPath, [path.join(root, 'scripts/package.mjs'), dest], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr); await fn(dest);
  } finally { await fs.rm(parent, { recursive: true, force: true }); }
}
test('distribution is self-contained, has working local docs, exact licenses and a runnable offline checker in a path with spaces', async () => fixture(async dest => {
  const nested = spawnSync(process.execPath, [path.join(root, 'scripts/package.mjs'), path.join(root, 'artifacts', 'nested-test-package')], { encoding: 'utf8' });
  assert.notEqual(nested.status, 0); assert.match(nested.stderr, /outside the Skill directory/);
  await assert.rejects(fs.stat(path.join(root, 'artifacts', 'nested-test-package')), { code: 'ENOENT' });
  const result = await checkRelease(dest); assert.equal(result.ok, true, result.failures.join('\n'));
  const executable = spawnSync(process.execPath, [path.join(dest, 'scripts/release-check.mjs'), dest], { encoding: 'utf8' });
  assert.equal(executable.status, 0, executable.stderr); assert.equal(JSON.parse(executable.stdout).ok, true);
  assert.equal(result.dependenciesWithLicenses, 8);
  for (const name of ['node_modules', '.git', '.env', 'output', 'artifacts', 'docs/evidence']) await assert.rejects(fs.stat(path.join(dest, name)), { code: 'ENOENT' });
  const p = spawnSync(process.execPath, [path.join(root, 'scripts/package.mjs'), dest], { encoding: 'utf8' });
  assert.notEqual(p.status, 0, 'must not overwrite an existing destination');
}));
test('release gate rejects modified files, injected personal paths, unlisted artifacts and symlinks', async () => fixture(async dest => {
  const file = path.join(dest, 'README.md'), original = await fs.readFile(file), manifestFile = path.join(dest, 'PACKAGE-MANIFEST.json');
  await fs.appendFile(file, '\nChanged after packaging\n'); assert.ok((await checkRelease(dest)).failures.some(f => f.startsWith('Hash mismatch: README.md')));
  const injected = Buffer.from(original.toString() + '\n' + ['/', 'Users', '/', 'example-user', '/', 'private-room'].join('') + '\n');
  await fs.writeFile(file, injected); const m = JSON.parse(await fs.readFile(manifestFile)); m.files['README.md'] = sha(injected); await fs.writeFile(manifestFile, JSON.stringify(m));
  assert.ok((await checkRelease(dest)).failures.some(f => f.includes('Personal path or credential pattern: README.md')));
  await fs.writeFile(path.join(dest, '.env'), 'EXAMPLE=local-only'); assert.ok((await checkRelease(dest)).failures.some(f => f.includes('Unlisted file: .env')));
  await fs.symlink('README.md', path.join(dest, 'unexpected-link')); assert.ok((await checkRelease(dest)).failures.some(f => f.includes('Symlink: unexpected-link')));
}));
