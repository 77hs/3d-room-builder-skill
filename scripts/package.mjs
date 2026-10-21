#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { packageRoot, digest } from '../src/workspace.mjs';
const target = process.argv[2];
if (!target) throw Error('Usage: node scripts/package.mjs NEW_DESTINATION');
const dest = path.resolve(target), skillRoot = path.resolve(packageRoot);
if (dest === skillRoot || dest.startsWith(skillRoot + path.sep)) throw Error('Package outside the Skill directory to avoid duplicate discovery');
if (await fs.stat(dest).then(() => true, () => false)) throw Error('Destination exists; refusing to overwrite');
const include = ['.gitignore', 'SKILL.md', 'README.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'PROJECT_STATUS.md', '.github', 'docs/DEMO.md', 'docs/VALIDATION.md', 'docs/validation-summary.json', 'docs/RELEASE_NOTES.md', 'docs/RELEASE_CHECKLIST.md', 'docs/demo', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'third-party-licenses', 'package.json', 'package-lock.json', 'agents', 'scripts', 'src', 'schemas', 'references', 'assets', 'examples', 'tests'];
await fs.mkdir(dest, { recursive: true });
for (const name of include) await fs.cp(path.join(packageRoot, name), path.join(dest, name), { recursive: true, dereference: false });
const metadata = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const files = {};
async function visit(dir, prefix = '') { for (const e of await fs.readdir(dir, { withFileTypes: true })) { const rel = prefix + e.name, p = path.join(dir, e.name); if (e.isSymbolicLink()) throw Error('Symlinks are not allowed in the installable package'); if (e.isDirectory()) await visit(p, rel + '/'); else files[rel] = digest(await fs.readFile(p)); } }
await visit(dest); await fs.writeFile(path.join(dest, 'PACKAGE-MANIFEST.json'), JSON.stringify({ version: metadata.version, files }, null, 2) + '\n');
console.log(JSON.stringify({ packaged: true, files: Object.keys(files).length, dependenciesIncluded: false, install: 'npm ci --omit=dev --ignore-scripts' }));
