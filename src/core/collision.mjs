// Shared by layout validation, movement tests and the browser. Coordinates are metres.
export const EPS = 1e-7;
export function bounds(x, z, width, depth, rotation = 0) {
  const turn = rotation % 180 !== 0;
  const w = turn ? depth : width, d = turn ? width : depth;
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}
export function intersects(a, b) {
  return a.minX < b.maxX - EPS && a.maxX > b.minX + EPS && a.minZ < b.maxZ - EPS && a.maxZ > b.minZ + EPS;
}
export function circleHits(x, z, b, radius) {
  const dx = x - Math.max(b.minX, Math.min(x, b.maxX));
  const dz = z - Math.max(b.minZ, Math.min(z, b.maxZ));
  return dx * dx + dz * dz < radius * radius - EPS;
}
export function canOccupy(x, z, compiled) {
  const { width, depth } = compiled.room, radius = compiled.player.radius;
  return Number.isFinite(x) && Number.isFinite(z) && x >= radius - EPS && z >= radius - EPS
    && x <= width - radius + EPS && z <= depth - radius + EPS
    && !compiled.colliders.some(b => circleHits(x, z, b, radius));
}
export function move(body, dx, dz, compiled) {
  if (![dx, dz].every(Number.isFinite)) return body;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (compiled.player.radius / 3)));
  for (let i = 0; i < steps; i++) {
    if (canOccupy(body.x + dx / steps, body.z, compiled)) body.x += dx / steps;
    if (canOccupy(body.x, body.z + dz / steps, compiled)) body.z += dz / steps;
  }
  return body;
}
export function segmentClear(a, b, compiled) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .04));
  for (let i = 0; i <= steps; i++) if (!canOccupy(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps, compiled)) return false;
  return true;
}
