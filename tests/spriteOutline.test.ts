import assert from 'node:assert/strict';
import test from 'node:test';
import { outlineSpriteSheet } from '../src/spriteOutline.ts';

test('outline follows opaque pixels and leaves the player interior transparent', () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  pixels[(2 * 5 + 2) * 4 + 3] = 255;
  const outline = outlineSpriteSheet(pixels, 5, 5, 5, 5);
  assert.equal(outline[(2 * 5 + 2) * 4 + 3], 0);
  assert.equal(outline.filter((_, index) => index % 4 === 3 && outline[index] > 0).length, 8);
  assert.deepEqual(Array.from(outline.slice((1 * 5 + 1) * 4, (1 * 5 + 1) * 4 + 4)), [255, 255, 255, 255]);
  assert.equal(outline[3], 0);
  assert.equal(pixels[(2 * 5 + 2) * 4 + 3], 255);
});

test('outline never copies a neighbouring animation frame across a sheet boundary', () => {
  const pixels = new Uint8ClampedArray(6 * 6 * 4);
  pixels[(2 * 6 + 2) * 4 + 3] = 255;
  const outline = outlineSpriteSheet(pixels, 6, 6, 3, 3);
  assert.equal(outline[(2 * 6 + 3) * 4 + 3], 0);
  assert.equal(outline[(3 * 6 + 2) * 4 + 3], 0);
  assert.equal(outline[(3 * 6 + 3) * 4 + 3], 0);
  assert.equal(outline[(1 * 6 + 2) * 4 + 3], 255);
});
