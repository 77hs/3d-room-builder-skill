import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { normalize, validate, changeScene, SceneError } from '../src/core/spec.mjs';
import { bounds, canOccupy, move } from '../src/core/collision.mjs';
const example = async name => JSON.parse(await fs.readFile(new URL('../examples/' + name, import.meta.url), 'utf8'));
const fails = (fn, code) => assert.throws(fn, e => e instanceof SceneError && e.errors.some(x => x.code === code));

test('A and B have different dimensions, wall openings, furniture and compiled geometry', async () => {
  const a = validate(normalize(await example('a-bedroom.json'))), b = validate(normalize(await example('b-study.json')));
  assert.notDeepEqual(a.room, b.room); assert.notDeepEqual(a.doorZones, b.doorZones); assert.notDeepEqual(a.furnitureBounds, b.furnitureBounds);
  assert.notEqual(a.primitives.length, b.primitives.length);
  assert.ok(a.primitives.some(p => p.id === 'bed/mattress')); assert.ok(!b.primitives.some(p => p.id.startsWith('bed/')));
});
test('C edits B in one transaction and preserves unspecified objects and fields', async () => {
  const b = normalize(await example('b-study.json')), copy = structuredClone(b), c = changeScene(b, await example('c-study.change.json'));
  assert.deepEqual(b, copy); assert.equal(c.revision, 2); assert.equal(c.room.width, 4.2); assert.equal(c.room.depth, 5.8);
  for (const id of ['desk-b', 'chair-a']) assert.deepEqual(c.furniture.find(f => f.id === id), b.furniture.find(f => f.id === id));
  assert.deepEqual(c.openings, b.openings); assert.deepEqual(c.spawn, b.spawn); assert.equal(c.furniture.find(f => f.id === 'desk-a').rotation, 90);
  assert.ok(!c.furniture.some(f => f.id === 'chair-b')); assert.ok(c.furniture.some(f => f.id === 'cabinet'));
  assert.equal(c.materials.fabric.roughness, b.materials.fabric.roughness); assert.equal(c.lights.ambient.color, b.lights.ambient.color);
  assert.notDeepEqual(validate(b).furnitureBounds, validate(c).furnitureBounds);
});
test('D rejects overlap, out of bounds, blocked door and invalid spawn independently', async () => {
  const c = changeScene(normalize(await example('b-study.json')), await example('c-study.change.json'));
  for (const [name, code] of [['overlap', 'OVERLAP'], ['bounds', 'OUT_OF_BOUNDS'], ['door', 'DOOR_BLOCKED'], ['spawn', 'INVALID_SPAWN']])
    fails(() => changeScene(c, JSON.parse(JSON.stringify(fixtures[name]))), code);
});
const fixtures = Object.fromEntries(await Promise.all(['overlap', 'bounds', 'door', 'spawn'].map(async name => [name, await example(`d-${name}.change.json`)])));

