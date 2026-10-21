import fs from 'node:fs';
import Ajv from 'ajv';
import { compile } from './compile.mjs';
import { EPS, intersects, canOccupy, segmentClear } from './collision.mjs';

const schema = JSON.parse(fs.readFileSync(new URL('../../schemas/scene.schema.json', import.meta.url), 'utf8'));
const check = new Ajv({ allErrors: true, strict: true }).compile(schema);
export class SceneError extends Error {
  constructor(errors) { super(errors.map(e => `${e.code}: ${e.message}`).join('\n')); this.name = 'SceneError'; this.errors = errors; }
}
const issue = (code, path, message, objects = []) => ({ code, path, message, objects });
export function normalize(input) {
  const s = structuredClone(input);
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new SceneError([issue('SCHEMA', '/', 'Scene must be an object')]);
  for (const key of ['room', 'materials', 'lights', 'player', 'spawn']) if (key in s && (!s[key] || typeof s[key] !== 'object' || Array.isArray(s[key])))
    throw new SceneError([issue('SCHEMA', '/' + key, `${key} must be an object`)]);
  for (const key of ['openings', 'furniture']) if (key in s && (!Array.isArray(s[key]) || s[key].some(o => !o || typeof o !== 'object' || Array.isArray(o))))
    throw new SceneError([issue('SCHEMA', '/' + key, `${key} must be an array of objects`)]);
  s.schemaVersion ??= 1; s.revision ??= 1; s.name ??= 'Untitled room'; s.units ??= 'm';
  if (s.room && typeof s.room === 'object') s.room = { height: 2.8, wallThickness: .12, ...s.room };
  s.openings ??= []; s.furniture ??= [];
  if (Array.isArray(s.openings)) s.openings = s.openings.map(o => ({ sill: o.type === 'door' ? 0 : 1, ...o }));
  if (Array.isArray(s.furniture)) s.furniture = s.furniture.map(f => ({ rotation: 0, material: 'wood', ...f }));
  const defaults = { wall: '#eee9df', floor: '#bca488', ceiling: '#f5f2e9', wood: '#b18b65', fabric: '#6b8586', metal: '#485458', glass: '#bbdadd' };
  s.materials = { ...Object.fromEntries(Object.entries(defaults).map(([id, color]) => [id, { color, roughness: .8 }])), ...s.materials };
  s.lights = { ambient: { color: '#ffffff', intensity: 1.35 }, sun: { color: '#fff0da', intensity: 2.0 }, points: [], ...s.lights };
  s.player = { radius: .22, eyeHeight: 1.6, speed: 2.1, ...s.player };
  s.spawn ??= { x: 1, z: 1, yaw: 180 };
  return s;
}
export function validate(scene) {
  if (!check(scene)) throw new SceneError(check.errors.map(e => issue('SCHEMA', e.instancePath || '/', e.message, [])));
  const errors = [], seen = new Set(), { width: w, depth: d, height: h } = scene.room;
  const add = (...args) => errors.push(issue(...args));
  for (const [category, list] of [['openings', scene.openings], ['furniture', scene.furniture], ['lights/points', scene.lights.points]]) {
    for (const [i, o] of list.entries()) {
      if (seen.has(o.id)) add('DUPLICATE_ID', `/${category}/${i}/id`, `ID ${o.id} is not unique`, [o.id]);
      seen.add(o.id);
    }
  }
  for (const [i, o] of scene.openings.entries()) {
    const length = ['north', 'south'].includes(o.wall) ? w : d;
    if (o.offset + o.width > length + EPS || o.sill + o.height > h + EPS)
      add('OPENING_BOUNDS', `/openings/${i}`, `${o.id} extends beyond its wall`, [o.id]);
    if (o.type === 'door' && (o.sill !== 0 || o.width < 2 * scene.player.radius + .15 || o.height < scene.player.eyeHeight + .2))
      add('DOOR_SIZE', `/openings/${i}`, `${o.id} must start at floor level and fit the player`, [o.id]);
    if (o.type === 'window' && o.sill < .3) add('WINDOW_SILL', `/openings/${i}`, `${o.id} requires a sill of at least 0.3m`, [o.id]);
    for (const other of scene.openings.slice(i + 1)) if (other.wall === o.wall && o.offset < other.offset + other.width - EPS && other.offset < o.offset + o.width - EPS)
      add('OPENING_OVERLAP', `/openings/${i}`, `${o.id} and ${other.id} overlap on ${o.wall} wall`, [o.id, other.id]);
  }
  for (const [i, f] of scene.furniture.entries()) {
    if (!(f.material in scene.materials)) add('MATERIAL_REF', `/furniture/${i}/material`, `Unknown material ${f.material}`, [f.id]);
    if (f.height > h - .05) add('FURNITURE_HEIGHT', `/furniture/${i}/height`, `${f.id} does not fit below the ceiling`, [f.id]);
  }
  for (const [i, p] of scene.lights.points.entries()) if (p.x < 0 || p.x > w || p.z < 0 || p.z > d || p.y <= .05 || p.y >= h)
    add('LIGHT_BOUNDS', `/lights/points/${i}`, `${p.id} must be inside the room`, [p.id]);
  if (scene.player.eyeHeight + .15 >= h) add('PLAYER_HEIGHT', '/player/eyeHeight', 'Player must fit below the ceiling');
  if (errors.length) throw new SceneError(errors);
  const result = compile(scene);
  for (const [i, a] of result.furnitureBounds.entries()) {
    if (a.minX < -EPS || a.minZ < -EPS || a.maxX > w + EPS || a.maxZ > d + EPS)
      add('OUT_OF_BOUNDS', `/furniture/${i}`, `${a.id} extends outside the room after rotation`, [a.id]);
    for (const b of result.furnitureBounds.slice(i + 1)) if (intersects(a, b))
      add('OVERLAP', `/furniture/${i}`, `${a.id} overlaps ${b.id}`, [a.id, b.id]);
    for (const door of result.doorZones) if (intersects(a, door))
      add('DOOR_BLOCKED', `/furniture/${i}`, `${a.id} blocks the 0.8m minimum approach zone of ${door.id}`, [a.id, door.id]);
  }
  if (!canOccupy(scene.spawn.x, scene.spawn.z, result)) add('INVALID_SPAWN', '/spawn', 'Spawn is outside the walkable floor or inside an obstacle');
  if (errors.length) throw new SceneError(errors);
  // Conservative 0.1m flood sampling, with continuous segment checks between cells.
  const step = .1, gridKey = (i, j) => `${i},${j}`, point = (i, j) => ({ x: scene.player.radius + i * step, z: scene.player.radius + j * step });
  if (result.doorZones.length) {
    const start = { i: Math.round((scene.spawn.x - scene.player.radius) / step), j: Math.round((scene.spawn.z - scene.player.radius) / step) };
    const startP = point(start.i, start.j), visited = new Set(), queue = [];
    if (segmentClear(scene.spawn, startP, result)) { queue.push(start); visited.add(gridKey(start.i, start.j)); }
    const targets = new Set();
    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index], p = point(cell.i, cell.j);
      for (const zone of result.doorZones) if (!targets.has(zone.id) && Math.hypot(p.x - zone.target.x, p.z - zone.target.z) < .16 && segmentClear(p, zone.target, result)) targets.add(zone.id);
      if (targets.size === result.doorZones.length) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { i: cell.i + di, j: cell.j + dj }, key = gridKey(next.i, next.j), q = point(next.i, next.j);
        if (!visited.has(key) && canOccupy(q.x, q.z, result) && segmentClear(p, q, result)) { visited.add(key); queue.push(next); }
      }
    }
    for (const zone of result.doorZones) if (!targets.has(zone.id)) add('NO_ROUTE', '/spawn', `No sampled player-width route from spawn to ${zone.id}`, [zone.id]);
  }
  if (errors.length) throw new SceneError(errors);
  return result;
}

