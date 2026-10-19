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

/** Positions are in game pixels; time is in seconds, independent of frame rate. */
export function movePlayer(
  state: PlayerState,
  input: { x: number; y: number },
  seconds: number,
  speed: number,
  bounds: Bounds,
): PlayerState {
  const length = Math.hypot(input.x, input.y);
  if (length === 0) return { ...state, moving: false };

  const distance = speed * seconds;
  const x = Math.max(bounds.left, Math.min(bounds.right, state.x + input.x / length * distance));
  const y = Math.max(bounds.top, Math.min(bounds.bottom, state.y + input.y / length * distance));
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
