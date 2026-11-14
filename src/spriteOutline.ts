/** Trace opaque pixels without filling the sprite or bleeding into adjacent frames. */
export function outlineSpriteSheet(
  pixels: Uint8ClampedArray, width: number, height: number,
  frameWidth: number, frameHeight: number,
) {
  const outline = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (pixels[index + 3] !== 0) continue;
      const frameX = Math.floor(x / frameWidth) * frameWidth;
      const frameY = Math.floor(y / frameHeight) * frameHeight;
      let touchesSprite = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < frameX || nx >= frameX + frameWidth
            || ny < frameY || ny >= frameY + frameHeight) continue;
          if (pixels[(ny * width + nx) * 4 + 3] > 0) touchesSprite = true;
        }
      }
      if (touchesSprite) outline.set([255, 255, 255, 255], index);
    }
  }
  return outline;
}
