# Scene specification v1

Use metres. Y points up. The southwest interior floor corner is `(x=0,z=0)`;
east is +X, north is +Z. Furniture positions are footprint centres at floor level.
`rotation` is degrees about Y; at 90/270 the world width and depth swap.

Creation accepts a partial scene; `room.width` and `room.depth` are required. Defaults
are written into committed scene.json. Modification does not reapply creation defaults
or drop unspecified fields. Unknown properties are errors. The machine-readable contract
is [scene.schema.json](../schemas/scene.schema.json).

| Field | Meaning / defaults |
| --- | --- |
| schemaVersion, revision | 1; creation revision 1; successful modification or restore increments revision |
| name, units | Short name; `m` only |
| room | width/depth 2–20m; height 2.8m (2.1–5); wallThickness .12m (.06–.4) |
| openings | Array, default empty; id/type/wall/offset/width/height/sill |
| furniture | Array, default empty; id/kind/x/z/width/depth/height/rotation/material |
| materials | Named `{color:'#rrggbb',roughness:0..1,metalness?:0..1}` |
| lights | ambient and sun `{color,intensity}`; points `[{id,x,y,z,color,intensity}]` (max 4) |
| spawn | `{x,z,yaw}`; default `{x:1,z:1,yaw:180}`; choose a valid point for furnished rooms |
| player | radius .22m; eyeHeight 1.6m; speed 2.1m/s |

IDs match `[a-z][a-z0-9-]{0,47}` and are globally unique across furniture, openings and
point lights. Materials wall/floor/ceiling/wood/fabric/metal/glass are always present.
Override a default material with its complete color/roughness object during creation.

## Openings

wall: north/south/east/west. Offset is the start, measured along +X on north/south walls
and +Z on east/west walls. Doors require sill 0 and enough width/height for the player.
Windows default to sill 1m and require sill >=.3m. Openings cannot overlap on the same
wall even at different elevations. Fixed glass blocks walking. Doors require a minimum
.8m interior approach zone plus .05m lateral margin free of furniture. There is no floor
outside the room, so an exterior doorway is not an exit into another space.

## Furniture and collision

Kinds: bed, desk, chair, wardrobe, bookshelf, sofa, table. Proportional box components
remain inside supplied dimensions. Furniture is upright and floor-anchored. Rotation
defaults to 0, material to wood. Bed linens, sofa upholstery and legs additionally use
the shared fabric/metal/ceiling materials. Collision conservatively uses each whole
footprint, including gaps under tables. Touching boundaries is allowed; overlap,
out-of-bounds, excessive height, blocked doors and invalid spawn positions are rejected.
Door reachability uses .1m sampling with continuous segment checks. Narrow passages may
be conservatively rejected. This is not a physics engine or accessibility certification.

## Changes

Use `{expectedRevision:<current>,operations:[...]}`:

| op | Other fields |
| --- | --- |
| setRoom / setSpawn | patch: partial corresponding fields |
| setLights | patch: ambient/sun merge, points replaces the points array |
| setMaterial | id, value: partial existing material or complete new material |
| addFurniture / addOpening | value: new object with a new stable ID |
| updateFurniture / updateOpening | id, patch: fields to replace; ID cannot change |
| removeFurniture / removeOpening | id |

All operations validate together. A smaller room must include every intended move in
the same transaction. No furniture scaling, relocation or spawn repair is automatic.
See `examples/c-study.change.json` for a complete request, and `examples/d-*.change.json`
for rejection cases. Creation defaults apply to added objects, not existing objects.
