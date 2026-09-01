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
  const stride = walking ? (index === 3 ? -4 : index === 4 ? 4 : 0) : 0;
  const lift = jump ? -5 : index === 1 ? 1 : 0;
  const outline = 0x17191c;
  const g = scene.add.graphics();
  const center = 25;
  const torsoWidth = teamId === 'joe_cia' ? 20 : teamId === 'jason_hilary' ? 30 : 25;
  const left = center - torsoWidth / 2;
  // Legs have different stance and weight for each hero.
  g.lineStyle(teamId === 'jason_hilary' ? 10 : 8, outline)
    .lineBetween(20, 45 + lift, 17 - stride, 61 + lift)
    .lineBetween(30, 45 + lift, 33 + stride, 61 + lift);
  g.lineStyle(teamId === 'jason_hilary' ? 6 : 5, look.pants)
    .lineBetween(20, 44 + lift, 17 - stride, 60 + lift)
    .lineBetween(30, 44 + lift, 33 + stride, 60 + lift);
  g.fillStyle(0x34251f)
    .fillRoundedRect(11 - stride, 59 + lift, 13, 6, 2)
    .fillRoundedRect(27 + stride, 59 + lift, 13, 6, 2);
  if (teamId === 'jen_omar')
    g.fillStyle(0xd8f2e9).fillRect(13 - stride, 59 + lift, 9, 2).fillRect(29 + stride, 59 + lift, 9, 2);

  // Backpacks and bags sit behind the body and change the silhouette.
  if (teamId === 'jen_omar')
    g.fillStyle(outline).fillRoundedRect(2, 31 + lift, 15, 17, 3).fillStyle(0x59616c).fillRoundedRect(4, 33 + lift, 11, 13, 2);
  if (teamId === 'kris_lea')
    g.fillStyle(outline).fillRoundedRect(7, 25 + lift, 13, 24, 5).fillStyle(0x465044).fillRoundedRect(9, 27 + lift, 9, 20, 3);
  if (teamId === 'joe_cia')
    g.fillStyle(outline).fillRoundedRect(7, 31 + lift, 10, 17, 2).fillStyle(0x294465).fillRect(9, 33 + lift, 6, 13);
  if (teamId === 'jason_hilary')
    g.fillStyle(0x1789d0).fillRect(5, 30 + lift, 12, 17).lineStyle(1, 0xbceaff).strokeRect(5, 30 + lift, 12, 17).lineBetween(7, 34 + lift, 14, 34 + lift).lineBetween(7, 38 + lift, 13, 42 + lift);

  // Layered clothing.
  g.fillStyle(outline).fillRoundedRect(left - 2, 23 + lift, torsoWidth + 4, 25, teamId === 'jason_hilary' ? 7 : 5);
  g.fillStyle(look.shirt).fillRoundedRect(left, 24 + lift, torsoWidth, 22, 4);
  g.fillStyle(look.coat).fillRect(left, 25 + lift, 6, 20).fillRect(left + torsoWidth - 6, 25 + lift, 6, 20);
  if (teamId === 'jen_omar') {
    g.fillStyle(0x343a33).fillRect(22, 25 + lift, 6, 20);
    g.fillStyle(0x8f7fd4).fillRect(7, 36 + lift, 3, 4).fillStyle(0x45cdbb).fillRect(12, 36 + lift, 3, 5);
  }
  if (teamId === 'joe_cia') {
    g.fillStyle(0xffffff).fillRect(23, 25 + lift, 3, 17);
    g.fillStyle(0x26323b).fillRect(23, 29 + lift, 1, 1).fillRect(23, 34 + lift, 1, 1);
  }
  if (teamId === 'kris_lea') {
    g.lineStyle(3, 0x252b29).lineBetween(17, 24 + lift, 30, 45 + lift).lineBetween(33, 24 + lift, 20, 45 + lift);
    g.fillStyle(0x73a2b9).fillRect(13, 41 + lift, 4, 5);
  }
  if (teamId === 'jason_hilary') {
    g.lineStyle(1, 0x281615).lineBetween(left + 2, 29 + lift, left + torsoWidth - 2, 29 + lift).lineBetween(left + 2, 36 + lift, left + torsoWidth - 2, 36 + lift);
    for (let x = left + 4; x < left + torsoWidth; x += 7) g.lineBetween(x, 25 + lift, x, 45 + lift);
    g.fillStyle(0xc9d2d2).fillRect(left + 2, 26 + lift, 2, 17).fillRect(left + torsoWidth - 4, 26 + lift, 2, 17);
  }

  // Arm motion and signature attack tools.
  const handX = attacking ? 39 : left - 5;
  const handY = attacking ? (index === 6 ? 27 : 38) + lift : 40 + lift;
  g.lineStyle(8, outline).lineBetween(left + 2, 28 + lift, handX, handY);
  g.lineStyle(4, look.skin).lineBetween(left + 2, 28 + lift, handX, handY);
  if (attacking) {
    if (teamId === 'jen_omar') {
      g.lineStyle(5, 0x43d9eb).lineBetween(38, handY, 49, handY - 9).lineStyle(3, 0xd9ffff).strokeCircle(49, handY - 9, 5);
    } else if (teamId === 'joe_cia') {
      g.lineStyle(3, 0x6b4324).lineBetween(38, handY, 50, handY - 10).fillStyle(0xc7f5ff).fillCircle(50, handY - 10, 3);
    } else if (teamId === 'kris_lea') {
      g.lineStyle(3, 0xc98237).beginPath().moveTo(38, handY).lineTo(50, handY - 9).lineTo(47, handY + 5).strokePath();
      g.fillStyle(0x87bdd4).fillCircle(50, handY - 9, 3);
    } else {
      g.fillStyle(0x42b9f2, 0.65).fillRoundedRect(39, handY - 13, 13, 16, 2).lineStyle(2, 0xc5f4ff).strokeRoundedRect(39, handY - 13, 13, 16, 2);
    }
  }

  // Larger, distinct heads with readable expressions and facial hair.
  const headRadius = teamId === 'jason_hilary' ? 11 : teamId === 'joe_cia' ? 9 : 10;
  g.fillStyle(outline).fillCircle(center, 14 + lift, headRadius + 2);
  g.fillStyle(look.skin).fillCircle(center, 15 + lift, headRadius);
  if (teamId === 'jen_omar') {
    g.fillStyle(look.hair).fillCircle(24, 8 + lift, 9).fillCircle(38, 7 + lift, 7).fillRect(31, 7 + lift, 8, 5);
    g.fillStyle(0x173044).fillCircle(21, 15 + lift, 1).fillCircle(28, 15 + lift, 1);
    g.fillStyle(0xffffff).fillRect(23, 19 + lift, 5, 1);
  } else {
    g.fillStyle(look.hair).fillRoundedRect(center - headRadius, 5 + lift, headRadius * 2, 8, 4);
    if (teamId === 'joe_cia') {
      g.lineStyle(2, 0x18222d).strokeRect(17, 13 + lift, 7, 5).strokeRect(27, 13 + lift, 7, 5).lineBetween(24, 15 + lift, 27, 15 + lift);
    } else g.fillStyle(0x16212b).fillCircle(21, 15 + lift, 1).fillCircle(29, 15 + lift, 1);
    if (teamId === 'kris_lea') g.fillStyle(look.hair).fillRoundedRect(17, 19 + lift, 17, 7, 3);
    if (teamId === 'jason_hilary') g.fillStyle(look.hair).fillRoundedRect(13, 18 + lift, 24, 13, 5).fillTriangle(16, 23 + lift, 25, 34 + lift, 34, 23 + lift);
  }
  g.generateTexture(key, 54, 68).destroy();
}

export function playerVisual(teamId: TeamId) {
  if (teamId === 'dad_paula') return { texture: DAD_TEXTURE_KEY, frame: 'dad-idle-0', scale: DAD_SPRITE_SCALE, idle: 'dad-idle', walk: 'dad-walk', attack: 'dad-attack', jumpTexture: DAD_TEXTURE_KEY, jumpFrame: 'dad-jump' };
  return { texture: `${teamId}-frame-0`, frame: undefined, scale: 1.2, idle: `${teamId}-idle`, walk: `${teamId}-walk`, attack: `${teamId}-attack`, jumpTexture: `${teamId}-frame-5`, jumpFrame: undefined };
}

export function configurePlayerBody(sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, teamId: TeamId): void {
  if (teamId === 'dad_paula') sprite.body.setSize(210, 500).setOffset(30, 150);
  else sprite.body.setSize(teamId === 'jason_hilary' ? 24 : 20, 48).setOffset(teamId === 'jason_hilary' ? 13 : 15, 14);
}
