import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canStandInLocation, locationWalls } from '../src/location.ts';
import type { LocationLayout } from '../src/location.ts';
import { movePlayer } from '../src/movement.ts';

const layout: LocationLayout = JSON.parse(readFileSync(new URL('../public/assets/maps/town.json', import.meta.url), 'utf8'));
const content = JSON.parse(readFileSync(new URL('../src/content/game.json', import.meta.url), 'utf8'));
const town = content.levels.find((level: { id: string }) => level.id === 'town');
const walls = locationWalls(layout);
const size = layout.cellSize;

test('Town is a map destination with the usual controls and an unobstructed home spawn', () => {
  assert.equal(content.map.arenas.find((arena: { id: string }) => arena.id === 'town').scene, town.id);
  assert.notEqual(town.mapEnabled, false);
  assert.equal(town.width, layout.width);
  assert.equal(town.height, layout.height);
  const mask = readFileSync(new URL(`../public${town.layout.mask}`, import.meta.url));
  assert.equal(mask.readUInt32BE(16), layout.width);
  assert.equal(mask.readUInt32BE(20), layout.height);
  assert.ok(canStandInLocation(layout, town.spawn.x, town.spawn.y));
  assert.ok(!walls.some((wall) => town.spawn.x > wall.left && town.spawn.x < wall.right
    && town.spawn.y > wall.top && town.spawn.y < wall.bottom));
});

test('every home, shop, garden gate and area connection is reachable from the player home', () => {
  const columns = layout.width / size, rows = layout.height / size;
  const startX = Math.floor(town.spawn.x / size), startY = Math.floor(town.spawn.y / size);
  const visited = new Set<number>([startY * columns + startX]);
  const queue = [[startX, startY]];
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = ny * columns + nx;
      if (nx < 0 || ny < 0 || nx >= columns || ny >= rows || visited.has(key)) continue;
      if (!canStandInLocation(layout, nx * size + size / 2, ny * size + size / 2)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  const targets = [...layout.buildings.flatMap((building) => building.doors), ...layout.exits,
    { name: 'Private garden gate', x: 140, y: 800 },
    ...layout.exits.filter((exit) => exit.arrival).map((exit) => ({ name: `${exit.name} return position`, ...exit.arrival! }))];
  for (const target of targets) {
    assert.ok(canStandInLocation(layout, target.x, target.y), `${target.name} is unobstructed`);
    assert.ok(visited.has(Math.floor(target.y / size) * columns + Math.floor(target.x / size)),
      `${target.name} is reachable`);
  }
});

test('town collisions stop walking onto buildings and into the surrounding forest', () => {
  const bounds = { left: 16, right: layout.width - 16, top: 36, bottom: layout.height - 4 };
  const state = { ...town.spawn, facing: 'up' as const, moving: false };
  const result = movePlayer(state, { x: 0, y: -1 }, 10, content.player.speed, bounds, walls);
  assert.ok(result.y > 794 && result.y <= 800, 'house facade blocks movement without covering its doorstep');
  assert.equal(canStandInLocation(layout, 20, 20), false);
  assert.equal(canStandInLocation(layout, 750, 240), false);
  assert.equal(canStandInLocation(layout, 880, 530), false);
  assert.ok(walls.length < 2000, 'fine collision cells merge into a manageable set of walls');
});

test('both sides of the visible streets and the previously clipped frontage are walkable', () => {
  for (const [x, y] of [
    [563, 680], [600, 680], [555, 760], [577, 760],
    [200, 460], [200, 480], [400, 460], [400, 480],
    [300, 830], [300, 860], [1150, 540], [1500, 530], [1480, 560],
    [600, 950], [610, 990], [1160, 820], [1280, 825], [1360, 280], [880, 470],
  ]) assert.ok(canStandInLocation(layout, x, y), `pavement at ${x},${y} is clear`);
});

test('the player can walk through every open garden gate without catching on an invisible wall', () => {
  const bounds = { left: 16, right: layout.width - 16, top: 36, bottom: layout.height - 4 };
  for (const [x, fromY, toY] of [[140, 846, 794], [776, 916, 812], [886, 908, 812], [161, 794, 720]]) {
    let state = { x, y: fromY, facing: 'up' as const, moving: false };
    for (let y = fromY - 1; y >= toY; y--) {
      const next = movePlayer(state, { x: 0, y: -1 }, 1 / 60, 60, bounds, walls);
      assert.equal(next.y, y, `gate path at ${x},${y} remains clear`);
      state = { ...next, facing: 'up' };
    }
  }
  let across = { x: 140, y: 794, facing: 'right' as const, moving: false };
  for (let x = 141; x <= 161; x++) {
    const next = movePlayer(across, { x: 1, y: 0 }, 1 / 60, 60, bounds, walls);
    assert.equal(next.x, x, 'garden passage turns around the vegetable bed');
    across = { ...next, facing: 'right' };
  }
  for (const [x, y] of [[710, 860], [925, 850], [105, 730], [140, 735], [140, 675], [832, 860], [640, 460], [740, 450]]) {
    assert.equal(canStandInLocation(layout, x, y), false, `planting or furniture at ${x},${y} is solid`);
  }
});
