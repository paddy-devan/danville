import assert from 'node:assert/strict';
import test from 'node:test';
import { movePlayer } from '../src/movement.ts';
import type { PlayerState } from '../src/movement.ts';
import { tentWalls } from '../src/tent.ts';

const spawn = { x: 100, y: 100 };
const settings = {
  bounds: { left: -32, right: 48, top: -18, bottom: 18 },
  wallThickness: 4,
  doorway: { top: -12, bottom: 12 },
  playerRadius: 6,
};
const walls = tentWalls(spawn, settings);
const bounds = { left: 0, right: 1000, top: 0, bottom: 1000 };
const start: PlayerState = { ...spawn, facing: 'right', moving: false };

function walk(state: PlayerState, input: { x: number; y: number }, frames = 120) {
  for (let frame = 0; frame < frames; frame++) {
    state = movePlayer(state, input, 1 / 60, 72, bounds, walls);
  }
  return state;
}

test('inside the tent, left/up/down movement stops at the walls and stops animating', () => {
  for (const [x, y, expectedX, expectedY] of [
    [-1, 0, 78, 100], [0, -1, 100, 92], [0, 1, 100, 108],
  ]) {
    const result = walk(start, { x, y });
    assert.equal(result.x, expectedX);
    assert.equal(result.y, expectedY);
    assert.equal(result.moving, false);
  }
});

test('the right doorway permits exit and re-entry, but its solid sections block movement', () => {
  const outside = walk(start, { x: 1, y: 0 });
  assert.ok(outside.x > spawn.x + settings.bounds.right + settings.playerRadius);
  assert.equal(outside.y, spawn.y);
  const inside = walk(outside, { x: -1, y: 0 }, 90);
  assert.ok(inside.x < spawn.x + settings.bounds.right);
  for (const y of [92, 108]) {
    const blocked = walk({ ...start, y }, { x: 1, y: 0 });
    assert.equal(blocked.x, 138);
    assert.equal(blocked.moving, false);
  }
});

test('diagonal movement cannot slip through a tent corner and can slide along a wall', () => {
  const corner = walk(start, { x: -1, y: -1 });
  assert.equal(corner.x, 78);
  assert.equal(corner.y, 92);
  const slide = walk(corner, { x: 1, y: -1 });
  assert.equal(slide.y, 92);
  assert.equal(slide.x, 138);
});

test('tent walls also block entry from outside and stop large movement steps', () => {
  const below = { ...start, y: 180 };
  assert.equal(walk(below, { x: 0, y: -1 }).y, 124);
  const above = { ...start, y: 40 };
  assert.equal(walk(above, { x: 0, y: 1 }).y, 76);
  assert.equal(movePlayer(start, { x: -1, y: 0 }, 10, 72, bounds, walls).x, 78);
  assert.equal(movePlayer(start, { x: 0, y: -1 }, 10, 72, bounds, walls).y, 92);
});
