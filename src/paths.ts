export interface PathNetwork {
  width: number;
  routes: { x: number; y: number }[][];
}

interface PathSettings {
  width: number;
  cornerRadius: number;
  referenceSize: { width: number; height: number };
  routes: { name: string; points: number[][] }[];
}

/** Round control-point corners without overshooting into the surrounding grass. */
export function buildPaths(settings: PathSettings, world: { width: number; height: number }): PathNetwork {
  const routes = settings.routes.map(({ points }) => {
    const scaled = points.map(([x, y]) => ({
      x: x / settings.referenceSize.width * world.width,
      y: y / settings.referenceSize.height * world.height,
    }));
    if (scaled.length < 2) return scaled;
    const closed = points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1];
    if (closed) scaled.pop();
    const at = (index: number) => scaled[(index + scaled.length) % scaled.length];
    const samples: { x: number; y: number }[] = [];
    if (!closed) samples.push(scaled[0]);
    for (let i = closed ? 0 : 1; i < (closed ? scaled.length : scaled.length - 1); i++) {
      const [previous, corner, next] = [at(i - 1), at(i), at(i + 1)];
      const before = Math.hypot(previous.x - corner.x, previous.y - corner.y);
      const after = Math.hypot(next.x - corner.x, next.y - corner.y);
      const inset = Math.max(0, Math.min(settings.cornerRadius, before / 2, after / 2));
      if (before === 0 || after === 0) continue;
      const start = { x: corner.x + (previous.x - corner.x) * inset / before,
        y: corner.y + (previous.y - corner.y) * inset / before };
      const end = { x: corner.x + (next.x - corner.x) * inset / after,
        y: corner.y + (next.y - corner.y) * inset / after };
      // A quadratic arc meets both adjacent straight sections tangentially.
      const steps = Math.max(4, Math.ceil(inset / 2));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        samples.push({
          x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * corner.x + t * t * end.x,
          y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * corner.y + t * t * end.y,
        });
      }
    }
    samples.push(closed ? samples[0] : scaled.at(-1)!);
    return samples;
  });
  // Bridge each joining lane onto both arms of its neighbour. These small curved
  // connections soften the pointed grass wedges left by overlapping road strokes.
  const lengths = routes.map((route) => {
    const distances = [0];
    for (let i = 1; i < route.length; i++) distances.push(distances[i - 1]
      + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y));
    return distances;
  });
  const along = (index: number, distance: number) => {
    const route = routes[index], distances = lengths[index], total = distances.at(-1)!;
    const closed = route[0].x === route.at(-1)!.x && route[0].y === route.at(-1)!.y;
    distance = closed && total > 0 ? (distance % total + total) % total : Math.max(0, Math.min(total, distance));
    for (let i = 1; i < route.length; i++) {
      if (distances[i] < distance || distances[i] === distances[i - 1]) continue;
      const t = (distance - distances[i - 1]) / (distances[i] - distances[i - 1]);
      return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * t,
        y: route[i - 1].y + (route[i].y - route[i - 1].y) * t };
    }
    return route.at(-1)!;
  };
  const connections: PathNetwork['routes'] = [];
  routes.forEach((source, sourceIndex) => {
    if (source.length < 2 || (source[0].x === source.at(-1)!.x && source[0].y === source.at(-1)!.y)) return;
    for (const end of [0, source.length - 1]) {
      const endpoint = source[end];
      routes.forEach((target, targetIndex) => {
        if (sourceIndex === targetIndex) return;
        let nearest = settings.width / 2, position: number | undefined;
        for (let i = 1; i < target.length; i++) {
          const a = target[i - 1], b = target[i], dx = b.x - a.x, dy = b.y - a.y;
          const squared = dx * dx + dy * dy;
          if (squared === 0) continue;
          const t = Math.max(0, Math.min(1, ((endpoint.x - a.x) * dx + (endpoint.y - a.y) * dy) / squared));
          const distance = Math.hypot(endpoint.x - a.x - t * dx, endpoint.y - a.y - t * dy);
          if (distance > nearest) continue;
          nearest = distance;
          position = lengths[targetIndex][i - 1] + Math.sqrt(squared) * t;
        }
        if (position === undefined) return;
        const reach = settings.cornerRadius;
        const start = along(sourceIndex, end === 0 ? reach : lengths[sourceIndex].at(-1)! - reach);
        const junction = along(targetIndex, position);
        for (const direction of [-1, 1]) {
          const finish = along(targetIndex, position + direction * reach);
          const curve = [];
          const steps = Math.max(4, Math.ceil(reach / 2));
          for (let step = 0; step <= steps; step++) {
            const t = step / steps;
            curve.push({ x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * junction.x + t * t * finish.x,
              y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * junction.y + t * t * finish.y });
          }
          connections.push(curve);
        }
      });
    }
  });
  return { width: settings.width, routes: [...routes, ...connections] };
}

export function isOnPath(x: number, y: number, paths: PathNetwork, padding = 0): boolean {
  const radius = paths.width / 2 + padding;
  for (const route of paths.routes) for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    if (x < Math.min(a.x, b.x) - radius || x > Math.max(a.x, b.x) + radius
      || y < Math.min(a.y, b.y) - radius || y > Math.max(a.y, b.y) + radius) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
    if ((x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2 <= radius * radius) return true;
  }
  return false;
}
