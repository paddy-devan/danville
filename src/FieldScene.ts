import Phaser from 'phaser';
import content from './content/game.json';
import { movePlayer } from './movement';
import type { Bounds, PlayerState } from './movement';

export class FieldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private state!: PlayerState;
  private bounds!: Bounds;

  constructor() {
    super('field');
  }

  preload() {
    this.load.image('grass', content.world.ground);
    this.load.spritesheet('farmer', content.player.spriteSheet, {
      frameWidth: content.player.frameWidth,
      frameHeight: content.player.frameHeight,
    });
  }

  create() {
    const { world, player } = content;
    this.add.tileSprite(0, 0, world.width, world.height, 'grass').setOrigin(0);

    for (const [direction, frames] of Object.entries(player.animations)) {
      this.anims.create({
        key: `walk-${direction}`,
        frames: frames.walk.map((frame) => ({ key: 'farmer', frame })),
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
    this.shadow = this.add.ellipse(this.state.x, this.state.y - 2, 16, 5, 0x2c502c, 0.28);
    this.player = this.add.sprite(this.state.x, this.state.y, 'farmer', player.animations.down.idle)
      .setOrigin(0.5, 1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    // Phaser clears held keys on blur, preventing movement sticking after a tab switch.
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);
  }

  update(_time: number, delta: number) {
    if (!this.cursors) return;

    this.state = movePlayer(this.state, {
      x: Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
      y: Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown),
    }, Math.min(delta, 50) / 1000, content.player.speed, this.bounds);

    this.player.setPosition(this.state.x, this.state.y);
    this.shadow.setPosition(this.state.x, this.state.y - 2);
    const animation = content.player.animations[this.state.facing];
    this.player.setFlipX(animation.flipX);

    if (this.state.moving) {
      this.player.play(`walk-${this.state.facing}`, true);
    } else {
      this.player.stop();
      this.player.setFrame(animation.idle);
    }
  }
}