export function changeScene(current, request) {
  const reject = message => { throw new SceneError([issue('CHANGE_REQUEST', '/', message)]); };
  if (!request || !Number.isInteger(request.expectedRevision) || !Array.isArray(request.operations) || !request.operations.length || Object.keys(request).some(k => !['expectedRevision', 'operations'].includes(k))) reject('Supply expectedRevision and a nonempty operations array');
  if (request.expectedRevision !== current.revision) throw new SceneError([issue('REVISION_CONFLICT', '/expectedRevision', `Expected revision ${request.expectedRevision}, actual ${current.revision}`)]);
  const next = structuredClone(current);
  for (const op of request.operations) {
    if (!op || typeof op !== 'object') reject('Each operation must be an object');
    const allowed = { setRoom: ['op', 'patch'], setSpawn: ['op', 'patch'], setLights: ['op', 'patch'], setMaterial: ['op', 'id', 'value'],
      addFurniture: ['op', 'value'], updateFurniture: ['op', 'id', 'patch'], removeFurniture: ['op', 'id'],
      addOpening: ['op', 'value'], updateOpening: ['op', 'id', 'patch'], removeOpening: ['op', 'id'] }[op.op];
    if (!allowed || Object.keys(op).some(k => !allowed.includes(k)) || allowed.some(k => !(k in op))) reject(`Invalid operation ${String(op.op)}`);
    if (['setRoom', 'setSpawn', 'setLights', 'updateFurniture', 'updateOpening'].includes(op.op) && (!op.patch || typeof op.patch !== 'object' || Array.isArray(op.patch))) reject('patch must be an object');
    if (op.op === 'setRoom') next.room = { ...next.room, ...op.patch };
    else if (op.op === 'setSpawn') next.spawn = { ...next.spawn, ...op.patch };
    else if (op.op === 'setLights') {
      const previous = next.lights;
      next.lights = { ...previous, ...op.patch };
      for (const key of ['ambient', 'sun']) if (op.patch[key]) next.lights[key] = { ...previous[key], ...op.patch[key] };
    } else if (op.op === 'setMaterial') {
      if (!/^[a-z][a-z0-9-]{0,47}$/.test(op.id)) reject('Invalid material ID');
      if (!op.value || typeof op.value !== 'object' || Array.isArray(op.value)) reject('Material value must be an object');
      next.materials[op.id] = { ...next.materials[op.id], ...op.value };
    } else {
      const list = op.op.endsWith('Furniture') ? 'furniture' : 'openings';
      if (op.op.startsWith('add')) {
        if (!op.value || typeof op.value !== 'object') reject('value must be an object');
        next[list].push({ ...(list === 'furniture' ? { rotation: 0, material: 'wood' } : { sill: op.value.type === 'door' ? 0 : 1 }), ...op.value });
      } else {
        const index = next[list].findIndex(o => o.id === op.id);
        if (index < 0) reject(`Unknown ${list} ID ${op.id}`);
        if (op.op.startsWith('remove')) next[list].splice(index, 1);
        else { if ('id' in op.patch) reject('Stable object IDs cannot be changed'); next[list][index] = { ...next[list][index], ...op.patch }; }
      }
    }
  }
  next.revision++;
  validate(next);
  return next;
}
