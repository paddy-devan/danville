import Phaser from 'phaser';

export class PauseScene extends Phaser.Scene {
  private pauseKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('pause');
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x15251b, 0.65)
      .setInteractive();

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f5f0d4',
      backgroundColor: '#34552d',
      fixedWidth: 160,
      fixedHeight: 44,
      align: 'center',
      padding: { top: 12 },
    };

    const play = this.add.text(width / 2, height / 2 - 28, 'Play', style)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    play.on('pointerover', () => play.setBackgroundColor('#486c3c'));
    play.on('pointerout', () => play.setBackgroundColor('#34552d'));
    play.on('pointerup', () => this.resumeGame());

    // Reserved for future settings; no options are implemented yet.
    this.add.text(width / 2, height / 2 + 28, 'Options', {
      ...style,
      color: '#b4bda5',
      backgroundColor: '#2b4029',
    }).setOrigin(0.5);

    this.pauseKey = this.input.keyboard!.addKey('P');
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) && !this.pauseKey.originalEvent.repeat) {
      this.resumeGame();
    }
  }

  private resumeGame() {
    this.scene.resume('field');
    this.scene.stop();
  }
}
