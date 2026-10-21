#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Local, offline distribution checks. Report file names, never suspected secret values.
export async function checkRelease(directory) {
  const root = path.resolve(directory), manifest = JSON.parse(await fs.readFile(path.join(root, 'PACKAGE-MANIFEST.json'), 'utf8'));
  const actual = [], failures = [], texts = new Map();
  const hash = b => createHash('sha256').update(b).digest('hex');
  async function visit(dir, prefix = '') {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const name = prefix + e.name;
      if (e.isSymbolicLink()) { failures.push(`Symlink: ${name}`); continue; }
      if (e.isDirectory()) await visit(path.join(dir, e.name), name + '/'); else actual.push(name);
    }
  }
  await visit(root);
  const listed = Object.keys(manifest.files || {});
  const expected = new Set([...listed, 'PACKAGE-MANIFEST.json']);
  for (const name of actual) if (!expected.has(name)) failures.push(`Unlisted file: ${name}`);
  for (const name of listed) {
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) { failures.push('Invalid manifest path'); continue; }
    if (!actual.includes(name)) { failures.push(`Missing file: ${name}`); continue; }
    if (/(^|\/)(\.git|node_modules|output|artifacts|evidence|\.env[^/]*)(\/|$)/.test(name)) failures.push(`Development/private artifact: ${name}`);
    const b = await fs.readFile(path.join(root, name));
    if (hash(b) !== manifest.files[name]) failures.push(`Hash mismatch: ${name}`);
    if (name.endsWith('.png')) {
      if (!name.startsWith('docs/demo/')) failures.push(`Unexpected image: ${name}`);
      if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') failures.push(`Invalid PNG: ${name}`);
      for (let offset = 8; offset + 12 <= b.length;) {
        const length = b.readUInt32BE(offset), type = b.subarray(offset + 4, offset + 8).toString();
        if (['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(type)) failures.push(`Image metadata: ${name}`);
        offset += length + 12;
      }
      continue;
    }
    if (!/\.(?:md|mjs|json|yaml|yml|html|css|txt)$/.test(name) && !['LICENSE', '.gitignore'].includes(name)) { failures.push(`Unexpected file format: ${name}`); continue; }
    const text = b.toString('utf8'); texts.set(name, text);
    const patterns = [
      /\/(?:Users|home)\/[a-zA-Z0-9_.-]+\//,
      /(?:[A-Z]:\\Users\\[^\\]+\\)/,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      /\bsk-[a-zA-Z0-9_-]{20,}/,
      /\b(?:ghp|github_pat)_[a-zA-Z0-9_]{20,}/,
      /\bAKIA[A-Z0-9]{16}\b/,
      /Bearer\s+[a-zA-Z0-9_.-]{20,}/,
    ];
    if (patterns.some(p => p.test(text))) failures.push(`Personal path or credential pattern: ${name}`);
  }
  for (const name of ['SKILL.md', 'README.md', 'README.zh-CN.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'scripts/room.mjs', 'src/core/spec.mjs', 'src/core/compile.mjs', 'src/core/collision.mjs', 'schemas/scene.schema.json', 'examples/lounge-demo.json']) if (!texts.has(name)) failures.push(`Required file missing: ${name}`);
  for (const [name, text] of texts) if (name.endsWith('.md')) {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const url = match[1];
      if (/^(?:https?:|mailto:|#)/.test(url) || url.includes('<')) continue;
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(name), decodeURIComponent(url.split('#')[0])));
      if (!actual.includes(relative)) failures.push(`Broken local link in ${name}: ${url}`);
    }
  }
  const metadata = JSON.parse(texts.get('package.json') || '{}'), lock = JSON.parse(texts.get('package-lock.json') || '{}');
  if (metadata.version !== manifest.version || metadata.version !== lock.version || metadata.version !== lock.packages?.['']?.version) failures.push('Version mismatch');
  if (metadata.license !== 'MIT' || !texts.get('LICENSE')?.includes('MIT License')) failures.push('Original MIT license missing');
  const inventory = JSON.parse(texts.get('third-party-licenses/inventory.json') || '[]');
  const dependencies = Object.entries(lock.packages || {}).filter(([name]) => name.startsWith('node_modules/'));
  for (const [name, dep] of dependencies) {
    const entry = inventory.find(i => i.package === name.slice('node_modules/'.length));
    if (!entry || entry.version !== dep.version || entry.license !== dep.license || !entry.source || !texts.get(`third-party-licenses/${entry.licenseFile}`)?.trim()) failures.push(`Dependency provenance/license missing: ${name}`);
    if (!dep.integrity || !dep.resolved?.startsWith('https://registry.npmjs.org/')) failures.push(`Dependency lock missing: ${name}`);
  }
  return { ok: failures.length === 0, version: metadata.version, files: listed.length, dependenciesWithLicenses: dependencies.length, failures, scope: 'Allowlisted archive, hashes, relative documentation links, dependency inventory, text patterns and PNG metadata; not proof against every possible secret or future user asset.' };
}
const invokedDirectly = process.argv[1] && await fs.realpath(process.argv[1]).catch(() => null) === await fs.realpath(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try { if (!process.argv[2]) throw Error('Usage: node scripts/release-check.mjs INSTALLABLE_DIRECTORY'); const result = await checkRelease(process.argv[2]); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1; }
  catch (e) { console.error(JSON.stringify({ ok: false, message: e.message })); process.exitCode = 1; }
}
