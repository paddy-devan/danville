import type { Bounds } from './movement.ts';

export interface LocationLayout {
  width: number;
  height: number;
  cellSize: number;
  playerRadius: number;
  walkableOverlay?: { color: string; alpha: number };
  walkableAreas: { name: string; points: number[][] }[];
  buildings: { id: string; name: string; bounds: Bounds;
    doors: { name: string; x: number; y: number }[] }[];
  obstacles: { name: string; bounds: Bounds }[];
  exits: { name: string; x: number; y: number; scene?: string;
    arrival?: { x: number; y: number } }[];
}

const groundMasks = new WeakMap<LocationLayout, Uint8Array>();

export function locationGroundMask(layout: LocationLayout): Uint8Array {
  return groundMask(layout).slice();
}

export function replaceLocationMask(layout: LocationLayout, mask: Uint8Array): void {
  if (mask.length !== layout.width * layout.height || mask.some((value) => value > 1)) {
    throw new Error('Collision mask must contain one black or white value per map pixel.');
  }
  groundMasks.set(layout, mask.slice());
}

export function nearestLocationPosition(layout: LocationLayout, x: number, y: number, bounds: Bounds) {
  const size = layout.cellSize;
  const valid = (px: number, py: number) => px >= bounds.left && px <= bounds.right
    && py >= bounds.top && py <= bounds.bottom && canStandInLocation(layout,
      Math.floor(px / size) * size + size / 2, Math.floor(py / size) * size + size / 2);
  if (valid(x, y)) return { x, y };
  const step = layout.cellSize;
  for (let radius = step; radius <= Math.max(layout.width, layout.height); radius += step) {
    for (let offset = -radius; offset <= radius; offset += step) {
      for (const [px, py] of [[x + offset, y - radius], [x + offset, y + radius],
        [x - radius, y + offset], [x + radius, y + offset]]) {
        if (valid(px, py)) return { x: px, y: py };
      }
    }
  }
  return undefined;
}

/** Rasterise authored ground once, so finer collision cells do not slow level loading. */
function groundMask(layout: LocationLayout): Uint8Array {
  const cached = groundMasks.get(layout);
  if (cached) return cached;
  const { width, height } = layout;
  const mask = new Uint8Array(width * height);
  for (const { points } of layout.walkableAreas) {
    const top = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
    const bottom = Math.min(height, Math.ceil(Math.max(...points.map((point) => point[1]))));
    for (let y = top; y < bottom; y++) {
      const crossings: number[] = [];
      const scanY = y + 0.5;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i], [bx, by] = points[j];
        if ((ay > scanY) !== (by > scanY)) crossings.push(ax + (scanY - ay) * (bx - ax) / (by - ay));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const left = Math.max(0, Math.ceil(crossings[i] - 0.5));
        const right = Math.min(width, Math.ceil(crossings[i + 1] - 0.5));
        mask.fill(1, y * width + left, y * width + right);
      }
    }
  }
  for (const { bounds: b } of [...layout.buildings, ...layout.obstacles]) {
    const left = Math.max(0, Math.floor(b.left)), right = Math.min(width, Math.ceil(b.right));
    for (let y = Math.max(0, Math.floor(b.top)); y < Math.min(height, Math.ceil(b.bottom)); y++) {
      mask.fill(0, y * width + left, y * width + right);
    }
  }
  groundMasks.set(layout, mask);
  return mask;
}

/** Artwork and editable ground geometry stay separate; roofs cannot be walked over. */
export function canStandInLocation(layout: LocationLayout, x: number, y: number,
  radius = layout.playerRadius): boolean {
  const mask = groundMask(layout);
  for (const dx of [-radius, 0, radius]) for (const dy of [-radius, 0, radius]) {
    const px = Math.floor(x + dx), py = Math.floor(y + dy);
    if (px < 0 || py < 0 || px >= layout.width || py >= layout.height || !mask[py * layout.width + px]) return false;
  }
  return true;
}

/** Merge blocked grid cells into wall rectangles for the existing swept movement rules. */
export function locationWalls(layout: LocationLayout): Bounds[] {
  const size = layout.cellSize;
  const walls: Bounds[] = [];
  let previous = new Map<string, Bounds>();
  for (let y = 0; y < layout.height; y += size) {
    const row = new Map<string, Bounds>();
    let start: number | undefined;
    for (let x = 0; x <= Math.ceil(layout.width / size) * size; x += size) {
      const blocked = x < layout.width && !canStandInLocation(layout, x + size / 2, y + size / 2);
      if (blocked && start === undefined) start = x;
      if (blocked || start === undefined) continue;
      const key = `${start}:${x}`;
      const wall = previous.get(key);
      if (wall) wall.bottom = Math.min(y + size, layout.height);
      else {
        const next = { left: start, right: Math.min(x, layout.width), top: y, bottom: Math.min(y + size, layout.height) };
        walls.push(next);
        row.set(key, next);
      }
      if (wall) row.set(key, wall);
      start = undefined;
    }
    previous = row;
  }
  return walls;
}
