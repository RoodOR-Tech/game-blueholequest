import Phaser from 'phaser';
import {
  DAD_SPRITE_PATH,
  DAD_TEXTURE_KEY,
  registerDadAnimations,
} from '../actors/dadAnimations';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image(DAD_TEXTURE_KEY, DAD_SPRITE_PATH);
  }

  create(): void {
    registerDadAnimations(this);
    this.scene.start('title');
  }
}

