import assert from 'node:assert/strict';
import test from 'node:test';
import { CollisionPaint } from '../src/collisionPaint.ts';
import { canStandInLocation, fieldCollisionLayout, locationGroundMask, locationWalls, nearestLocationPosition, replaceLocationMask } from '../src/location.ts';
import { movePlayer } from '../src/movement.ts';
import { tentWalls } from '../src/tent.ts';
import { readFileSync } from 'node:fs';
import type { LocationLayout } from '../src/location.ts';

test('a fast brush stroke paints a continuous path and clips safely at map edges', () => {
  const paint = new CollisionPaint(40, 30, new Uint8Array(1200));
  paint.beginStroke();
  paint.paint({ x: -10, y: 15 }, { x: 50, y: 15 }, 3, true);
  paint.endStroke();
  for (let x = 0; x < 40; x++) {
    assert.equal(paint.mask[15 * 40 + x], 1);
    assert.equal(paint.mask[12 * 40 + x], 1);
    assert.equal(paint.mask[11 * 40 + x], 0);
  }
});

test('undo and redo operate on entire strokes, including imported or restored masks', () => {
  const paint = new CollisionPaint(10, 10, new Uint8Array(100));
  paint.beginStroke();
  paint.paint({ x: 1, y: 1 }, { x: 8, y: 8 }, 2, true);
  paint.endStroke();
  const path = paint.mask.slice();
  paint.beginStroke(); paint.paint({ x: 5, y: 5 }, { x: 5, y: 5 }, 1, false); paint.endStroke();
  assert.equal(paint.mask[55], 0);
  paint.undo(); assert.deepEqual(paint.mask, path);
  paint.undo(); assert.ok(paint.mask.every((value) => value === 0));
  paint.redo(); assert.deepEqual(paint.mask, path);
  paint.replace(new Uint8Array(100).fill(1));
  assert.equal(paint.canRedo, false);
  paint.undo(); assert.deepEqual(paint.mask, path);
});

test('painting changes the same mask used for collision, including foot clearance and safe placement', () => {
  const layout: LocationLayout = { width: 40, height: 30, cellSize: 2, playerRadius: 2,
    walkableAreas: [], buildings: [], obstacles: [], exits: [] };
  const paint = new CollisionPaint(40, 30, locationGroundMask(layout));
  paint.beginStroke(); paint.paint({ x: 5, y: 15 }, { x: 35, y: 15 }, 5, true); paint.endStroke();
  replaceLocationMask(layout, paint.mask);
  assert.equal(canStandInLocation(layout, 20, 15), true);
  assert.equal(canStandInLocation(layout, 20, 10), false, 'feet require room beside the painted edge');
  const bounds = { left: 2, right: 38, top: 2, bottom: 28 };
  const safe = nearestLocationPosition(layout, 20, 3, bounds);
  assert.ok(safe && canStandInLocation(layout, safe.x, safe.y));
  replaceLocationMask(layout, new Uint8Array(1200));
  assert.equal(nearestLocationPosition(layout, 20, 15, bounds), undefined);
  assert.throws(() => replaceLocationMask(layout, new Uint8Array(10)), /one black or white value/);
});

test('field painting can replace authored prop walls and add new collision with foot clearance', () => {
  const layout = fieldCollisionLayout({ width: 100, height: 80 },
    [{ left: 28, right: 52, top: 18, bottom: 42 }]);
  const baseline = locationGroundMask(layout);
  assert.equal(baseline[30 * 100 + 40], 0);
  assert.equal(canStandInLocation(layout, 20, 30), true);
  const bounds = { left: 4, right: 96, top: 4, bottom: 76 };
  const start = { x: 20, y: 30, facing: 'right' as const, moving: false };
  assert.ok(movePlayer(start, { x: 1, y: 0 }, 1, 50, bounds, locationWalls(layout)).x < 40);
  const paint = new CollisionPaint(100, 80, baseline);
  paint.beginStroke(); paint.paint({ x: 40, y: 30 }, { x: 40, y: 30 }, 25, true); paint.endStroke();
  replaceLocationMask(layout, paint.mask);
  assert.equal(canStandInLocation(layout, 40, 30), true);
  assert.equal(movePlayer(start, { x: 1, y: 0 }, 1, 50, bounds, locationWalls(layout)).x, 70);
  paint.beginStroke(); paint.paint({ x: 70, y: 10 }, { x: 70, y: 60 }, 4, false); paint.endStroke();
  replaceLocationMask(layout, paint.mask);
  assert.equal(canStandInLocation(layout, 70, 30), false);
  assert.equal(canStandInLocation(layout, 64, 30), false);
  paint.replace(baseline); replaceLocationMask(layout, paint.mask);
  assert.equal(canStandInLocation(layout, 40, 30), false);
});

test('the field mask preserves the opening tent interior, doorway and return approach', () => {
  const content = JSON.parse(readFileSync(new URL('../src/content/game.json', import.meta.url), 'utf8'));
  const arena = content.levels.find((level: { id: string }) => level.id === 'grass-arena-1');
  const layout = fieldCollisionLayout(arena, tentWalls(arena.spawn, arena.tent.collision));
  assert.equal(canStandInLocation(layout, arena.spawn.x, arena.spawn.y), true);
  assert.equal(canStandInLocation(layout, arena.spawn.x + arena.tent.returnArea.right, arena.spawn.y), true);
  const bounds = { left: 16, right: arena.width - 16, top: 36, bottom: arena.height - 4 };
  const walls = locationWalls(layout);
  let state = { ...arena.spawn, facing: 'right' as const, moving: false };
  for (let frame = 0; frame < 180; frame++) state = movePlayer(state, { x: 1, y: 0 }, 1 / 60, 72, bounds, walls);
  assert.ok(state.x > arena.spawn.x + 100);
  for (let frame = 0; frame < 180; frame++) state = movePlayer(state, { x: -1, y: 0 }, 1 / 60, 72, bounds, walls);
  assert.ok(Math.abs(state.x - arena.spawn.x) < 0.01);
});
