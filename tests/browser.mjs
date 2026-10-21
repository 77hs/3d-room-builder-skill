import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createWorkspace, applyChange, exportBuild, readScene, digest } from '../src/workspace.mjs';
import { validate } from '../src/core/spec.mjs';
import { canOccupy } from '../src/core/collision.mjs';
import { serve } from '../src/server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), out = path.resolve(process.env.ROOM_BUILDER_EVIDENCE || path.join(root, 'artifacts/browser'));
await fs.mkdir(out, { recursive: true });
const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'room-builder-browser-')), servers = [], errors = [], externalRequests = [], checks = [], resourceSamples = [];
let browser;
const sample = async name => JSON.parse(await fs.readFile(path.join(root, 'examples', name), 'utf8'));
const start = async options => { const s = await serve({ ...options, port: 0 }); servers.push(s); return `http://127.0.0.1:${s.address().port}/`; };
const close = s => new Promise(resolve => s.close(resolve));
try {
  browser = await chromium.launch({ headless: true, ...(process.env.ROOM_BUILDER_BROWSER_CHANNEL ? { channel: process.env.ROOM_BUILDER_BROWSER_CHANNEL } : {}), args: ['--use-angle=swiftshader', '--enable-webgl'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { externalRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  async function ready(revision) {
    await page.waitForFunction(rev => document.querySelector('#scene')?.dataset.ready === 'true' && document.querySelector('#scene').dataset.revision === String(rev), revision, { timeout: 45000 });
    assert.equal(await page.locator('#error').isVisible(), false);
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
  }
  const position = () => page.locator('#scene').getAttribute('data-position').then(JSON.parse);
  const aDir = path.join(parent, 'bedroom'), bDir = path.join(parent, 'study');
  await createWorkspace(aDir, await sample('a-bedroom.json'));
  const aURL = await start({ dir: aDir }); await page.goto(aURL); await ready(1);
  await page.screenshot({ path: path.join(out, 'a-bedroom.png') }); checks.push('A: actual overview rendered with bedroom furniture and dimensions');
  const compiledA = validate(await readScene(aDir));
  await page.getByRole('button', { name: '◉ First person', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#scene').dataset.mode === 'walk');
  const before = await position(); await page.keyboard.down('KeyW'); await page.waitForTimeout(2200); await page.keyboard.up('KeyW');
  const after = await position(); assert.ok(after.z > before.z + .15); assert.ok(canOccupy(after.x, after.z, compiledA)); assert.ok(after.z < 2.91);
  await page.keyboard.down('KeyA'); await page.waitForTimeout(1400); await page.keyboard.up('KeyA');
  const side = await position(); assert.ok(side.x >= compiledA.player.radius - 1e-5); assert.ok(canOccupy(side.x, side.z, compiledA));
  await page.getByRole('button', { name: 'Reset position', exact: true }).click();
  await page.waitForFunction(spawn => { const p = JSON.parse(document.querySelector('#scene').dataset.position); return Math.abs(p.x - spawn.x) < .001 && Math.abs(p.z - spawn.z) < .001; }, compiledA.spawn);
  await page.screenshot({ path: path.join(out, 'a-walking.png') });
  checks.push('A: real keyboard movement, furniture/floor collision and reset verified');
  await createWorkspace(bDir, await sample('b-study.json'));
  const bURL = await start({ dir: bDir }); await page.goto(bURL); await ready(1); await page.screenshot({ path: path.join(out, 'b-study.png') });
  assert.equal(await page.locator('#furniture li').count(), 5); checks.push('B: distinct two-desk room actually loaded');
  await applyChange(bDir, await sample('c-study.change.json')); await ready(2); await page.screenshot({ path: path.join(out, 'c-study-edited.png') });
  assert.equal(await page.locator('#dimensions').innerText(), '4.2 × 5.8 m');
  assert.equal(await page.locator('#furniture li').filter({ hasText: 'chair b' }).count(), 0); assert.equal(await page.locator('#furniture li').filter({ hasText: 'cabinet' }).count(), 1);
  checks.push('C: existing B live-updated dimensions, rotation and furniture add/remove');
  const beforeInvalid = digest(await fs.readFile(path.join(bDir, 'scene.json'))), urlBefore = page.url();
  for (const name of ['overlap', 'bounds', 'door', 'spawn']) await assert.rejects(applyChange(bDir, await sample(`d-${name}.change.json`)));
  assert.equal(digest(await fs.readFile(path.join(bDir, 'scene.json'))), beforeInvalid); assert.equal(page.url(), urlBefore); await ready(2);
  checks.push('D: all four invalid edits rejected; committed scene and live preview retained');
  for (let i = 0; i < 6; i++) {
    await applyChange(bDir, { expectedRevision: i + 2, operations: [{ op: 'setMaterial', id: 'wall', value: { color: i % 2 ? '#e8e4db' : '#e2e8dd' } }] });
    await ready(i + 3); await page.getByRole('button', { name: '◉ First person', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#scene').dataset.mode === 'walk');
    resourceSamples.push(JSON.parse(await page.locator('#scene').getAttribute('data-resources')));
  }
  const first = resourceSamples[0]; for (const r of resourceSamples) { assert.equal(r.canvases, 1); assert.equal(r.geometries, first.geometries); assert.equal(r.textures, first.textures); assert.ok(r.programs <= first.programs + 1); }
  checks.push('Six consecutive live edits: scene state resets cleanly, one canvas and stable renderer resource counts');
  const exported = path.join(parent, 'exported-room'); await exportBuild(bDir, exported);
  const expectedRevision = (await readScene(bDir)).revision; await close(servers.pop()); await fs.rm(bDir, { recursive: true });
  const staticURL = await start({ staticDir: exported }); await page.goto(staticURL); await ready(expectedRevision);
  await page.getByRole('button', { name: '◉ First person', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#scene').dataset.mode === 'walk');
  checks.push('Exported site renders and walks after the source workspace is deleted');
  const blocked = await context.request.get(staticURL + '../package.json'); assert.equal(blocked.status(), 404);
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  const report = { result: 'PASS', browser: `headless Chromium${process.env.ROOM_BUILDER_BROWSER_CHANNEL ? ' / channel ' + process.env.ROOM_BUILDER_BROWSER_CHANNEL : ''}`, rendering: 'SwiftShader for deterministic CI; not a physical GPU performance test', checks, resourceSamples, errors, externalRequests, actualPhoneTests: false, at: new Date().toISOString() };
  await fs.writeFile(path.join(out, 'browser.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} catch (e) {
  await fs.writeFile(path.join(out, 'failure.json'), JSON.stringify({ result: 'FAIL', message: e.message, stack: e.stack, checks, errors, externalRequests }, null, 2)); throw e;
} finally {
  await browser?.close(); await Promise.all(servers.map(close)); await fs.rm(parent, { recursive: true, force: true });
}
