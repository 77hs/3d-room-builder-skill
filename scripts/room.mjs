#!/usr/bin/env node
import path from 'node:path';
import { createWorkspace, applyChange, exportBuild, readJSON, readScene, history, restore, recoverLock } from '../src/workspace.mjs';
import { normalize, validate } from '../src/core/spec.mjs';
import { serve } from '../src/server.mjs';

const [command, ...args] = process.argv.slice(2), flags = {};
const help = `3D Room Builder (Node >=22)
  create --scene INPUT.json --dir WORKSPACE
  validate --scene INPUT.json | --dir WORKSPACE
  apply --dir WORKSPACE --change CHANGE.json
  build --dir WORKSPACE --out NEW_DIRECTORY
  serve --dir WORKSPACE [--port 5173]
  serve --static EXPORTED_PREVIEW [--port 5173]
  history --dir WORKSPACE
  restore --dir WORKSPACE --hash HASH --expected REVISION
  recover-lock --dir WORKSPACE
All commands report JSON. Invalid inputs exit 2. No automatic rearrangement.`;
try {
  if (!command || ['help', '--help'].includes(command)) { console.log(help); process.exit(0); }
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--[a-z]+$/.test(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || flags[args[i].slice(2)] !== undefined) throw Error('Expected unique --flag value pairs');
    flags[args[i].slice(2)] = args[i + 1];
  }
  const permitted = { create: ['scene', 'dir'], validate: ['scene', 'dir'], apply: ['dir', 'change'], build: ['dir', 'out'], serve: ['dir', 'static', 'port'], history: ['dir'], restore: ['dir', 'hash', 'expected'], 'recover-lock': ['dir'] }[command];
  if (!permitted || Object.keys(flags).some(k => !permitted.includes(k))) throw Error('Unknown command or flag; run --help');
  const required = key => { if (!flags[key]) throw Error(`Missing --${key}`); return flags[key]; };
  const dir = () => path.resolve(required('dir'));
  let result;
  if (command === 'create') result = await createWorkspace(dir(), await readJSON(required('scene')));
  else if (command === 'validate') { if (!!flags.scene === !!flags.dir) throw Error('Choose --scene or --dir'); const c = flags.scene ? validate(normalize(await readJSON(flags.scene))) : validate(await readScene(dir())); result = { valid: true, revision: c.revision, primitives: c.primitives.length, colliders: c.colliders.length }; }
  else if (command === 'apply') result = await applyChange(dir(), await readJSON(required('change')));
  else if (command === 'build') result = await exportBuild(dir(), path.resolve(required('out')));
  else if (command === 'history') result = { versions: await history(dir()) };
  else if (command === 'restore') result = await restore(dir(), required('hash'), Number(required('expected')));
  else if (command === 'recover-lock') result = await recoverLock(dir());
  else if (command === 'serve') {
    if (!!flags.dir === !!flags.static) throw Error('Choose --dir or --static');
    const port = Number(flags.port ?? 5173); if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid port');
    const server = await serve({ dir: flags.dir && dir(), staticDir: flags.static && path.resolve(flags.static), port });
    result = { url: `http://127.0.0.1:${server.address().port}/`, mode: flags.dir ? 'workspace' : 'standalone' };
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
  }
  console.log(JSON.stringify({ ok: true, ...result }));
} catch (e) { console.error(JSON.stringify({ ok: false, errors: e.errors || [{ code: e.code || 'COMMAND', path: '/', message: e.message, objects: [] }] })); process.exitCode = 2; }
