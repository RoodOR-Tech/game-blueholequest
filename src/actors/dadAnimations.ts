import Phaser from 'phaser';

export const DAD_TEXTURE_KEY = 'dad-sprites-v1';
export const DAD_SPRITE_PATH = 'assets/sprites/dad-sprites-v1.png';
// Large enough to read facial detail and body motion against the room-scale art.
export const DAD_SPRITE_SCALE = 0.125;

const FRAMES = [
  { name: 'dad-idle-0', x: 0, width: 270 },
  { name: 'dad-idle-1', x: 270, width: 245 },
  { name: 'dad-walk-0', x: 515, width: 270 },
  { name: 'dad-walk-1', x: 785, width: 260 },
  { name: 'dad-walk-2', x: 1045, width: 185 },
  { name: 'dad-jump', x: 1230, width: 245 },
  { name: 'dad-attack-0', x: 1475, width: 310 },
  { name: 'dad-attack-1', x: 1785, width: 387 },
] as const;

export function registerDadAnimations(scene: Phaser.Scene): void {
  const texture = scene.textures.get(DAD_TEXTURE_KEY);
  FRAMES.forEach((frame) => {
    if (!texture.has(frame.name))
      texture.add(frame.name, 0, frame.x, 0, frame.width, 724);
  });
  if (!scene.anims.exists('dad-idle')) {
    scene.anims.create({
      key: 'dad-idle',
      frames: ['dad-idle-0', 'dad-idle-1'].map((frame) => ({
        key: DAD_TEXTURE_KEY,
        frame,
      })),
      frameRate: 2,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('dad-walk')) {
    scene.anims.create({
      key: 'dad-walk',
      frames: ['dad-walk-0', 'dad-walk-1', 'dad-walk-2'].map((frame) => ({
        key: DAD_TEXTURE_KEY,
        frame,
      })),
      frameRate: 7,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('dad-attack')) {
    scene.anims.create({
      key: 'dad-attack',
      frames: ['dad-attack-0', 'dad-attack-1'].map((frame) => ({
        key: DAD_TEXTURE_KEY,
        frame,
      })),
      frameRate: 10,
    });
  }
}
