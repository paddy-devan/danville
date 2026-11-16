import type { Bounds } from './movement.ts';

export interface PropLayout {
  referenceSize: { width: number; height: number };
  types: Record<string, {
    image: string;
    width: number;
    height: number;
    footprint: Bounds;
  }>;
  placements: { id: string; type: string; x: number; y: number; flipX?: boolean }[];
}

/** Art and footprints use logical pixels; only placement coordinates scale with the map. */
export function buildProps(layout: PropLayout, world: { width: number; height: number }, radius = 3) {
  return layout.placements.map((placement) => {
    const definition = layout.types[placement.type];
    if (!definition) throw new Error(`Unknown prop type: ${placement.type}`);
    const x = Math.round(placement.x / layout.referenceSize.width * world.width);
    const y = Math.round(placement.y / layout.referenceSize.height * world.height);
    const footprint = definition.footprint;
    const left = placement.flipX ? -footprint.right : footprint.left;
    const right = placement.flipX ? -footprint.left : footprint.right;
    return { ...definition, ...placement, x, y,
      bounds: { left: x + left - radius, right: x + right + radius,
        top: y + footprint.top - radius, bottom: y + footprint.bottom + radius } };
  });
}
