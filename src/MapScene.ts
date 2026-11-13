import Phaser from 'phaser';
import content from './content/game.json';

export class MapScene extends Phaser.Scene {
  private mapKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('map');
  }

  create() {
    const previousFocus = document.activeElement;
    const map = document.createElement('dialog');
    map.className = 'world-map';
    map.setAttribute('aria-label', 'Arena map. Press M to return to the game.');
    const landscape = document.createElement('div');
    landscape.className = 'map-landscape';
    landscape.style.backgroundImage = `url("${content.map.image}")`;
    map.append(landscape);
    // Keep the sketch's relative layout and proportions at any browser size.
    for (const arena of content.map.arenas) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-arena';
      button.dataset.arena = arena.id;
      button.setAttribute('aria-pressed', 'false');
      Object.assign(button.style, {
        left: `${arena.x}%`, top: `${arena.y}%`,
        width: `${arena.width}%`, height: `${arena.height}%`,
      });

      const terrain = document.createElement('span');
      terrain.className = 'map-arena-terrain';
      terrain.setAttribute('aria-hidden', 'true');
      if (arena.texture === 'ground') {
        terrain.style.backgroundImage = `url("${content.world.ground}")`;
      } else {
        // Sample the same part of the landscape underneath each ellipse.
        terrain.style.backgroundImage = `url("${content.map.image}")`;
        terrain.style.backgroundSize = `${10000 / arena.width}% ${10000 / arena.height}%`;
        terrain.style.backgroundPosition = `${100 * arena.x / (100 - arena.width)}% ${100 * arena.y / (100 - arena.height)}%`;
      }

      const label = document.createElement('span');
      label.className = 'map-arena-label';
      label.textContent = arena.label;
      button.append(terrain, label);
      button.addEventListener('click', () => {
        if (arena.scene) {
          this.scene.resume(arena.scene);
          this.scene.stop();
          return;
        }
        for (const other of map.querySelectorAll('.map-arena')) {
          other.setAttribute('aria-pressed', String(other === button));
        }
      });
      landscape.append(button);
    }

    // Native modal focus keeps keyboard navigation inside the map buttons.
    // Phaser captures Space for cursor keys; let the HTML buttons handle it here.
    const keepSpaceLocal = (event: KeyboardEvent) => {
      if (event.code === 'Space') event.stopPropagation();
    };
    map.addEventListener('keydown', keepSpaceLocal);
    map.addEventListener('keyup', keepSpaceLocal);
    map.addEventListener('cancel', (event) => event.preventDefault());
    document.body.append(map);
    document.documentElement.classList.add('map-open');
    map.showModal();
    // Focus the dialog on open instead of highlighting the first arena button.
    map.focus();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      map.remove();
      document.documentElement.classList.remove('map-open');
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
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
