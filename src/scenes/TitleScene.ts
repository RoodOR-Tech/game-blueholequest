import Phaser from 'phaser';

const COLORS = {
  ocean: 0x176eb0,
  sand: 0xd7b46a,
  forest: 0x28613c,
  snow: 0xd9edf2,
  panel: 0x08111d,
  frame: 0xcfe9f4,
} as const;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.ocean).fillRect(0, 0, 256, 240);
    graphics.fillStyle(COLORS.sand).fillRect(0, 135, 256, 105);
    graphics.fillStyle(COLORS.forest).fillTriangle(0, 145, 52, 58, 106, 145);
    graphics.fillTriangle(74, 145, 138, 42, 202, 145);
    graphics.fillStyle(COLORS.snow).fillTriangle(104, 94, 138, 42, 169, 94);

    graphics.fillStyle(COLORS.panel, 0.94).fillRoundedRect(19, 18, 218, 57, 4);
    graphics.lineStyle(2, COLORS.frame).strokeRoundedRect(19, 18, 218, 57, 4);

    this.add
      .text(128, 31, 'THE BLUE HOLE QUEST', {
        color: '#cfe9f4',
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(128, 53, 'ROOD HOLIDAY ADVENTURE', {
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '8px',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(128, 205, 'PRESS ENTER / TAP TO BEGIN', {
        backgroundColor: '#08111ddd',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '8px',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.35 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }
}

