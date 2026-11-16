import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildProps } from '../src/props.ts';
import { buildPaths, isOnPath } from '../src/paths.ts';
import { movePlayer } from '../src/movement.ts';
import { tentWalls } from '../src/tent.ts';

const content = JSON.parse(readFileSync(new URL('../src/content/game.json', import.meta.url), 'utf8'));
const layout = JSON.parse(readFileSync(new URL('../src/content/props.json', import.meta.url), 'utf8')).festival;
const props = buildProps(layout, content.world);
const paths = buildPaths(content.world.paths, content.world);

test('festival artwork exists and matches its logical display dimensions', () => {
  assert.equal(new Set(props.map((prop) => prop.id)).size, props.length);
  for (const type of Object.values(layout.types) as typeof props) {
    const png = readFileSync(new URL(`../public${type.image}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), type.width, type.image);
    assert.equal(png.readUInt32BE(20), type.height, type.image);
    assert.ok(type.footprint.left >= -type.width / 2 && type.footprint.right <= type.width / 2);
    assert.ok(type.footprint.top >= -type.height && type.footprint.bottom <= 0);
  }
});

test('campsite props leave the paths and their approaches clear', () => {
  for (const prop of props) {
    assert.ok(prop.x - prop.width / 2 >= 0 && prop.x + prop.width / 2 <= content.world.width);
    assert.ok(prop.y - prop.height >= 0 && prop.y <= content.world.height);
    for (let y = prop.y - prop.height; y <= prop.y; y += 2) {
      for (let x = prop.x - prop.width / 2; x <= prop.x + prop.width / 2; x += 2) {
        assert.equal(isOnPath(x, y, paths, 6), false, `${prop.id} covers a path approach`);
      }
    }
    for (const other of props) {
      if (prop.id >= other.id) continue;
      const a = prop.bounds, b = other.bounds;
      assert.ok(a.left >= b.right || a.right <= b.left || a.top >= b.bottom || a.bottom <= b.top,
        `${prop.id} overlaps ${other.id}`);
    }
  }
});

test('prop footprints stop movement from either side, including large steps', () => {
  const bounds = { left: 0, right: content.world.width, top: 0, bottom: content.world.height };
  for (const prop of props) {
    const wall = prop.bounds;
    const y = (wall.top + wall.bottom) / 2;
    for (const direction of [-1, 1]) {
      const edge = direction === 1 ? wall.left : wall.right;
      const start = { x: edge - direction * 20, y, facing: 'down' as const, moving: false };
      assert.equal(movePlayer(start, { x: direction, y: 0 }, 2, 72, bounds, [wall]).x, edge);
    }
  }
});

test('festival placement preserves the field spawn and arena tent exit and return', () => {
  const arena = content.levels.find((level: { id: string }) => level.id === 'grass-arena-1');
  const bounds = { left: 16, right: content.world.width - 16, top: 36, bottom: content.world.height - 4 };
  const walls = [...props.map((prop) => prop.bounds), ...tentWalls(arena.spawn, arena.tent.collision)];
  for (const spawn of [content.player.spawn, arena.spawn]) {
    assert.ok(!walls.some((wall) => spawn.x > wall.left && spawn.x < wall.right
      && spawn.y > wall.top && spawn.y < wall.bottom));
    for (const prop of props) {
      const wall = prop.bounds;
      assert.ok(Math.hypot(Math.max(wall.left - spawn.x, 0, spawn.x - wall.right),
        Math.max(wall.top - spawn.y, 0, spawn.y - wall.bottom)) >= 24,
      `${prop.id} crowds the spawn`);
    }
  }
  let state = { ...arena.spawn, facing: 'right' as const, moving: false };
  for (let frame = 0; frame < 240; frame++) {
    state = movePlayer(state, { x: 1, y: 0 }, 1 / 60, 72, bounds, walls);
  }
  assert.ok(isOnPath(state.x, state.y, paths));
  for (let frame = 0; frame < 240; frame++) {
    state = movePlayer(state, { x: -1, y: 0 }, 1 / 60, 72, bounds, walls);
  }
  assert.ok(Math.abs(state.x - arena.spawn.x) < 0.01);
});

test('placement scales independently of art and mirrors asymmetric footprints', () => {
  const sample = { referenceSize: { width: 100, height: 100 },
    types: { stool: { image: '/stool.png', width: 20, height: 15,
      footprint: { left: -8, right: 4, top: -5, bottom: -1 } } },
    placements: [{ id: 'stool', type: 'stool', x: 25, y: 50, flipX: true }] };
  const [prop] = buildProps(sample, { width: 200, height: 300 });
  assert.equal(prop.x, 50);
  assert.equal(prop.y, 150);
  assert.equal(prop.width, 20);
  assert.deepEqual(prop.bounds, { left: 43, right: 61, top: 142, bottom: 152 });
});
