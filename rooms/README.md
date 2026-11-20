# CT61 Darkride room modules (B6)

(CT72.A5.Eyes: only `eyes.js` is here (from CT61.B6; A2: a bigger room, more eyes, some floor eyes tracking), plus `dark.js`, new: the dark tunnel before the room (head piece `start`, the dispatch point) and the darkness after it (tail piece `darkA`, where the ride ends, `endS`). The table below is CT61.B6's; the other rooms are in `CT61.B6.Darkride/rooms/`.)

Each room of the ride is one file here. A later version can take any of them as they are, put them in a different order, use one twice, or leave one out, without touching the room's code.

| File | Room | Pieces of track (ids) | Exports |
|---|---|---|---|
| `station.js` | the entry way (loading area) | head: `station`; tail: `return` | `endS` (where the ride ends) |
| `windows.js` | the hall of windows | `corner1`, `hallIn`, `hall`, `corner2` | `hallWins`, `setGlass` |
| `descent.js` | going down a level (fast, with curves) | prefix + `In`, `A`, `BendA`, `B`, `BendB`, `Out` | |
| `crates.js` | the room of crates | `cratesIn`, `cratesA`, `cratesB`, `cratesOut` | |
| `prison.js` | the room of jails | `prison`, `cellOut` | |
| `dolls.js` | the doll room (reception line, suitcases) | `dolls`, `dollsOut` | `candles` |
| `bees.js` | the room of bees | `bees` | `swarm` |
| `eyes.js` | the room of eyes (hanging, wall and floor eyes) | `eyesIn`, `eyesA`, `eyesB` | `eyes`, `floor` |
| `locusts.js` | the room of locusts | `gate`, `plainsA`..`plainsD` | `plains` |
| `lifthill.js` | up three levels: the lift hill, the CT68 dolls | `hillIn`, `hillB`, `hillOut` | `carolers` |

What every room needs from outside its file:

- `CT61.B6.Darkride_core.js` (`CT61Core`: rock, tunnels, portals, textures, geometry helpers, flicker).
- `CT61.B6.Darkride_cars.js` (`CT61Cars`), for the rooms that put old cars in the scenery.
- the pictures in `CT61.B6.Darkride_assets*.js`.
- `bees.js` needs `CT61.B6.Darkride_bees.js`; `locusts.js` needs `CT61.B6.Darkride_plains.js`; `lifthill.js` uses `CT61.B6.Darkride_lib/ct68_carolers.js` if it is loaded, and builds without the dolls if it is not.

## The shape of a module

```js
CT61Rooms.name = {
  title: 'the room of …',
  zones: { zoneName: 'what the zone is called' },
  pieces(o) { return [ /* pieces of track, in order */ ]; },
  tailPieces(o) { … },         // only the station: the pieces that close the loop
  async build(ctx, inst) {     // build the room round inst.pieces (integrated: s0, s1, length, y0, th0 …)
    …
    return { update(t, dt, cam, S, cars) { … }, /* anything main.js needs */ };
  },
  stops(ctx, inst) { return [ /* { s, kind: 'show', hold, name } */ ]; },
};
```

A piece is `{ id, kind: 'S', len, rise }` (a straight, climbing or falling) or `{ id, kind: 'T', ang, r }` (a turn, + = left). Other fields:

- `hw`, `h` and `spring`: the tunnel's half width, height and where its vault starts. With these, the ride builds the rock bore, the timber sets, the lanterns and the rubble itself.
- `room: true`: the ride builds no tunnel there, because the module builds the chamber.
- `speed` (m/s) and `zone`.
- `face`: where to look, as `[[fraction, degrees]]`.
- `gaze`: a tilt of the look, up (+) or down (−).
- `ease`: `in`, `out` or `lin`, for how the grade starts and ends.
- `fast`: let the car run away downhill.
- `lift`: the chain sound.
- `noLanterns`, `noDebris`, `rubbleSides`, `setsAt` and `bulbs`: the mine furniture.
- `fit: 0 / 1`: this straight's length is solved so that the loop closes.

The context `ctx` has the following:

- `T` (three.js) and `C` (`CT61Core`).
- `scene`, `group` and `path`.
- `P`, every piece by its id.
- `put(materialKey, geometry, castShadow)`: static geometry. It is merged per material and culled in 16 m cells.
- `mat(key)` and `MAT`.
- `specs`: lights for the light pool, as `{ s, kind, pos, target, color, intensity, angle, … }`.
- `glows`: bulbs, as `[position, colour, size, flicker]`.
- `anim`: per-frame functions.
- `A`: the pictures.
- `opts`: the URL options.
- `prev(p)` and `next(p)`.
- `rod(key, A, B, r)`: a bar from A to B.
- `carFactory()`.

## Putting rooms in a ride

The order is the `RIDE` list at the top of `CT61.B6.Darkride_ride.js`. It holds room instances and plain tunnel pieces:

```js
{ room: 'station', part: 'head' },
{ room: 'windows' },
{ room: 'descent', o: { prefix: 'down', drop: 8.4, grade: 0.22, lenA: 12, ang1: -40, ang2: 40, r: 9 } },
…
tun({ id: 'arch', kind: 'S', len: 0, fit: 0, hw: 1.5, h: 3.0 }),
…
{ room: 'station', part: 'tail' },
```

The loop must close. Two straights with `fit: 0` and `fit: 1` take up the difference in plan; they must not be parallel. The last climb (`upLastB`) takes up the difference in height. Check a new order with the browser console (a warning if the loop closes badly). Then look for rooms that overlap: each room is built round its own pieces, and nothing stops two rooms meeting in the rock.

Two rules for the room of locusts: the track must head west into it, and its doors are in its east wall, so nothing else may sit just west of that wall.
