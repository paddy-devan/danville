import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaths, isOnPath } from '../src/paths.ts';
import { grassInChunk, visibleChunks } from '../src/terrain.ts';
import { readFileSync } from 'node:fs';

const content = JSON.parse(readFileSync(new URL('../src/content/game.json', import.meta.url), 'utf8'));
const world = content.world;
const paths = buildPaths(world.paths, world);

test('level 1 matches the Grassland path geometry at the same world scale', () => {
  const level = content.levels.find((entry: { id: string }) => entry.id === 'grass-arena-1');
  const settings = level.paths === true ? world.paths : level.paths;
  assert.deepEqual(buildPaths(settings, level), paths);
});

test('routes preserve their endpoints, close loops and scale with the world', () => {
  world.paths.routes.forEach((route: { points: number[][] }, index: number) => {
    if (route.points[0][0] === route.points.at(-1)![0]
      && route.points[0][1] === route.points.at(-1)![1]) return;
    for (const endpoint of [0, -1]) {
      const [x, y] = route.points.at(endpoint)!;
      assert.deepEqual(paths.routes[index].at(endpoint), {
        x: x / world.paths.referenceSize.width * world.width,
        y: y / world.paths.referenceSize.height * world.height,
      });
    }
  });
  assert.deepEqual(paths.routes[0][0], paths.routes[0].at(-1));
  assert.ok(paths.routes.flat().every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
});

test('tight corners become tangent curves without overshoot or moving open endpoints', () => {
  const rounded = buildPaths({ width: 40, cornerRadius: 40,
    referenceSize: { width: 200, height: 200 },
    routes: [{ name: 'Right-angle bend', points: [[0, 100], [100, 100], [100, 200]] }] },
  { width: 200, height: 200 });
  const route = rounded.routes[0];
  assert.deepEqual(route[0], { x: 0, y: 100 });
  assert.deepEqual(route.at(-1), { x: 100, y: 200 });
  assert.ok(route.some(({ x, y }) => x === 90 && y === 110));
  assert.ok(route.every(({ x, y }) => x >= 0 && x <= 100 && y >= 100 && y <= 200));
  assert.equal(isOnPath(100, 100, rounded), true);
});

test('joining lanes round both inside corners of a T junction', () => {
  const junction = buildPaths({ width: 40, cornerRadius: 64,
    referenceSize: { width: 200, height: 200 }, routes: [
      { name: 'Main street', points: [[0, 100], [200, 100]] },
      { name: 'Joining lane', points: [[100, 0], [100, 100]] },
    ] }, { width: 200, height: 200 });
  assert.equal(isOnPath(75, 75, junction), true);
  assert.equal(isOnPath(125, 75, junction), true);
  assert.equal(isOnPath(50, 50, junction), false);
  assert.equal(isOnPath(150, 50, junction), false);
});

test('path clearance includes width, padding and round ends while leaving the green open', () => {
  const straight = { width: 30, routes: [[{ x: 0, y: 0 }, { x: 100, y: 0 }]] };
  assert.equal(isOnPath(50, 15, straight), true);
  assert.equal(isOnPath(50, 16, straight), false);
  assert.equal(isOnPath(50, 17, straight, 2), true);
  assert.equal(isOnPath(110, 0, straight), true);
  assert.equal(isOnPath(116, 0, straight), false);
  assert.equal(isOnPath(390 / 805 * world.width, 263 / 534 * world.height, paths), false);
});

test('grass never overlaps paths and remains deterministic across chunk sizes', () => {
  const layout = (chunkSize: number) => {
    const settings = { ...world, chunkSize, longGrass: { ...world.longGrass, density: 1 } };
    return visibleChunks({ x: 0, y: 0, width: world.width, height: world.height }, settings)
      .flatMap((chunk) => grassInChunk(chunk, settings, paths)).sort((a, b) => a.y - b.y || a.x - b.x);
  };
  const tufts = layout(256);
  assert.ok(tufts.length > 0);
  const { frameWidth, frameHeight } = world.longGrass;
  for (const tuft of tufts) {
    assert.equal(isOnPath(tuft.x + frameWidth / 2, tuft.y + frameHeight / 2, paths,
      Math.hypot(frameWidth, frameHeight) / 2 + 2), false);
  }
  assert.deepEqual(tufts, layout(150));
});
