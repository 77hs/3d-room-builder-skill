import { bounds } from './collision.mjs';

// Every visible solid and movement collider is derived from this one intermediate scene.
export function compile(scene) {
  const { room } = scene, { width: w, depth: d, height: h, wallThickness: t } = room;
  const primitives = [], colliders = [], furnitureBounds = [], doorZones = [];
  function box(id, x, y, z, width, height, depth, material, { rotation = 0, solid = false, category = 'structure' } = {}) {
    const p = { id, x, y, z, width, height, depth, material, rotation, category };
    primitives.push(p);
    if (solid && y - height / 2 < scene.player.eyeHeight + .15 && y + height / 2 > .05)
      colliders.push({ id, ...bounds(x, z, width, depth, rotation) });
  }
  box('floor', w / 2, -.06, d / 2, w + 2 * t, .12, d + 2 * t, 'floor');
  box('ceiling', w / 2, h + .05, d / 2, w + 2 * t, .10, d + 2 * t, 'ceiling', { category: 'ceiling' });
  for (const wall of ['south', 'north', 'west', 'east']) {
    const horizontal = wall === 'south' || wall === 'north', length = horizontal ? w : d;
    const at = wall === 'south' || wall === 'west' ? -t / 2 : (horizontal ? d : w) + t / 2;
    const along = (id, start, end, bottom, top, material = 'wall', solid = true) => {
      if (end - start < 1e-6 || top - bottom < 1e-6) return;
      box(id, horizontal ? (start + end) / 2 : at, (bottom + top) / 2, horizontal ? at : (start + end) / 2,
        horizontal ? end - start : t, top - bottom, horizontal ? t : end - start, material, { solid });
    };
    let cursor = 0, index = 0;
    for (const op of scene.openings.filter(o => o.wall === wall).sort((a, b) => a.offset - b.offset)) {
      const end = op.offset + op.width;
      along(`wall-${wall}-${index++}`, cursor, op.offset, 0, h);
      along(`wall-${wall}-${index++}`, op.offset, end, 0, op.sill);
      along(`wall-${wall}-${index++}`, op.offset, end, op.sill + op.height, h);
      // Frame pieces use the same opening dimensions; windows are fixed, solid glass.
      along(`frame-${op.id}-left`, op.offset, op.offset + .045, op.sill, op.sill + op.height, 'wood');
      along(`frame-${op.id}-right`, end - .045, end, op.sill, op.sill + op.height, 'wood');
      along(`frame-${op.id}-top`, op.offset, end, op.sill + op.height - .045, op.sill + op.height, 'wood');
      if (op.type === 'window') {
        along(`glass-${op.id}`, op.offset + .045, end - .045, op.sill, op.sill + op.height - .045, 'glass');
        along(`frame-${op.id}-bottom`, op.offset, end, op.sill, op.sill + .045, 'wood');
      } else {
        const clearance = Math.max(.8, scene.player.radius * 2 + .15), margin = .05;
        const lo = op.offset - margin, hi = end + margin;
        const area = horizontal
          ? { minX: lo, maxX: hi, minZ: wall === 'south' ? 0 : d - clearance, maxZ: wall === 'south' ? clearance : d }
          : { minX: wall === 'west' ? 0 : w - clearance, maxX: wall === 'west' ? clearance : w, minZ: lo, maxZ: hi };
        const target = horizontal ? { x: (lo + hi) / 2, z: wall === 'south' ? clearance / 2 : d - clearance / 2 }
          : { x: wall === 'west' ? clearance / 2 : w - clearance / 2, z: (lo + hi) / 2 };
        doorZones.push({ id: op.id, ...area, target });
      }
      cursor = end;
    }
    along(`wall-${wall}-${index}`, cursor, length, 0, h);
  }
  for (const f of scene.furniture) {
    const b = { id: f.id, ...bounds(f.x, f.z, f.width, f.depth, f.rotation) };
    furnitureBounds.push(b); colliders.push(b);
    // Components remain inside the whole object's declared dimensions.
    const add = (part, x, y, z, width, height, depth, material = f.material) => {
      const a = f.rotation * Math.PI / 180;
      box(`${f.id}/${part}`, f.x + Math.cos(a) * x + Math.sin(a) * z, y, f.z - Math.sin(a) * x + Math.cos(a) * z,
        width, height, depth, material, { rotation: f.rotation, category: 'furniture' });
    };
    const { width: fw, depth: fd, height: fh } = f;
    if (f.kind === 'bed') {
      add('base', 0, fh * .28, 0, fw, fh * .40, fd);
      add('mattress', 0, fh * .62, fd * .025, fw * .97, fh * .25, fd * .94, 'fabric');
      add('headboard', 0, fh * .5, -fd * .475, fw, fh, fd * .05);
      add('pillow', 0, fh * .79, -fd * .30, fw * .67, fh * .10, fd * .20, 'ceiling');
    } else if (['desk', 'table', 'chair'].includes(f.kind)) {
      const chair = f.kind === 'chair', surface = chair ? fh * .49 : fh * .94;
      add('top', 0, surface, 0, fw, fh * .08, fd);
      for (const x of [-1, 1]) for (const z of [-1, 1]) add(`leg-${x}-${z}`, x * fw * .40, surface / 2, z * fd * .40, fw * .08, surface, fd * .08, 'metal');
      if (chair) add('back', 0, fh * .75, -fd * .46, fw, fh * .5, fd * .08);
      if (f.kind === 'desk') add('drawer', fw * .28, fh * .72, 0, fw * .25, fh * .30, fd * .85);
    } else if (f.kind === 'sofa') {
      add('seat', 0, fh * .27, 0, fw, fh * .48, fd, 'fabric');
      add('back', 0, fh * .70, -fd * .40, fw, fh * .60, fd * .20, 'fabric');
      for (const x of [-1, 1]) add(`arm-${x}`, x * fw * .45, fh * .48, 0, fw * .10, fh * .40, fd, 'fabric');
    } else {
      add('back', 0, fh / 2, -fd * .475, fw, fh, fd * .05);
      for (const x of [-1, 1]) add(`side-${x}`, x * fw * .475, fh / 2, 0, fw * .05, fh, fd);
      for (let k = 0; k <= 4; k++) add(`shelf-${k}`, 0, fh * (.025 + k * .2375), 0, fw * .9, fh * .05, fd);
      if (f.kind === 'wardrobe') {
        add('front', 0, fh / 2, fd * .465, fw * .9, fh * .9, fd * .07);
        add('handle', fw * .05, fh * .5, fd * .495, fw * .02, fh * .16, fd * .01, 'metal');
      }
    }
  }
  return { schemaVersion: 1, revision: scene.revision, name: scene.name, room, player: scene.player,
    spawn: scene.spawn, materials: scene.materials, lights: scene.lights, primitives, colliders, furnitureBounds, doorZones };
}
