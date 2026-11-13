export type Direction = 'down' | 'left' | 'right' | 'up'
  | 'down-left' | 'down-right' | 'up-left' | 'up-right';

export interface PlayerState {
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
}

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Positions use game pixels and seconds. Obstacles already include the player's foot radius. */
export function movePlayer(
  state: PlayerState,
  input: { x: number; y: number },
  seconds: number,
  speed: number,
  bounds: Bounds,
  obstacles: readonly Bounds[] = [],
): PlayerState {
  const length = Math.hypot(input.x, input.y);
  if (length === 0) return { ...state, moving: false };

  const distance = speed * seconds;
  let x = Math.max(bounds.left, Math.min(bounds.right, state.x + input.x / length * distance));
  let y = Math.max(bounds.top, Math.min(bounds.bottom, state.y + input.y / length * distance));
  // Sweep each axis so walls stop large steps and the player can slide along them.
  for (const wall of obstacles) {
    if (state.y <= wall.top || state.y >= wall.bottom) continue;
    if (state.x <= wall.left && x > wall.left) x = Math.min(x, wall.left);
    if (state.x >= wall.right && x < wall.right) x = Math.max(x, wall.right);
  }
  for (const wall of obstacles) {
    if (x <= wall.left || x >= wall.right) continue;
    if (state.y <= wall.top && y > wall.top) y = Math.min(y, wall.top);
    if (state.y >= wall.bottom && y < wall.bottom) y = Math.max(y, wall.bottom);
  }
  let facing: Direction;
  if (input.x === 0) {
    facing = input.y < 0 ? 'up' : 'down';
  } else if (input.y === 0) {
    facing = input.x < 0 ? 'left' : 'right';
  } else {
    facing = input.y < 0
      ? (input.x < 0 ? 'up-left' : 'up-right')
      : (input.x < 0 ? 'down-left' : 'down-right');
  }

  return { x, y, facing, moving: x !== state.x || y !== state.y };
}
