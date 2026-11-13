import type { Bounds } from './movement.ts';

export interface TentCollision {
  /** Wall footprint, relative to the level spawn. */
  bounds: Bounds;
  wallThickness: number;
  doorway: { top: number; bottom: number };
  playerRadius: number;
}

/** Five wall sections leave one doorway in the right wall. */
export function tentWalls(spawn: { x: number; y: number }, settings: TentCollision): Bounds[] {
  const { left, right, top, bottom } = settings.bounds;
  const thickness = settings.wallThickness;
  return [
    { left, right, top, bottom: top + thickness },
    { left, right, top: bottom - thickness, bottom },
    { left, right: left + thickness, top, bottom },
    { left: right - thickness, right, top, bottom: settings.doorway.top },
    { left: right - thickness, right, top: settings.doorway.bottom, bottom },
  ].map((wall) => ({
    left: spawn.x + wall.left - settings.playerRadius,
    right: spawn.x + wall.right + settings.playerRadius,
    top: spawn.y + wall.top - settings.playerRadius,
    bottom: spawn.y + wall.bottom + settings.playerRadius,
  }));
}
