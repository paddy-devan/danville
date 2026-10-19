import Phaser from 'phaser';
import { FieldScene } from './FieldScene';
import content from './content/game.json';
import './style.css';

document.documentElement.style.setProperty('--game-aspect', String(content.world.width / content.world.height));

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: content.world.width,
  height: content.world.height,
  backgroundColor: '#72a449',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: FieldScene,
});
