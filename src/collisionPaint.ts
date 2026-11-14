/** One binary pixel per world pixel. Brushes edit ground; movement adds foot clearance. */
export class CollisionPaint {
  readonly width: number;
  readonly height: number;
  mask: Uint8Array;
  private undoStates: Uint8Array[] = [];
  private redoStates: Uint8Array[] = [];
  private before?: Uint8Array;

  constructor(width: number, height: number, mask: Uint8Array) {
    if (mask.length !== width * height) throw new Error('Mask size does not match the map.');
    this.width = width;
    this.height = height;
    this.mask = mask.slice();
  }

  get canUndo() { return this.undoStates.length > 0; }
  get canRedo() { return this.redoStates.length > 0; }

  beginStroke() { this.before ??= this.mask.slice(); }

  paint(from: { x: number; y: number }, to: { x: number; y: number }, radius: number, walkable: boolean) {
    const dx = to.x - from.x, dy = to.y - from.y, squared = dx * dx + dy * dy;
    const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius));
    const right = Math.min(this.width - 1, Math.ceil(Math.max(from.x, to.x) + radius));
    const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius));
    const bottom = Math.min(this.height - 1, Math.ceil(Math.max(from.y, to.y) + radius));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const t = squared ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / squared)) : 0;
      if ((x - from.x - t * dx) ** 2 + (y - from.y - t * dy) ** 2 <= radius * radius) {
        this.mask[y * this.width + x] = Number(walkable);
      }
    }
  }

  endStroke(): boolean {
    if (!this.before) return false;
    const before = this.before;
    this.before = undefined;
    if (this.mask.every((value, index) => value === before[index])) return false;
    this.undoStates.push(before);
    if (this.undoStates.length > 20) this.undoStates.shift();
    this.redoStates = [];
    return true;
  }

  replace(mask: Uint8Array) {
    if (mask.length !== this.mask.length) throw new Error('Mask size does not match the map.');
    this.beginStroke();
    this.mask = mask.slice();
    this.endStroke();
  }

  undo() {
    const previous = this.undoStates.pop();
    if (!previous) return;
    this.redoStates.push(this.mask);
    this.mask = previous;
  }

  redo() {
    const next = this.redoStates.pop();
    if (!next) return;
    this.undoStates.push(this.mask);
    this.mask = next;
  }
}
