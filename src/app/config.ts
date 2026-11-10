import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from './display';
import { BootScene } from '../scenes/BootScene';
import { BlueHoleHubScene } from '../scenes/BlueHoleHubScene';
import { Highway26Scene } from '../scenes/Highway26Scene';
import { LocationBossScene } from '../scenes/LocationBossScene';
import { LocationArrivalScene } from '../scenes/LocationArrivalScene';
import { RouteActionScene } from '../scenes/RouteActionScene';
import { TeamSelectScene } from '../scenes/TeamSelectScene';
import { TitleScene } from '../scenes/TitleScene';
import { VictoryCelebrationScene } from '../scenes/VictoryCelebrationScene';

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
    LocationArrivalScene,
    LocationBossScene,
    RouteActionScene,
    VictoryCelebrationScene,
  ],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      // World bounds stay in world pixels regardless of the render scale.
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    },
  },
  input: { gamepad: true },
  scale: {
    // installDisplay sizes the canvas to a whole number of device pixels.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
};
