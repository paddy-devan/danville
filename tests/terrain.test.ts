import assert from 'node:assert/strict';
import test from 'node:test';
import { grassInChunk, visibleChunks } from '../src/terrain.ts';

const world = { width: 2400, height: 1600, chunkSize: 256,
  longGrass: { seed: 'test', cellSize: 32, density: 0.3, frameWidth: 10, frameHeight: 12, variants: 3 } };
const view = { x: 960, y: 640, width: 480, height: 320 };

test('terrain includes an offscreen buffer and stays bounded at every world edge', () => {
  const chunks = visibleChunks(view, world);
  assert.ok(chunks.some((chunk) => chunk.x + chunk.width <= view.x));
  assert.ok(chunks.some((chunk) => chunk.x >= view.x + view.width));
  assert.ok(chunks.some((chunk) => chunk.y + chunk.height <= view.y));
  assert.ok(chunks.some((chunk) => chunk.y >= view.y + view.height));
  for (const x of [0, world.width - view.width]) for (const y of [0, world.height - view.height]) {
    for (const chunk of visibleChunks({ ...view, x, y }, world)) {
      assert.ok(chunk.x >= 0 && chunk.y >= 0);
      assert.ok(chunk.x + chunk.width <= world.width && chunk.y + chunk.height <= world.height);
    }
  }
  assert.equal(visibleChunks(view, { ...world, width: 24000, height: 16000 }).length, chunks.length);
});

test('unloading and revisiting chunks preserves tufts regardless of generation order', () => {
  const chunks = visibleChunks(view, world);
  const original = chunks.map((chunk) => grassInChunk(chunk, world));
  for (const chunk of [...chunks].reverse()) {
    assert.deepEqual(grassInChunk(chunk, world), original[chunks.indexOf(chunk)]);
  }
  assert.notDeepEqual(grassInChunk(chunks[0], world),
    grassInChunk(chunks[0], { ...world, longGrass: { ...world.longGrass, seed: 'other' } }));
});

test('grass respects density, sprite variants and partial world edges', () => {
  const edgeWorld = { ...world, width: 519, height: 529,
    longGrass: { ...world.longGrass, density: 1 } };
  const chunks = visibleChunks({ x: 0, y: 0, width: 519, height: 529 }, edgeWorld);
  const tufts = chunks.flatMap((chunk) => grassInChunk(chunk, edgeWorld));
  assert.ok(tufts.length > 0);
  for (const tuft of tufts) {
    assert.ok(tuft.x >= 0 && tuft.x + 10 <= edgeWorld.width);
    assert.ok(tuft.y >= 0 && tuft.y + 12 <= edgeWorld.height);
    assert.ok(tuft.frame >= 0 && tuft.frame < 3);
  }
  assert.deepEqual(grassInChunk(chunks[0], { ...world,
    longGrass: { ...world.longGrass, density: 0 } }), []);
});

test('changing chunk size preserves the world layout without duplicate tufts', () => {
  const smallWorld = { ...world, width: 519, height: 529 };
  const entireView = { x: 0, y: 0, width: 519, height: 529 };
  const layout = (chunkSize: number) => {
    const settings = { ...smallWorld, chunkSize };
    return visibleChunks(entireView, settings).flatMap((chunk) => grassInChunk(chunk, settings))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  };
  assert.deepEqual(layout(256), layout(150));
});
