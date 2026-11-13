import Phaser from 'phaser';
import content from './content/game.json';
import { movePlayer } from './movement';
import type { Bounds, PlayerState } from './movement';
import { grassInChunk, visibleChunks } from './terrain';
import { buildPaths } from './paths';
import type { TerrainChunk } from './terrain';

export class FieldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private mapKey!: Phaser.Input.Keyboard.Key;
  private state!: PlayerState;
  private bounds!: Bounds;
  private terrain = new Map<string, Phaser.GameObjects.GameObject[]>();
  private paths = buildPaths(content.world.paths, content.world);

  constructor() {
    super('field');
  }

  preload() {
    this.load.image('grass', content.world.ground);
    this.load.image('cobblestone', content.world.paths.texture);
    this.load.spritesheet('long-grass', content.world.longGrass.spriteSheet, {
      frameWidth: content.world.longGrass.frameWidth,
      frameHeight: content.world.longGrass.frameHeight,
    });
    this.load.spritesheet('player', content.player.spriteSheet, {
      frameWidth: content.player.frameWidth,
      frameHeight: content.player.frameHeight,
    });
  }

  create() {
    const { world, player } = content;
    this.terrain.clear();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const key of this.terrain.keys()) this.textures.remove(`path-${key}`);
      this.terrain.clear();
    });

    for (const [direction, frames] of Object.entries(player.animations)) {
      this.anims.create({
        key: `walk-${direction}`,
        frames: frames.walk.map((frame) => ({ key: 'player', frame })),
        frameRate: player.walkFrameRate,
        repeat: -1,
      });
    }

    this.state = { ...player.spawn, facing: 'down', moving: false };
    this.bounds = {
      left: player.frameWidth / 2 + 4,
      right: world.width - player.frameWidth / 2 - 4,
      top: player.frameHeight + 4,
      bottom: world.height - 4,
    };
    this.shadow = this.add.ellipse(this.state.x, this.state.y - 2, 16, 5, 0x2c502c, 0.28).setDepth(2);
    this.player = this.add.sprite(this.state.x, this.state.y, 'player', player.animations.down.idle)
      .setOrigin(0.5, 1).setDepth(3);

    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.updateTerrain();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.pauseKey = this.input.keyboard!.addKey('P');
    this.mapKey = this.input.keyboard!.addKey('M');
    // Phaser clears held keys on blur, preventing movement sticking after a tab switch.
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);
  }

  update(_time: number, delta: number) {
    if (!this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.mapKey) && !this.mapKey.originalEvent.repeat) {
      this.scene.launch('map');
      this.scene.pause();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) && !this.pauseKey.originalEvent.repeat) {
      this.scene.launch('pause');
      this.scene.pause();
      return;
    }

    this.state = movePlayer(this.state, {
      x: Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
      y: Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown),
    }, Math.min(delta, 50) / 1000, content.player.speed, this.bounds);

    this.player.setPosition(this.state.x, this.state.y);
    this.shadow.setPosition(this.state.x, this.state.y - 2);
    this.updateTerrain();
    const animation = content.player.animations[this.state.facing];
    this.player.setFlipX(animation.flipX);

    if (this.state.moving) {
      this.player.play(`walk-${this.state.facing}`, true);
    } else {
      this.player.stop();
      this.player.setFrame(animation.idle);
    }
  }

  private updateTerrain() {
    const camera = this.cameras.main;
    camera.centerOn(this.player.x, this.player.y);
    const chunks = visibleChunks({ x: camera.scrollX, y: camera.scrollY,
      width: camera.width, height: camera.height }, content.world);
    const needed = new Set(chunks.map((chunk) => chunk.key));
    for (const [key, objects] of this.terrain) {
      if (needed.has(key)) continue;
      for (const object of objects) object.destroy();
      this.textures.remove(`path-${key}`);
      this.terrain.delete(key);
    }
    for (const chunk of chunks) {
      if (this.terrain.has(chunk.key)) continue;
      const ground = this.add.tileSprite(chunk.x, chunk.y, chunk.width, chunk.height, 'grass').setOrigin(0);
      // World-aligned texture offsets also keep non-tile-sized chunks seamless.
      ground.setTilePosition(chunk.x, chunk.y);
      const path = this.createPathChunk(chunk);
      const tufts = grassInChunk(chunk, content.world, this.paths).map((tuft) =>
        this.add.image(tuft.x, tuft.y, 'long-grass', tuft.frame).setOrigin(0).setDepth(1));
      this.terrain.set(chunk.key, [ground, path, ...tufts]);
    }
  }

  private createPathChunk(chunk: TerrainChunk) {
    const texture = this.textures.createCanvas(`path-${chunk.key}`, chunk.width, chunk.height)!;
    const context = texture.context;
    // Draw in world coordinates, so both the pattern and curves meet at chunk boundaries.
    context.translate(-chunk.x, -chunk.y);
    context.imageSmoothingEnabled = false;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    for (const route of this.paths.routes) {
      if (route.length < 2) continue;
      context.moveTo(route[0].x, route[0].y);
      for (const point of route.slice(1)) context.lineTo(point.x, point.y);
    }
    context.strokeStyle = '#777353';
    context.lineWidth = this.paths.width + 4;
    context.stroke();
    context.strokeStyle = context.createPattern(
      this.textures.get('cobblestone').getSourceImage() as HTMLImageElement, 'repeat')!;
    context.lineWidth = this.paths.width;
    context.stroke();
    texture.refresh();
    return this.add.image(chunk.x, chunk.y, texture.key).setOrigin(0).setDepth(0.5);
  }
}
