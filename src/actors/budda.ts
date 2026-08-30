import Phaser from 'phaser';

export const BUDDA_TEXTURE_KEY = 'budda-cat';

export function ensureBuddaTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BUDDA_TEXTURE_KEY)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xb85f24).fillEllipse(13, 12, 21, 13);
  g.fillCircle(21, 8, 8);
  g.fillTriangle(16, 3, 18, 0, 21, 5);
  g.fillTriangle(22, 4, 26, 0, 27, 7);
  g.fillStyle(0xe58a3b).fillRect(5, 15, 16, 3);
  g.fillStyle(0xf3c18b).fillEllipse(22, 11, 7, 5);
  g.fillStyle(0x17151d).fillCircle(19, 7, 1).fillCircle(24, 7, 1);
  g.lineStyle(2, 0xb85f24).beginPath().moveTo(4, 11).lineTo(0, 6).strokePath();
  g.generateTexture(BUDDA_TEXTURE_KEY, 29, 19).destroy();
}
