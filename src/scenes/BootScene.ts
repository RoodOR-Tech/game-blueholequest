import Phaser from 'phaser';
import {
  preloadFamilySprites,
  registerFamilyAnimations,
} from '../actors/familyAnimations';
import { ensureBuddaTexture, preloadBuddaSprites } from '../actors/budda';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../app/display';

const BAR_WIDTH = 120;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 18, 'THE BLUE HOLE QUEST', {
        color: '#73ddff',
        fontSize: '11px',
      })
      .setOrigin(0.5);
    const status = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 16, 'LOADING THE FAMILY…', {
        color: '#cfe9f4',
        fontSize: '7px',
      })
      .setOrigin(0.5);
    this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, BAR_WIDTH + 4, 8)
      .setStrokeStyle(1, 0xcfe9f4);
    const bar = this.add
      .rectangle(
        (WORLD_WIDTH - BAR_WIDTH) / 2,
        WORLD_HEIGHT / 2,
        BAR_WIDTH,
        4,
        0xf6d77a,
      )
      .setOrigin(0, 0.5)
      .setScale(0, 1);
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) =>
      bar.setScale(progress, 1),
    );
    this.load.once(Phaser.Loader.Events.COMPLETE, () =>
      status.setText('GETTING EVERYONE READY…'),
    );

    preloadFamilySprites(this);
    preloadBuddaSprites(this);
  }

  create(): void {
    // Let the "getting ready" message paint before the sprite clean-up runs.
    this.time.delayedCall(60, () => {
      registerFamilyAnimations(this);
      ensureBuddaTexture(this);
      this.scene.start('title');
    });
  }
}
