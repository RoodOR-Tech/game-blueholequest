import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { BlueHoleHubScene } from '../scenes/BlueHoleHubScene';
import { Highway26Scene } from '../scenes/Highway26Scene';
import { TeamSelectScene } from '../scenes/TeamSelectScene';
import { TitleScene } from '../scenes/TitleScene';

export const WORLD_WIDTH = 256;
export const WORLD_HEIGHT = 240;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#08111d',
  pixelArt: true,
  roundPixels: true,
  scene: [
    BootScene,
    TitleScene,
    TeamSelectScene,
    BlueHoleHubScene,
    Highway26Scene,
  ],
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  input: { gamepad: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
};

