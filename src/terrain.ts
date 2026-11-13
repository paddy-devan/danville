import { isOnPath } from './paths.ts';
import type { PathNetwork } from './paths.ts';

interface GrassSettings {
  seed: string;
  cellSize: number;
  density: number;
  frameWidth: number;
  frameHeight: number;
  variants: number;
}

interface TerrainSettings {
  width: number;
  height: number;
  chunkSize: number;
  longGrass: GrassSettings;
}

export interface TerrainChunk {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Keep one extra chunk around the view so terrain is ready before it appears. */
export function visibleChunks(
  view: { x: number; y: number; width: number; height: number },
  world: TerrainSettings,
): TerrainChunk[] {
  const size = world.chunkSize;
  const chunks: TerrainChunk[] = [];
  const left = Math.max(0, Math.floor(view.x / size) - 1);
  const top = Math.max(0, Math.floor(view.y / size) - 1);
  const right = Math.min(Math.ceil(world.width / size) - 1, Math.floor((view.x + view.width) / size) + 1);
  const bottom = Math.min(Math.ceil(world.height / size) - 1, Math.floor((view.y + view.height) / size) + 1);
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) {
      const x = column * size;
      const y = row * size;
      chunks.push({ key: `${column},${row}`, x, y,
        width: Math.min(size, world.width - x), height: Math.min(size, world.height - y) });
    }
  }
  return chunks;
}

/** Each cell has its own random sequence, independent of which chunk loads first. */
export function grassInChunk(chunk: TerrainChunk, world: TerrainSettings, paths?: PathNetwork) {
  const grass = world.longGrass;
  const tufts: { x: number; y: number; frame: number }[] = [];
  for (let y = Math.ceil(chunk.y / grass.cellSize) * grass.cellSize; y < chunk.y + chunk.height; y += grass.cellSize) {
    for (let x = Math.ceil(chunk.x / grass.cellSize) * grass.cellSize; x < chunk.x + chunk.width; x += grass.cellSize) {
      let hash = 2166136261;
      for (const character of `${grass.seed}:${x}:${y}`) {
        hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
      }
      const random = () => {
        hash += 0x6d2b79f5;
        let value = Math.imul(hash ^ (hash >>> 15), hash | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
      const spaceX = Math.min(grass.cellSize, world.width - x) - grass.frameWidth;
      const spaceY = Math.min(grass.cellSize, world.height - y) - grass.frameHeight;
      if (spaceX < 0 || spaceY < 0 || random() >= grass.density) continue;
      const tuft = { x: x + Math.floor(random() * (spaceX + 1)),
        y: y + Math.floor(random() * (spaceY + 1)), frame: Math.floor(random() * grass.variants) };
      if (paths && isOnPath(tuft.x + grass.frameWidth / 2, tuft.y + grass.frameHeight / 2,
        paths, Math.hypot(grass.frameWidth, grass.frameHeight) / 2 + 2)) continue;
      tufts.push(tuft);
    }
  }
  return tufts;
}
