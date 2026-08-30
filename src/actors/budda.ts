import Phaser from 'phaser';

export const BUDDA_TEXTURE_KEY = 'budda-cat';

export function ensureBuddaTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BUDDA_TEXTURE_KEY)) return;
  const g = scene.add.graphics();
  const outline = 0x2b1812;
  const ginger = 0xc96327;
  const lightGinger = 0xe89043;
  const cream = 0xf4c38e;
  const stripe = 0x8b3d1c;

  // Curled tail gives Budda a readable cat silhouette even at game scale.
  g.lineStyle(6, outline).beginPath().moveTo(9, 17).lineTo(3, 14).lineTo(3, 8).lineTo(7, 6).strokePath();
  g.lineStyle(3, ginger).beginPath().moveTo(9, 17).lineTo(4, 14).lineTo(4, 9).lineTo(7, 7).strokePath();

  // Body, haunch, head, and pointed ears with a dark pixel-art outline.
  g.fillStyle(outline).fillEllipse(18, 16, 27, 17).fillCircle(29, 10, 10);
  g.fillTriangle(21, 5, 23, 0, 28, 6).fillTriangle(30, 5, 35, 0, 37, 8);
  g.fillStyle(ginger).fillEllipse(18, 15, 23, 13).fillCircle(29, 10, 8);
  g.fillTriangle(23, 5, 24, 2, 28, 6).fillTriangle(31, 5, 34, 2, 35, 7);
  g.fillStyle(0xe9a07d).fillTriangle(24, 4, 25, 3, 27, 5).fillTriangle(32, 5, 34, 3, 34, 6);

  // Chest, muzzle, paws, and belly highlights add volume.
  g.fillStyle(lightGinger).fillEllipse(20, 17, 16, 9);
  g.fillStyle(cream).fillEllipse(29, 13, 10, 6).fillTriangle(25, 14, 25, 21, 30, 20);
  g.fillRoundedRect(10, 19, 8, 4, 2).fillRoundedRect(25, 19, 8, 4, 2);
  g.lineStyle(1, outline).lineBetween(14, 21, 14, 23).lineBetween(29, 21, 29, 23);

  // Sleepy, slightly mischievous expression.
  g.fillStyle(0xf7df74).fillEllipse(26, 9, 4, 3).fillEllipse(32, 9, 4, 3);
  g.fillStyle(outline).fillRect(26, 8, 1, 3).fillRect(32, 8, 1, 3);
  g.fillStyle(0x7b3528).fillTriangle(27, 12, 29, 11, 31, 12);
  g.lineStyle(1, outline).lineBetween(29, 13, 27, 15).lineBetween(29, 13, 31, 15);
  g.lineBetween(25, 13, 19, 12).lineBetween(25, 15, 19, 16);
  g.lineBetween(33, 13, 39, 12).lineBetween(33, 15, 39, 16);

  // Distinctive ginger tabby markings.
  g.lineStyle(2, stripe).lineBetween(27, 3, 28, 6).lineBetween(30, 3, 30, 6).lineBetween(33, 4, 32, 7);
  g.lineBetween(12, 10, 14, 13).lineBetween(16, 8, 18, 12).lineBetween(9, 16, 13, 17);
  g.generateTexture(BUDDA_TEXTURE_KEY, 40, 24).destroy();
}
