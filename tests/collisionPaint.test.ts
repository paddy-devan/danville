import assert from 'node:assert/strict';
import test from 'node:test';
import { CollisionPaint } from '../src/collisionPaint.ts';
import { canStandInLocation, locationGroundMask, nearestLocationPosition, replaceLocationMask } from '../src/location.ts';
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
