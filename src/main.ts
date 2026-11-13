import Phaser from 'phaser';
import { FieldScene } from './FieldScene';
import { PauseScene } from './PauseScene';
import { MapScene } from './MapScene';
import content from './content/game.json';
import './style.css';

document.documentElement.style.setProperty('--game-aspect', String(content.viewport.width / content.viewport.height));

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: content.viewport.width,
  height: content.viewport.height,
  backgroundColor: '#72a449',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [FieldScene, PauseScene, MapScene],
});
