import { CollisionPaint } from './collisionPaint';

export const collisionDraftKey = (id: string) => `danville:collision-mask:${id}:v1`;

export function maskCanvas(width: number, height: number, mask: Uint8Array): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) {
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = mask[i] * 255;
    pixels.data[i * 4 + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function maskFromImage(image: CanvasImageSource, width: number, height: number): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  return Uint8Array.from({ length: width * height }, (_, i) =>
    Number(pixels[i * 4 + 3] >= 128 && (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) >= 384));
}

export class CollisionEditor {
  private readonly model: CollisionPaint;
  private readonly dialog = document.createElement('dialog');
  private readonly canvas = document.createElement('canvas');
  private readonly tint = document.createElement('canvas');
  private readonly status = document.createElement('p');
  private readonly undoButton = document.createElement('button');
  private readonly redoButton = document.createElement('button');
  private readonly walkButton = document.createElement('button');
  private readonly blockButton = document.createElement('button');
  private readonly brush = document.createElement('input');
  private readonly abort = new AbortController();
  private scale = 1;
  private offset = { x: 0, y: 0 };
  private painting?: { x: number; y: number };
  private panning?: { x: number; y: number };
  private hover?: { x: number; y: number };
  private walkable = true;
  private closed = false;

  constructor(private readonly id: string, private readonly image: CanvasImageSource,
    width: number, height: number, initial: Uint8Array, private readonly original: Uint8Array,
    private readonly apply: (mask: Uint8Array) => boolean, private readonly close: () => void) {
    this.model = new CollisionPaint(width, height, initial);
  }

  open() {
    const signal = this.abort.signal;
    this.dialog.className = 'collision-editor';
    this.dialog.setAttribute('aria-label', 'Town collision painter');
    const bar = document.createElement('div');
    bar.className = 'collision-editor-toolbar';
    const title = document.createElement('strong');
    title.textContent = 'Town · Collision painter';
    bar.append(title);
    const button = (element: HTMLButtonElement, label: string, action: () => void) => {
      element.type = 'button'; element.textContent = label;
      element.addEventListener('click', action, { signal }); bar.append(element);
      return element;
    };
    button(this.walkButton, 'Walkable', () => this.choose(true));
    button(this.blockButton, 'Blocked', () => this.choose(false));
    const size = document.createElement('label');
    size.textContent = 'Brush ';
    this.brush.type = 'range'; this.brush.min = '2'; this.brush.max = '80'; this.brush.value = '24';
    this.brush.setAttribute('aria-label', 'Brush diameter');
    const diameter = document.createElement('output'); diameter.textContent = '24 px';
    this.brush.addEventListener('input', () => { diameter.textContent = `${this.brush.value} px`; this.draw(); }, { signal });
    size.append(this.brush, diameter); bar.append(size);
    button(this.undoButton, 'Undo', () => { this.model.undo(); this.changed(); });
    button(this.redoButton, 'Redo', () => { this.model.redo(); this.changed(); });
    button(document.createElement('button'), 'Fit map', () => this.fit());
    button(document.createElement('button'), 'Restore map', () => { this.model.replace(this.original); this.changed(); });
    const upload = document.createElement('input');
    upload.type = 'file'; upload.accept = 'image/png'; upload.hidden = true;
    upload.addEventListener('change', () => { void this.importMask(upload); }, { signal });
    button(document.createElement('button'), 'Import PNG', () => upload.click());
    button(document.createElement('button'), 'Export PNG', () => this.exportMask());
    button(document.createElement('button'), 'Playtest', () => this.finish()).className = 'collision-editor-play';
    const help = document.createElement('p');
    help.className = 'collision-editor-help';
    help.textContent = 'Drag to paint · Right-drag to pan · Scroll to zoom · Ctrl+Z to undo · Esc to playtest. Blue is open ground; the player still needs room for their feet.';
    this.status.className = 'collision-editor-status';
    this.status.setAttribute('role', 'status');
    this.status.textContent = 'Changes save in this browser. Export PNG to keep a copy for the game.';
    this.canvas.setAttribute('aria-label', 'Paint walkable and blocked ground on the Town map');
    this.canvas.className = 'collision-editor-canvas';
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
    this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event), { signal });
    this.canvas.addEventListener('pointermove', (event) => this.pointerMove(event), { signal });
    this.canvas.addEventListener('pointerup', () => this.endPointer(), { signal });
    this.canvas.addEventListener('pointercancel', () => this.endPointer(), { signal });
    this.canvas.addEventListener('lostpointercapture', () => this.endPointer(), { signal });
    this.canvas.addEventListener('pointerleave', () => { if (!this.painting && !this.panning) { this.hover = undefined; this.draw(); } }, { signal });
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const before = this.point(event.clientX, event.clientY);
      const box = this.canvas.getBoundingClientRect();
      this.scale = Math.max(0.15, Math.min(6, this.scale * Math.exp(-event.deltaY * 0.001)));
      this.offset = { x: event.clientX - box.left - before.x * this.scale,
        y: event.clientY - box.top - before.y * this.scale };
      this.draw();
    }, { signal, passive: false });
    this.dialog.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); this.endPointer();
        if (event.shiftKey) this.model.redo(); else this.model.undo();
        this.changed();
      }
    }, { signal });
    this.dialog.addEventListener('keyup', (event) => event.stopPropagation(), { signal });
    this.dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.finish(); }, { signal });
    this.dialog.append(bar, help, this.canvas, this.status, upload);
    document.body.append(this.dialog);
    this.dialog.showModal();
    this.choose(true);
    window.addEventListener('resize', () => this.fit(), { signal });
    this.updateTint(); this.fit();
  }

  destroy() {
    if (this.closed) return;
    this.closed = true;
    this.abort.abort(); this.dialog.remove();
  }

  private choose(walkable: boolean) {
    this.walkable = walkable;
    this.walkButton.setAttribute('aria-pressed', String(walkable));
    this.blockButton.setAttribute('aria-pressed', String(!walkable));
    this.draw();
  }

  private point(clientX: number, clientY: number) {
    const box = this.canvas.getBoundingClientRect();
    return { x: (clientX - box.left - this.offset.x) / this.scale,
      y: (clientY - box.top - this.offset.y) / this.scale };
  }

  private pointerDown(event: PointerEvent) {
    if (event.button !== 0 && event.button !== 2 && event.button !== 1) return;
    this.canvas.setPointerCapture(event.pointerId);
    if (event.button !== 0) { this.panning = { x: event.clientX, y: event.clientY }; return; }
    const point = this.point(event.clientX, event.clientY);
    this.model.beginStroke(); this.painting = point;
    this.model.paint(point, point, Number(this.brush.value) / 2, this.walkable);
    this.updateTint(); this.draw();
  }

  private pointerMove(event: PointerEvent) {
    if (this.panning) {
      this.offset.x += event.clientX - this.panning.x; this.offset.y += event.clientY - this.panning.y;
      this.panning = { x: event.clientX, y: event.clientY };
    } else if (this.painting) {
      const point = this.point(event.clientX, event.clientY);
      this.model.paint(this.painting, point, Number(this.brush.value) / 2, this.walkable);
      this.painting = point; this.updateTint();
    }
    this.hover = this.point(event.clientX, event.clientY); this.draw();
  }

  private endPointer() {
    if (this.painting) { this.model.endStroke(); this.painting = undefined; this.changed(); }
    this.panning = undefined;
  }

  private updateTint() {
    this.tint.width = this.model.width; this.tint.height = this.model.height;
    const context = this.tint.getContext('2d')!;
    const pixels = context.createImageData(this.model.width, this.model.height);
    for (let i = 0; i < this.model.mask.length; i++) {
      pixels.data[i * 4] = this.model.mask[i] ? 41 : 235;
      pixels.data[i * 4 + 1] = this.model.mask[i] ? 141 : 65;
      pixels.data[i * 4 + 2] = this.model.mask[i] ? 255 : 65;
      pixels.data[i * 4 + 3] = this.model.mask[i] ? 80 : 45;
    }
    context.putImageData(pixels, 0, 0);
    this.undoButton.disabled = !this.model.canUndo; this.redoButton.disabled = !this.model.canRedo;
  }

  private fit() {
    const box = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(box.width));
    this.canvas.height = Math.max(1, Math.round(box.height));
    this.scale = Math.min(this.canvas.width / this.model.width, this.canvas.height / this.model.height);
    this.offset = { x: (this.canvas.width - this.model.width * this.scale) / 2,
      y: (this.canvas.height - this.model.height * this.scale) / 2 };
    this.draw();
  }

  private draw() {
    const context = this.canvas.getContext('2d')!;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.save(); context.translate(this.offset.x, this.offset.y); context.scale(this.scale, this.scale);
    context.imageSmoothingEnabled = false;
    context.drawImage(this.image, 0, 0); context.drawImage(this.tint, 0, 0);
    if (this.hover && !this.panning) {
      context.beginPath(); context.arc(this.hover.x, this.hover.y, Number(this.brush.value) / 2, 0, Math.PI * 2);
      context.strokeStyle = this.walkable ? '#a8ddff' : '#ffaaaa'; context.lineWidth = 2 / this.scale; context.stroke();
    }
    context.restore();
  }

  private changed() {
    this.updateTint(); this.draw();
    try {
      localStorage.setItem(collisionDraftKey(this.id), maskCanvas(this.model.width, this.model.height, this.model.mask).toDataURL('image/png'));
      this.status.textContent = 'Saved in this browser. Playtest to try it, or export PNG to keep a copy.';
    } catch {
      this.status.textContent = 'Browser storage is unavailable. Export PNG to keep your changes.';
    }
  }

  private async importMask(upload: HTMLInputElement) {
    const file = upload.files?.[0]; if (!file) return;
    try {
      const image = await createImageBitmap(file);
      try {
        if (image.width !== this.model.width || image.height !== this.model.height) {
          throw new Error(`Use a ${this.model.width} × ${this.model.height} PNG.`);
        }
        if (this.closed) return;
        this.model.replace(maskFromImage(image, this.model.width, this.model.height)); this.changed();
      } finally { image.close(); }
    } catch (error) { this.status.textContent = error instanceof Error ? error.message : 'Could not read this PNG.'; }
    upload.value = '';
  }

  private exportMask() {
    this.endPointer();
    maskCanvas(this.model.width, this.model.height, this.model.mask).toBlob((blob) => {
      if (!blob || this.closed) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${this.id}-collision.png`; link.href = url;
      this.dialog.append(link); link.click();
      window.setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
      this.status.textContent = 'Exported PNG: white is walkable; black is blocked.';
    }, 'image/png');
  }

  private finish() {
    this.endPointer();
    if (!this.apply(this.model.mask)) {
      this.status.textContent = 'Leave enough walkable ground for the player before playtesting.'; return;
    }
    this.destroy(); this.close();
  }
}
