import Phaser from 'phaser';
import type { TeamId } from '../content/teams';
import { DAD_SPRITE_SCALE, DAD_TEXTURE_KEY } from './dadAnimations';

const LEADS = ['jen_omar', 'joe_cia', 'kris_lea', 'jason_hilary'] as const;
const LOOKS = {
  jen_omar: { skin: 0xe0a071, hair: 0x9b4f27, shirt: 0xf4eee1, coat: 0x69725a, pants: 0x79644a, gear: 0x49dce8 },
  joe_cia: { skin: 0xd99a70, hair: 0x9a672f, shirt: 0xdcecf0, coat: 0x765c3f, pants: 0xb69869, gear: 0x65cfff },
  kris_lea: { skin: 0xc9875e, hair: 0x33251f, shirt: 0xa78e65, coat: 0x374139, pants: 0x5c6243, gear: 0xc57935 },
  jason_hilary: { skin: 0xb97650, hair: 0x171718, shirt: 0x8d3028, coat: 0xe47924, pants: 0x8b6c4c, gear: 0x38a7ef },
} as const;

export function registerFamilyAnimations(scene: Phaser.Scene): void {
  LEADS.forEach((teamId) => {
    const frames = Array.from({ length: 8 }, (_, index) => `${teamId}-frame-${index}`);
    frames.forEach((key, index) => drawFrame(scene, teamId, key, index));
    createAnimation(scene, `${teamId}-idle`, frames.slice(0, 2), 2, -1);
    createAnimation(scene, `${teamId}-walk`, frames.slice(2, 5), 7, -1);
    createAnimation(scene, `${teamId}-attack`, frames.slice(6, 8), 10, 0);
  });
}

function createAnimation(scene: Phaser.Scene, key: string, textures: string[], frameRate: number, repeat: number): void {
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames: textures.map((texture) => ({ key: texture })), frameRate, repeat });
}

function drawFrame(scene: Phaser.Scene, teamId: (typeof LEADS)[number], key: string, index: number): void {
  if (scene.textures.exists(key)) return;
  const look = LOOKS[teamId];
  const walking = index >= 2 && index <= 4;
  const attacking = index >= 6;
  const jump = index === 5;
  const stride = walking ? (index === 3 ? -3 : index === 4 ? 3 : 0) : 0;
  const lift = jump ? -4 : 0;
  const outline = 0x17191c;
  const g = scene.add.graphics();
  g.lineStyle(7, outline).lineBetween(14, 39 + lift, 12 - stride, 53 + lift).lineBetween(22, 39 + lift, 24 + stride, 53 + lift);
  g.lineStyle(4, look.pants).lineBetween(14, 39 + lift, 12 - stride, 52 + lift).lineBetween(22, 39 + lift, 24 + stride, 52 + lift);
  g.fillStyle(0x3a2922).fillRoundedRect(7 - stride, 51 + lift, 10, 5, 2).fillRoundedRect(20 + stride, 51 + lift, 10, 5, 2);
  g.fillStyle(outline).fillRoundedRect(8, 20 + lift, 20, 23, 5);
  g.fillStyle(look.shirt).fillRoundedRect(11, 21 + lift, 14, 20, 3);
  g.fillStyle(look.coat).fillRect(9, 23 + lift, 5, 17).fillRect(23, 23 + lift, 4, 17);
  if (teamId === 'jason_hilary') g.lineStyle(1, 0x281615).lineBetween(11, 27 + lift, 24, 27 + lift).lineBetween(11, 33 + lift, 24, 33 + lift).lineBetween(16, 22 + lift, 16, 40 + lift).lineBetween(21, 22 + lift, 21, 40 + lift);
  if (teamId === 'kris_lea') g.lineStyle(2, 0x252b29).strokeRect(12, 23 + lift, 12, 13);
  g.lineStyle(6, outline).lineBetween(10, 24 + lift, attacking ? 29 : 6, attacking ? 29 + lift : 36 + lift);
  g.lineStyle(3, look.skin).lineBetween(10, 24 + lift, attacking ? 29 : 6, attacking ? 29 + lift : 36 + lift);
  if (attacking) {
    g.lineStyle(teamId === 'kris_lea' ? 2 : 4, look.gear).lineBetween(28, 28 + lift, 37, index === 6 ? 18 + lift : 36 + lift);
    if (teamId === 'jen_omar') g.lineStyle(2, 0xc8ffff).strokeCircle(37, index === 6 ? 18 + lift : 36 + lift, 4);
    if (teamId === 'joe_cia') g.fillStyle(0xd9f7ff).fillCircle(37, index === 6 ? 18 + lift : 36 + lift, 2);
    if (teamId === 'jason_hilary') g.fillStyle(0x4ec5ff, 0.55).fillRect(31, 20 + lift, 7, 13);
  }
  g.fillStyle(outline).fillCircle(18, 13 + lift, 10);
  g.fillStyle(look.skin).fillCircle(18, 14 + lift, 8);
  if (teamId === 'jen_omar') g.fillStyle(look.hair).fillCircle(18, 8 + lift, 8).fillCircle(28, 7 + lift, 6);
  else g.fillStyle(look.hair).fillRoundedRect(11, 5 + lift, 15, 7, 3);
  if (teamId === 'joe_cia') g.lineStyle(1, 0x18222d).strokeRect(12, 12 + lift, 5, 4).strokeRect(20, 12 + lift, 5, 4).lineBetween(17, 14 + lift, 20, 14 + lift);
  else g.fillStyle(0x16212b).fillCircle(15, 14 + lift, 1).fillCircle(22, 14 + lift, 1);
  if (teamId === 'kris_lea') g.fillStyle(look.hair).fillRect(12, 17 + lift, 13, 5);
  if (teamId === 'jason_hilary') g.fillStyle(look.hair).fillRoundedRect(10, 16 + lift, 17, 9, 3);
  if (teamId === 'jen_omar') g.fillStyle(0x59616c).fillRoundedRect(3, 29 + lift, 9, 12, 2);
  if (teamId === 'joe_cia') g.fillStyle(0x263c5a).fillRect(4, 27 + lift, 7, 13);
  if (teamId === 'kris_lea') g.lineStyle(2, look.gear).strokeCircle(7, 35 + lift, 7);
  if (teamId === 'jason_hilary') g.fillStyle(look.gear).fillRect(4, 27 + lift, 8, 12);
  g.generateTexture(key, 40, 58).destroy();
}

export function playerVisual(teamId: TeamId) {
  if (teamId === 'dad_paula') return { texture: DAD_TEXTURE_KEY, frame: 'dad-idle-0', scale: DAD_SPRITE_SCALE, idle: 'dad-idle', walk: 'dad-walk', attack: 'dad-attack', jumpTexture: DAD_TEXTURE_KEY, jumpFrame: 'dad-jump' };
  return { texture: `${teamId}-frame-0`, frame: undefined, scale: 1.25, idle: `${teamId}-idle`, walk: `${teamId}-walk`, attack: `${teamId}-attack`, jumpTexture: `${teamId}-frame-5`, jumpFrame: undefined };
}

export function configurePlayerBody(sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, teamId: TeamId): void {
  if (teamId === 'dad_paula') sprite.body.setSize(210, 500).setOffset(30, 150);
  else sprite.body.setSize(18, 42).setOffset(11, 10);
}
