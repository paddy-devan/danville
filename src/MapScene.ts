import Phaser from 'phaser';

export class MapScene extends Phaser.Scene {
  private mapKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('map');
  }

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');
    // Extend the blank map across the browser's letterboxing and controls hint.
    document.documentElement.classList.add('map-open');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.documentElement.classList.remove('map-open');
    });
    this.mapKey = this.input.keyboard!.addKey('M');
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.mapKey) && !this.mapKey.originalEvent.repeat) {
      this.scene.resume('field');
      this.scene.stop();
    }
  }
}
