import Phaser from 'phaser';
import {
  DAD_SPRITE_PATH,
  DAD_TEXTURE_KEY,
  registerDadAnimations,
} from '../actors/dadAnimations';
import {
  preloadFamilySprites,
  registerFamilyAnimations,
} from '../actors/familyAnimations';
import { preloadBuddaSprites } from '../actors/budda';
import { installGameTextClarity } from '../ui/textClarity';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image(DAD_TEXTURE_KEY, DAD_SPRITE_PATH);
    preloadFamilySprites(this);
    preloadBuddaSprites(this);
  }

  create(): void {
    registerDadAnimations(this);
    registerFamilyAnimations(this);
    installGameTextClarity(this.game);
    this.scene.start('title');
  }
}
