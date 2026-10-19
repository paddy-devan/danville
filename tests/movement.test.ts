import assert from 'node:assert/strict';
import test from 'node:test';
import { movePlayer } from '../src/movement.ts';
import type { PlayerState } from '../src/movement.ts';

const start: PlayerState = { x: 100, y: 100, facing: 'down', moving: false };
const bounds = { left: 16, right: 464, top: 36, bottom: 316 };

test('diagonal and cardinal movement travel the same distance', () => {
  for (const input of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 1 }]) {
    const result = movePlayer(start, input, 0.5, 72, bounds);
    assert.ok(Math.abs(Math.hypot(result.x - start.x, result.y - start.y) - 36) < 0.00001);
  }
});

test('movement distance is independent of frame rate', () => {
  const once = movePlayer(start, { x: 1, y: 0 }, 1, 72, bounds);
  let many = start;
  for (let i = 0; i < 60; i++) many = movePlayer(many, { x: 1, y: 0 }, 1 / 60, 72, bounds);
  assert.ok(Math.abs(once.x - many.x) < 0.00001);
});

test('every edge keeps the character inside the field', () => {
  for (const input of [{ x: -1, y: -1 }, { x: 1, y: 1 }]) {
    const result = movePlayer(start, input, 100, 72, bounds);
    assert.equal(result.x, input.x < 0 ? bounds.left : bounds.right);
    assert.equal(result.y, input.y < 0 ? bounds.top : bounds.bottom);
    assert.equal(movePlayer(result, input, 1, 72, bounds).moving, false);
  }
});

test('releasing keys stops movement and preserves the last facing direction', () => {
  const walking = movePlayer(start, { x: -1, y: 0 }, 0.5, 72, bounds);
  const idle = movePlayer(walking, { x: 0, y: 0 }, 1, 72, bounds);
  assert.deepEqual(idle, { ...walking, facing: 'left', moving: false });
  assert.equal(start.x, 100);
});

test('all eight inputs select the matching facing direction', () => {
  for (const [x, y, facing] of [
    [-1, 0, 'left'], [1, 0, 'right'], [0, -1, 'up'], [0, 1, 'down'],
    [-1, -1, 'up-left'], [1, -1, 'up-right'], [-1, 1, 'down-left'], [1, 1, 'down-right'],
  ] as const) {
    assert.equal(movePlayer(start, { x, y }, 0.1, 72, bounds).facing, facing);
  }
});

test('stopping preserves each diagonal facing; releasing one arrow returns to cardinal facing', () => {
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const diagonal = movePlayer(start, { x, y }, 0.1, 72, bounds);
    assert.deepEqual(movePlayer(diagonal, { x: 0, y: 0 }, 0.1, 72, bounds), { ...diagonal, moving: false });
    assert.equal(movePlayer(diagonal, { x, y: 0 }, 0.1, 72, bounds).facing, x < 0 ? 'left' : 'right');
    assert.equal(movePlayer(diagonal, { x: 0, y }, 0.1, 72, bounds).facing, y < 0 ? 'up' : 'down');
  }
});
