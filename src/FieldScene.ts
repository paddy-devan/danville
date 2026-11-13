import Phaser from 'phaser';
import content from './content/game.json';
import { movePlayer } from './movement';
import type { Bounds, PlayerState } from './movement';
import { grassInChunk, visibleChunks } from './terrain';
import { buildPaths } from './paths';
import type { TerrainChunk } from './terrain';
import { outlineSpriteSheet } from './spriteOutline';
import { tentWalls } from './tent';
import type { TentCollision } from './tent';

interface LevelSettings {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  name: string;
  mapEnabled?: boolean;
  paths?: typeof content.world.paths | boolean;
  levelEntrance?: typeof content.world.levelEntrance;
  tent?: {
    returnScene?: string;
    returnArea?: Bounds;
    image: string;
    width: number;
    height: number;
    offsetFromSpawn: { x: number; y: number };
    collision?: TentCollision;
  };
}

type WorldSettings = Omit<typeof content.world, 'paths' | 'levelEntrance'> & {
  paths?: typeof content.world.paths;
  levelEntrance?: typeof content.world.levelEntrance;
};

export class FieldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private mapKey!: Phaser.Input.Keyboard.Key;
  private state!: PlayerState;
  private bounds!: Bounds;
  private terrain = new Map<string, Phaser.GameObjects.GameObject[]>();
  private readonly world: WorldSettings;
  private readonly paths;
  private tent?: Phaser.GameObjects.Image;
  private playerOutline?: Phaser.GameObjects.Sprite;
  private playerPixels?: ImageData;
  private tentPixels?: ImageData;
  private readonly obstacles: Bounds[];

  constructor(key = 'field', private readonly level?: LevelSettings) {
    super(key);
    this.world = level ? { ...content.world, width: level.width, height: level.height,
      paths: level.paths === true ? content.world.paths : level.paths || undefined,
      levelEntrance: level.levelEntrance } : content.world;
    this.paths = this.world.paths ? buildPaths(this.world.paths, this.world) : undefined;
    this.obstacles = level?.tent?.collision ? tentWalls(level.spawn, level.tent.collision) : [];
  }

  preload() {
    if (this.level?.tent) this.load.image(`tent-${this.sys.settings.key}`, this.level.tent.image);
    this.load.image('grass', this.world.ground);
    if (this.world.paths) this.load.image(`path-surface-${this.sys.settings.key}`, this.world.paths.texture);
    this.load.spritesheet('long-grass', this.world.longGrass.spriteSheet, {
      frameWidth: this.world.longGrass.frameWidth,
      frameHeight: this.world.longGrass.frameHeight,
    });
    this.load.spritesheet('player', content.player.spriteSheet, {
      frameWidth: content.player.frameWidth,
      frameHeight: content.player.frameHeight,
    });
  }

  create() {
    const world = this.world;
    const player = content.player;
    const spawn = this.level?.spawn ?? player.spawn;
    this.terrain.clear();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.paths) {
        for (const key of this.terrain.keys()) this.textures.remove(this.pathTextureKey(key));
      }
      this.terrain.clear();
    });

    for (const [direction, frames] of Object.entries(player.animations)) {
      if (this.anims.exists(`walk-${direction}`)) continue;
      this.anims.create({
        key: `walk-${direction}`,
        frames: frames.walk.map((frame) => ({ key: 'player', frame })),
        frameRate: player.walkFrameRate,
        repeat: -1,
      });
    }

    this.state = { ...spawn, facing: 'down', moving: false };
    this.bounds = {
      left: player.frameWidth / 2 + 4,
      right: world.width - player.frameWidth / 2 - 4,
      top: player.frameHeight + 4,
      bottom: world.height - 4,
    };
    const x = Math.round(this.state.x);
    const y = Math.round(this.state.y);
    this.shadow = this.add.ellipse(x, y - 2, 16, 5, 0x2c502c, 0.28).setDepth(2);
    this.player = this.add.sprite(x, y, 'player', player.animations.down.idle)
      .setOrigin(0.5, 1).setDepth(3);
    if (this.level?.tent) this.createTent(spawn);

    const entrance = world.levelEntrance;
    if (entrance) {
      this.add.circle(spawn.x + entrance.offsetFromSpawn.x,
        spawn.y + entrance.offsetFromSpawn.y, entrance.radius, 0xffffff)
        .setName('level-entrance')
        .setDepth(1)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.scene.switch(entrance.scene));
    }

    if (this.level) {
      this.add.text(12, 12, this.level.name, {
        fontFamily: 'monospace', fontSize: '12px', color: '#fffde9',
        backgroundColor: '#243c2b', padding: { x: 6, y: 4 },
      }).setScrollFactor(0).setDepth(10);
    }

    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.updateTerrain();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.pauseKey = this.input.keyboard!.addKey('P');
    this.mapKey = this.input.keyboard!.addKey('M');
    const updateControlsHint = () => {
      const controls = document.getElementById('controls');
      if (controls) {
        controls.textContent = 'Arrow keys to move · P to pause'
          + (this.level?.mapEnabled === false ? '' : ' · M for map');
      }
    };
    updateControlsHint();
    this.events.on(Phaser.Scenes.Events.WAKE, updateControlsHint);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.WAKE, updateControlsHint);
    });
    // Phaser clears held keys on blur, preventing movement sticking after a tab switch.
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);
  }

  update(_time: number, delta: number) {
    if (!this.cursors) return;
    if (this.level?.mapEnabled !== false
      && Phaser.Input.Keyboard.JustDown(this.mapKey) && !this.mapKey.originalEvent.repeat) {
      this.scene.launch('map', { returnScene: this.sys.settings.key });
      this.scene.pause();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) && !this.pauseKey.originalEvent.repeat) {
      this.scene.launch('pause', { returnScene: this.sys.settings.key });
      this.scene.pause();
      return;
    }

    this.state = movePlayer(this.state, {
      x: Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
      y: Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown),
    }, Math.min(delta, 50) / 1000, content.player.speed, this.bounds, this.obstacles);

    const { returnScene, returnArea } = this.level?.tent ?? {};
    const spawn = this.level?.spawn;
    if (returnScene && returnArea && spawn
      && this.state.x >= spawn.x + returnArea.left && this.state.x <= spawn.x + returnArea.right
      && this.state.y >= spawn.y + returnArea.top && this.state.y <= spawn.y + returnArea.bottom) {
      this.scene.run(returnScene);
      // A fresh arena visit starts inside the tent, rather than on the return trigger.
      this.scene.stop();
      return;
    }

    // Keep fractional movement in state, but align the sprite, shadow and camera
    // to the same pixel grid before Phaser transforms individual terrain objects.
    const x = Math.round(this.state.x);
    const y = Math.round(this.state.y);
    this.player.setPosition(x, y);
    this.shadow.setPosition(x, y - 2);
    this.updateTerrain();
    const animation = content.player.animations[this.state.facing];
    this.player.setFlipX(animation.flipX);

    if (this.state.moving) {
      this.player.play(`walk-${this.state.facing}`, true);
    } else {
      this.player.stop();
      this.player.setFrame(animation.idle);
    }
    this.updateTentOcclusion();
  }

  private createTent(spawn: { x: number; y: number }) {
    const settings = this.level!.tent!;
    this.tent = this.add.image(spawn.x + settings.offsetFromSpawn.x,
      spawn.y + settings.offsetFromSpawn.y, `tent-${this.sys.settings.key}`)
      .setOrigin(0.5, 1).setDisplaySize(settings.width, settings.height)
      .setDepth(4).setName('spawn-tent');

    // Read sprite alpha once; the x-ray uses the real silhouette, not a rectangle.
    const sheet = this.textures.get('player').getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(sheet, 0, 0);
    this.playerPixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { frameWidth, frameHeight } = content.player;
    if (!this.textures.exists('player-outline')) {
      const texture = this.textures.createCanvas('player-outline', sheet.width, sheet.height)!;
      const pixels = texture.context.createImageData(sheet.width, sheet.height);
      pixels.data.set(outlineSpriteSheet(this.playerPixels.data, sheet.width, sheet.height,
        frameWidth, frameHeight));
      texture.context.putImageData(pixels, 0, 0);
      let index = 0;
      for (let y = 0; y < sheet.height; y += frameHeight) {
        for (let x = 0; x < sheet.width; x += frameWidth) {
          texture.add(index++, 0, x, y, frameWidth, frameHeight);
        }
      }
      texture.refresh();
    }

    canvas.width = settings.width;
    canvas.height = settings.height;
    context.imageSmoothingEnabled = false;
    context.drawImage(this.tent.texture.getSourceImage() as HTMLImageElement,
      0, 0, settings.width, settings.height);
    this.tentPixels = context.getImageData(0, 0, canvas.width, canvas.height);
    this.playerOutline = this.add.sprite(this.player.x, this.player.y, 'player-outline', this.player.frame.name)
      .setOrigin(0.5, 1).setDepth(6).setAlpha(0.85).setName('player-outline');
    this.updateTentOcclusion();
  }

  private updateTentOcclusion() {
    if (!this.tent || !this.playerOutline || !this.tentPixels || !this.playerPixels) return;
    const player = this.player;
    // Walking through the right doorway brings the player in front of its canvas.
    const collision = this.level?.tent?.collision;
    const pastDoor = collision && player.x >= this.level!.spawn.x + collision.bounds.right;
    player.setDepth(player.y >= this.tent.y || pastDoor ? 5 : 3);
    const { frameWidth, frameHeight } = content.player;
    const left = this.tent.x - this.tent.displayWidth / 2;
    const top = this.tent.y - this.tent.displayHeight;
    let covered = false;
    if (player.depth < this.tent.depth) {
      for (let y = 0; y < frameHeight && !covered; y++) {
        for (let x = 0; x < frameWidth; x++) {
          const source = ((player.frame.cutY + y) * this.playerPixels.width + player.frame.cutX + x) * 4;
          if (!this.playerPixels.data[source + 3]) continue;
          const tx = Math.floor(player.x - frameWidth / 2 + (player.flipX ? frameWidth - 1 - x : x) - left);
          const ty = Math.floor(player.y - frameHeight + y - top);
          if (tx >= 0 && tx < this.tentPixels.width && ty >= 0 && ty < this.tentPixels.height
            && this.tentPixels.data[(ty * this.tentPixels.width + tx) * 4 + 3] > 127) {
            covered = true;
            break;
          }
        }
      }
    }
    this.playerOutline.setPosition(player.x, player.y).setFrame(player.frame.name)
      .setFlipX(player.flipX).setVisible(covered);
  }

  private updateTerrain() {
    const camera = this.cameras.main;
    camera.centerOn(this.player.x, this.player.y);
    const chunks = visibleChunks({ x: camera.scrollX, y: camera.scrollY,
      width: camera.width, height: camera.height }, this.world);
    const needed = new Set(chunks.map((chunk) => chunk.key));
    for (const [key, objects] of this.terrain) {
      if (needed.has(key)) continue;
      for (const object of objects) object.destroy();
      if (this.paths) this.textures.remove(this.pathTextureKey(key));
      this.terrain.delete(key);
    }
    for (const chunk of chunks) {
      if (this.terrain.has(chunk.key)) continue;
      const ground = this.add.tileSprite(chunk.x, chunk.y, chunk.width, chunk.height, 'grass').setOrigin(0);
      // World-aligned texture offsets also keep non-tile-sized chunks seamless.
      ground.setTilePosition(chunk.x, chunk.y);
      const path = this.paths ? [this.createPathChunk(chunk)] : [];
      const tufts = grassInChunk(chunk, this.world, this.paths).map((tuft) =>
        this.add.image(tuft.x, tuft.y, 'long-grass', tuft.frame).setOrigin(0).setDepth(1));
      this.terrain.set(chunk.key, [ground, ...path, ...tufts]);
    }
  }

  private pathTextureKey(chunkKey: string) {
    return `path-${this.sys.settings.key}-${chunkKey}`;
  }

  private createPathChunk(chunk: TerrainChunk) {
    const paths = this.paths!;
    const texture = this.textures.createCanvas(this.pathTextureKey(chunk.key), chunk.width, chunk.height)!;
    const context = texture.context;
    // Draw in world coordinates, so both the pattern and curves meet at chunk boundaries.
    context.translate(-chunk.x, -chunk.y);
    context.imageSmoothingEnabled = false;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    for (const route of paths.routes) {
      if (route.length < 2) continue;
      context.moveTo(route[0].x, route[0].y);
      for (const point of route.slice(1)) context.lineTo(point.x, point.y);
    }
    context.strokeStyle = '#5e523e';
    context.lineWidth = paths.width + 4;
    context.stroke();
    context.strokeStyle = context.createPattern(
      this.textures.get(`path-surface-${this.sys.settings.key}`).getSourceImage() as HTMLImageElement, 'repeat')!;
    context.lineWidth = paths.width;
    context.stroke();
    texture.refresh();
    return this.add.image(chunk.x, chunk.y, texture.key).setOrigin(0).setDepth(0.5);
  }
}
