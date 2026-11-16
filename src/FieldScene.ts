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
import { fieldCollisionLayout, locationGroundMask, locationWalls, nearestLocationPosition, replaceLocationMask } from './location';
import type { LocationLayout } from './location';
import { CollisionEditor, collisionDraftKey, maskFromImage } from './CollisionEditor';
import propLayouts from './content/props.json';
import { buildProps } from './props';
import type { PropLayout } from './props';

interface LevelSettings {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  name: string;
  mapEnabled?: boolean;
  layout?: { image: string; data: string; mask?: string };
  paths?: typeof content.world.paths | boolean;
  props?: string;
  collisionMask?: string;
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
  collisionMask?: string;
  paths?: typeof content.world.paths;
  levelEntrance?: typeof content.world.levelEntrance;
};

export class FieldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private movementKeys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private mapKey!: Phaser.Input.Keyboard.Key;
  private state!: PlayerState;
  private bounds!: Bounds;
  private terrain = new Map<string, Phaser.GameObjects.GameObject[]>();
  private readonly world: WorldSettings;
  private readonly paths;
  private readonly props;
  private tent?: Phaser.GameObjects.Image;
  private playerOutline?: Phaser.GameObjects.Sprite;
  private playerPixels?: ImageData;
  private tentPixels?: ImageData;
  private obstacles: Bounds[];
  private readonly baseObstacles: Bounds[];
  private location?: LocationLayout;
  private collisionLayout!: LocationLayout;
  private locationLabel?: Phaser.GameObjects.Text;
  private levelLabel?: Phaser.GameObjects.Text;
  private collisionEditKey?: Phaser.Input.Keyboard.Key;
  private collisionEditor?: CollisionEditor;
  private originalLocationMask?: Uint8Array;

  constructor(key = 'field', private readonly level?: LevelSettings) {
    super(key);
    this.world = level ? { ...content.world, width: level.width, height: level.height,
      paths: level.paths === true ? content.world.paths : level.paths || undefined,
      levelEntrance: level.levelEntrance, collisionMask: level.collisionMask } : content.world;
    this.paths = this.world.paths ? buildPaths(this.world.paths, this.world) : undefined;
    const propLayout = level ? level.props : content.world.props;
    this.props = propLayout ? buildProps((propLayouts as Record<string, PropLayout>)[propLayout], this.world) : [];
    this.baseObstacles = [
      ...(level?.tent?.collision ? tentWalls(level.spawn, level.tent.collision) : []),
      ...this.props.map((prop) => prop.bounds),
    ];
    this.obstacles = this.baseObstacles;
  }

  preload() {
    for (const image of new Set(this.props.map((prop) => prop.image))) {
      const key = `prop-${image}`;
      if (!this.textures.exists(key)) this.load.image(key, image);
    }
    if (this.level?.layout) {
      this.load.image(`location-${this.sys.settings.key}`, this.level.layout.image);
      this.load.json(`location-layout-${this.sys.settings.key}`, this.level.layout.data);
    }
    const mask = this.level?.layout?.mask ?? this.world.collisionMask;
    if (mask) this.load.image(`collision-mask-${this.sys.settings.key}`, mask);
    const draftKey = `collision-draft-${this.sys.settings.key}`;
    if (this.textures.exists(draftKey)) this.textures.remove(draftKey);
    try {
      const draft = localStorage.getItem(collisionDraftKey(this.sys.settings.key));
      if (draft?.startsWith('data:image/png;base64,')) this.load.image(draftKey, draft);
    } catch { /* Painting still works for this session when storage is unavailable. */ }
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
    this.levelLabel = undefined;
    this.locationLabel = undefined;
    this.location = this.level?.layout ? this.cache.json.get(`location-layout-${this.sys.settings.key}`) : undefined;
    this.collisionLayout = this.location ?? fieldCollisionLayout(world, this.baseObstacles);
    {
      const key = this.sys.settings.key;
      this.originalLocationMask ??= this.textures.exists(`collision-mask-${key}`)
        ? maskFromImage(this.textures.get(`collision-mask-${key}`).getSourceImage() as HTMLImageElement,
          this.world.width, this.world.height) : locationGroundMask(this.collisionLayout);
      replaceLocationMask(this.collisionLayout, this.originalLocationMask);
      const draft = this.textures.exists(`collision-draft-${key}`)
        ? this.textures.get(`collision-draft-${key}`).getSourceImage() as HTMLImageElement : undefined;
      if (draft?.width === this.world.width && draft.height === this.world.height) {
        replaceLocationMask(this.collisionLayout, maskFromImage(draft, this.world.width, this.world.height));
      }
      this.obstacles = locationWalls(this.collisionLayout);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.paths) {
        for (const key of this.terrain.keys()) this.textures.remove(this.pathTextureKey(key));
      }
      this.terrain.clear();
      this.collisionEditor?.destroy(); this.collisionEditor = undefined;
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
    {
      let safe = nearestLocationPosition(this.collisionLayout, this.state.x, this.state.y, this.bounds);
      if (!safe) {
        replaceLocationMask(this.collisionLayout, this.originalLocationMask!);
        this.obstacles = locationWalls(this.collisionLayout);
        safe = nearestLocationPosition(this.collisionLayout, this.state.x, this.state.y, this.bounds);
      }
      if (safe) Object.assign(this.state, safe);
    }
    const x = Math.round(this.state.x);
    const y = Math.round(this.state.y);
    this.shadow = this.add.ellipse(x, y - 2, 16, 5, 0x2c502c, 0.28).setDepth(1.5);
    this.player = this.add.sprite(x, y, 'player', player.animations.down.idle)
      .setOrigin(0.5, 1).setDepth(2 + y / world.height);
    for (const prop of this.props) {
      this.add.image(prop.x, prop.y, `prop-${prop.image}`)
        .setOrigin(0.5, 1).setDisplaySize(prop.width, prop.height)
        .setFlipX(prop.flipX ?? false).setDepth(2 + prop.y / world.height).setName(prop.id);
    }
    if (this.level?.tent) this.createTent(spawn);
    if (this.location) this.createLocation();

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
      this.levelLabel = this.add.text(12, 12, this.level.name, {
        fontFamily: 'monospace', fontSize: '12px', color: '#fffde9',
        backgroundColor: '#243c2b', padding: { x: 6, y: 4 },
      }).setScrollFactor(0).setDepth(10);
    }

    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.setCameraZoom(content.camera.zoom);
    this.updateTerrain();

    this.movementKeys = this.input.keyboard!.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as typeof this.movementKeys;
    this.pauseKey = this.input.keyboard!.addKey('P');
    this.mapKey = this.input.keyboard!.addKey('M');
    this.collisionEditKey = this.input.keyboard!.addKey('E');
    const updateControlsHint = () => {
      const controls = document.getElementById('controls');
      if (controls) {
        controls.textContent = 'WASD to move · Scroll to zoom · P to pause'
          + (this.level?.mapEnabled === false ? '' : ' · M for map')
          + ' · E to paint';
      }
    };
    updateControlsHint();
    this.events.on(Phaser.Scenes.Events.WAKE, updateControlsHint);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.WAKE, updateControlsHint);
    });
    // Phaser clears held keys on blur, preventing movement sticking after a tab switch.
    this.input.keyboard!.addCapture(['W', 'A', 'S', 'D']);
    const onWheel = (event: WheelEvent) => {
      if (!this.sys.isActive()) return;
      event.preventDefault();
      // Wheel deltas may be pixels, lines or pages, depending on the input device.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.scale.height : 1;
      this.setCameraZoom(this.cameras.main.zoom
        * Math.exp(-event.deltaY * unit * content.camera.wheelSensitivity));
      this.updateTerrain();
    };
    this.game.canvas.addEventListener('wheel', onWheel, { passive: false });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.canvas.removeEventListener('wheel', onWheel);
    });
  }

  update(_time: number, delta: number) {
    if (!this.movementKeys) return;
    if (this.collisionEditKey && Phaser.Input.Keyboard.JustDown(this.collisionEditKey)
      && !this.collisionEditKey.originalEvent.repeat) {
      this.openCollisionEditor(); return;
    }
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
      x: Number(this.movementKeys.right.isDown) - Number(this.movementKeys.left.isDown),
      y: Number(this.movementKeys.down.isDown) - Number(this.movementKeys.up.isDown),
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
    this.player.setDepth(2 + y / this.world.height);
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
    this.updateLocation();
  }

  private createLocation() {
    this.add.image(0, 0, `location-${this.sys.settings.key}`).setOrigin(0).setDepth(0);
    const overlay = this.location!.walkableOverlay;
    if (overlay) {
      const key = `walkable-overlay-${this.sys.settings.key}`;
      this.textures.createCanvas(key, this.world.width, this.world.height);
      this.add.image(0, 0, key).setOrigin(0).setDepth(0.5)
        .setAlpha(overlay.alpha).setName('walkable-overlay');
      this.refreshLocationOverlay();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.textures.remove(key));
    }
    this.locationLabel = this.add.text(12, 42, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#fffde9',
      backgroundColor: '#243c2b', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(10).setVisible(false);
    for (const exit of this.location!.exits) {
      this.add.text(exit.x, exit.y - 24, exit.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#fffde9',
        backgroundColor: '#243c2b', padding: { x: 5, y: 3 },
      }).setOrigin(0.5, 1).setDepth(1);
    }
  }

  private refreshLocationOverlay() {
    const overlay = this.location?.walkableOverlay;
    if (!overlay) return;
    const texture = this.textures.get(`walkable-overlay-${this.sys.settings.key}`) as Phaser.Textures.CanvasTexture;
    const context = texture.context;
    context.clearRect(0, 0, this.world.width, this.world.height);
    context.fillStyle = overlay.color;
    context.fillRect(this.bounds.left, this.bounds.top,
      this.bounds.right - this.bounds.left, this.bounds.bottom - this.bounds.top);
    for (const wall of this.obstacles) context.clearRect(wall.left, wall.top, wall.right - wall.left, wall.bottom - wall.top);
    texture.refresh();
  }

  private openCollisionEditor() {
    if (this.collisionEditor) return;
    this.player.stop();
    this.scene.pause();
    this.collisionEditor = new CollisionEditor(this.sys.settings.key,
      this.location ? this.textures.get(`location-${this.sys.settings.key}`).getSourceImage() as HTMLImageElement
        : this.createFieldPreview(),
      this.world.width, this.world.height, locationGroundMask(this.collisionLayout), this.originalLocationMask!,
      (mask) => {
        const previous = locationGroundMask(this.collisionLayout);
        replaceLocationMask(this.collisionLayout, mask);
        const safe = nearestLocationPosition(this.collisionLayout, this.state.x, this.state.y, this.bounds);
        if (!safe) { replaceLocationMask(this.collisionLayout, previous); return false; }
        Object.assign(this.state, safe);
        this.obstacles = locationWalls(this.collisionLayout);
        this.refreshLocationOverlay();
        return true;
      }, () => {
        this.collisionEditor = undefined;
        this.input.keyboard!.resetKeys();
        this.scene.resume();
      }, this.level?.name ?? 'Grassland');
    this.collisionEditor.open();
  }

  private updateLocation() {
    if (!this.location) return;
    const door = this.location.buildings.flatMap((building) => building.doors)
      .find((door) => Math.hypot(this.state.x - door.x, this.state.y - door.y) < 36);
    this.locationLabel!.setText(door?.name ?? '').setVisible(!!door);
    for (const exit of this.location.exits) {
      if (!exit.scene || Math.hypot(this.state.x - exit.x, this.state.y - exit.y) > 18) continue;
      // Leave a safe return position so a map visit cannot immediately retrigger the exit.
      this.state.x = exit.arrival?.x ?? exit.x;
      this.state.y = exit.arrival?.y ?? exit.y - 48;
      this.player.setPosition(Math.round(this.state.x), Math.round(this.state.y));
      this.shadow.setPosition(this.player.x, this.player.y - 2);
      this.scene.switch(exit.scene);
      return;
    }
  }

  private createTent(spawn: { x: number; y: number }) {
    const settings = this.level!.tent!;
    this.tent = this.add.image(spawn.x + settings.offsetFromSpawn.x,
      spawn.y + settings.offsetFromSpawn.y, `tent-${this.sys.settings.key}`)
      .setOrigin(0.5, 1).setDisplaySize(settings.width, settings.height)
      .setDepth(2 + (spawn.y + (settings.collision?.bounds.bottom ?? settings.offsetFromSpawn.y))
        / this.world.height).setName('spawn-tent');

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
      .setOrigin(0.5, 1).setDepth(this.tent.depth + 0.001).setAlpha(0.85).setName('player-outline');
    this.updateTentOcclusion();
  }

  private updateTentOcclusion() {
    if (!this.tent || !this.playerOutline || !this.tentPixels || !this.playerPixels) return;
    const player = this.player;
    // Walking through the right doorway brings the player in front of its canvas.
    const collision = this.level?.tent?.collision;
    const pastDoor = collision && player.x >= this.level!.spawn.x + collision.bounds.right;
    const besideDoor = pastDoor && player.x < this.tent.x + this.tent.displayWidth / 2 + content.player.frameWidth / 2
      && player.y > this.tent.y - this.tent.displayHeight && player.y < this.tent.y;
    player.setDepth(Math.max(2 + player.y / this.world.height, besideDoor ? this.tent.depth + 0.0001 : 0));
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

  private setCameraZoom(zoom: number) {
    const camera = this.cameras.main;
    // Never zoom far enough out to expose space beyond the map's bounds.
    const minimum = Math.max(content.camera.minZoom, camera.width / this.world.width,
      camera.height / this.world.height);
    camera.setZoom(Phaser.Math.Clamp(zoom, minimum, Math.max(minimum, content.camera.maxZoom)));
    // Counter the world zoom so screen labels keep their size and screen position.
    for (const [label, top] of [[this.levelLabel, 12], [this.locationLabel, 42]] as const) {
      label?.setScale(1 / camera.zoom).setPosition(
        camera.width / 2 + (12 - camera.width / 2) / camera.zoom,
        camera.height / 2 + (top - camera.height / 2) / camera.zoom);
    }
  }

  private updateTerrain() {
    const camera = this.cameras.main;
    camera.centerOn(this.player.x, this.player.y);
    if (this.location) return;
    // Phaser scroll is based on the unzoomed viewport; include the zoom's offset.
    const width = camera.displayWidth, height = camera.displayHeight;
    const chunks = visibleChunks({ x: camera.scrollX + (camera.width - width) / 2,
      y: camera.scrollY + (camera.height - height) / 2, width, height }, this.world);
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

  private createFieldPreview() {
    const canvas = document.createElement('canvas');
    canvas.width = this.world.width;
    canvas.height = this.world.height;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingEnabled = false;
    context.fillStyle = context.createPattern(
      this.textures.get('grass').getSourceImage() as HTMLImageElement, 'repeat')!;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (this.paths) this.drawPaths(context);
    const grass = this.world.longGrass;
    const sheet = this.textures.get('long-grass').getSourceImage() as HTMLImageElement;
    for (const tuft of grassInChunk({ key: 'preview', x: 0, y: 0,
      width: canvas.width, height: canvas.height }, this.world, this.paths)) {
      context.drawImage(sheet, tuft.frame * grass.frameWidth, 0, grass.frameWidth, grass.frameHeight,
        tuft.x, tuft.y, grass.frameWidth, grass.frameHeight);
    }
    const objects = this.props.map((prop) => ({ x: prop.x, y: prop.y,
      width: prop.width, height: prop.height, depth: prop.y,
      texture: `prop-${prop.image}`, flipX: prop.flipX ?? false }));
    const tent = this.level?.tent;
    if (tent) {
      const spawn = this.level!.spawn;
      objects.push({ x: spawn.x + tent.offsetFromSpawn.x, y: spawn.y + tent.offsetFromSpawn.y,
        width: tent.width, height: tent.height,
        depth: spawn.y + (tent.collision?.bounds.bottom ?? tent.offsetFromSpawn.y),
        texture: `tent-${this.sys.settings.key}`, flipX: false });
    }
    for (const object of objects.sort((a, b) => a.depth - b.depth)) {
      context.save(); context.translate(object.x, object.y);
      if (object.flipX) context.scale(-1, 1);
      context.drawImage(this.textures.get(object.texture).getSourceImage() as HTMLImageElement,
        -object.width / 2, -object.height, object.width, object.height);
      context.restore();
    }
    return canvas;
  }

  private createPathChunk(chunk: TerrainChunk) {
    const texture = this.textures.createCanvas(this.pathTextureKey(chunk.key), chunk.width, chunk.height)!;
    const context = texture.context;
    // Draw in world coordinates, so both the pattern and curves meet at chunk boundaries.
    context.translate(-chunk.x, -chunk.y);
    context.imageSmoothingEnabled = false;
    this.drawPaths(context);
    texture.refresh();
    return this.add.image(chunk.x, chunk.y, texture.key).setOrigin(0).setDepth(0.5);
  }

  private drawPaths(context: CanvasRenderingContext2D) {
    const paths = this.paths!;
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
  }
}