test('strict schema rejects unknown fields, invalid rotations, duplicate IDs, refs and openings', async () => {
  const source = normalize(await example('a-bedroom.json'));
  for (const [edit, code] of [
    [s => { s.furniture[0].rotation = 45; }, 'SCHEMA'], [s => { s.room.width = 0; }, 'SCHEMA'],
    [s => { s.room.unused = 1; }, 'SCHEMA'], [s => { s.furniture[0].material = 'missing'; }, 'MATERIAL_REF'],
    [s => { s.furniture[1].id = s.furniture[0].id; }, 'DUPLICATE_ID'],
    [s => { s.openings[0].height = 1; }, 'DOOR_SIZE'], [s => { s.openings[1].offset = 4.5; }, 'OPENING_BOUNDS'],
    [s => { s.openings.push({ ...s.openings[1], id: 'another-window' }); }, 'OPENING_OVERLAP'],
    [s => { s.lights.points[0].y = 9; }, 'LIGHT_BOUNDS'], [s => { s.furniture[0].height = 3.5; }, 'FURNITURE_HEIGHT']
  ]) { const s = structuredClone(source); edit(s); fails(() => validate(s), code); }
});
test('malformed creation shapes and nonfinite numbers produce validation errors', () => {
  for (const value of [{ room: null }, { room: [] }, { furniture: [null] }, { openings: 'door' }, { materials: 3 }]) fails(() => normalize(value), 'SCHEMA');
  const s = normalize({ room: { width: 4, depth: 4 } }); s.room.width = Infinity; fails(() => validate(s), 'SCHEMA');
});
test('occupied width/depth rotate exactly as rendered for all orthogonal turns', () => {
  assert.deepEqual(bounds(2, 3, 1.4, .6, 90), bounds(2, 3, .6, 1.4, 0));
  assert.deepEqual(bounds(2, 3, 1.4, .6, 270), bounds(2, 3, 1.4, .6, 90));
  assert.deepEqual(bounds(2, 3, 1.4, .6, 180), bounds(2, 3, 1.4, .6, 0));
});
test('conservative route validation detects a partition of furniture away from the door buffer', () => {
  const s = normalize({ room: { width: 4, depth: 5 }, spawn: { x: 1, z: 1, yaw: 0 }, openings: [{ id: 'door', type: 'door', wall: 'north', offset: .5, width: .9, height: 2.2 }], furniture: [{ id: 'barrier', kind: 'wardrobe', x: 2, z: 2.5, width: 4, depth: .4, height: 2 }] });
  fails(() => validate(s), 'NO_ROUTE');
});
test('repeated light patches compose; stale revisions, renamed IDs and malformed operations fail', async () => {
  const s = normalize(await example('b-study.json'));
  const c = changeScene(s, { expectedRevision: 1, operations: [{ op: 'setLights', patch: { ambient: { intensity: 1.8 } } }, { op: 'setLights', patch: { ambient: { color: '#aabbcc' } } }] });
  assert.deepEqual(c.lights.ambient, { intensity: 1.8, color: '#aabbcc' });
  fails(() => changeScene(c, { expectedRevision: 1, operations: [{ op: 'setRoom', patch: { width: 5 } }] }), 'REVISION_CONFLICT');
  fails(() => changeScene(s, { expectedRevision: 1, operations: [{ op: 'updateFurniture', id: 'desk-a', patch: { id: 'new-id' } }] }), 'CHANGE_REQUEST');
  fails(() => changeScene(s, { expectedRevision: 1, operations: [{ op: 'updateFurniture', id: 'absent', patch: {} }] }), 'CHANGE_REQUEST');
  fails(() => changeScene(s, { expectedRevision: 1, operations: [] }), 'CHANGE_REQUEST');
});
test('parameter combinations and seeded large movement never leave valid floor or penetrate furniture', () => {
  let seed = 918273;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2 ** 32; };
  for (const w of [2, 3.1, 7.6, 20]) for (const d of [2, 4.9, 12, 20]) for (const wall of ['south', 'north', 'east', 'west']) {
    const length = ['north', 'south'].includes(wall) ? w : d;
    const scene = normalize({ room: { width: w, depth: d }, spawn: { x: w / 2, z: d / 2, yaw: 0 }, openings: [{ id: 'entry', type: 'door', wall, offset: (length - .9) / 2, width: .9, height: 2.1 }] });
    const c = validate(scene), body = { ...scene.spawn };
    for (let i = 0; i < 150; i++) { move(body, (random() - .5) * 8, (random() - .5) * 8, c); assert.ok(canOccupy(body.x, body.z, c)); }
  }
});
test('visible furniture components fit their declared collision bounds at every turn', async () => {
  for (const kind of ['bed', 'desk', 'chair', 'wardrobe', 'bookshelf', 'sofa', 'table']) for (const rotation of [0, 90, 180, 270]) {
    const c = validate(normalize({ room: { width: 6, depth: 6 }, spawn: { x: 1, z: 1, yaw: 0 }, furniture: [{ id: 'item', kind, x: 3, z: 3, width: 1.4, depth: .8, height: 1.2, rotation }] }));
    const envelope = c.furnitureBounds[0];
    for (const p of c.primitives.filter(p => p.category === 'furniture')) {
      const b = bounds(p.x, p.z, p.width, p.depth, p.rotation);
      assert.ok(b.minX >= envelope.minX - 1e-6 && b.maxX <= envelope.maxX + 1e-6 && b.minZ >= envelope.minZ - 1e-6 && b.maxZ <= envelope.maxZ + 1e-6, `${kind}/${p.id}`);
      assert.ok(p.y - p.height / 2 >= -1e-6 && p.y + p.height / 2 <= 1.2 + 1e-6);
    }
  }
});
test('opening add/update/remove regenerates the wall and leaves other scene objects untouched', async () => {
  const s = normalize(await example('b-study.json'));
  const c = changeScene(s, { expectedRevision: 1, operations: [
    { op: 'updateOpening', id: 'north-window', patch: { offset: 1.1, width: 1.2 } },
    { op: 'removeOpening', id: 'east-window' },
    { op: 'addOpening', value: { id: 'south-window', type: 'window', wall: 'south', offset: 1, width: .8, height: 1, sill: 1.1 } }
  ] });
  assert.deepEqual(s.furniture, c.furniture); assert.deepEqual(s.materials, c.materials);
  assert.equal(c.openings.find(o => o.id === 'north-window').width, 1.2);
  const old = validate(s), fresh = validate(c);
  assert.ok(fresh.primitives.some(p => p.id === 'glass-south-window'));
  assert.ok(!fresh.primitives.some(p => p.id === 'glass-east-window'));
  assert.notDeepEqual(old.primitives, fresh.primitives);
});
