import Phaser from 'phaser';
import type { TeamId } from '../content/teams';

export interface TeamAppearance {
  readonly primary: number;
  readonly accent: number;
  readonly skin: number;
  readonly hair: number;
  readonly initials: string;
}

export const TEAM_APPEARANCES: Readonly<Record<TeamId, TeamAppearance>> = {
  dad_paula: {
    primary: 0x4f83d1,
    accent: 0xf2c14e,
    skin: 0xd9945e,
    hair: 0x552b19,
    initials: 'D+P',
  },
  jen_omar: {
    primary: 0x8c4fc4,
    accent: 0x62e0d1,
    skin: 0xb96f48,
    hair: 0x241b20,
    initials: 'J+O',
  },
  jason_hilary: {
    primary: 0x3f8b68,
    accent: 0xe28b45,
    skin: 0xe0a170,
    hair: 0x7a4327,
    initials: 'J+H',
  },
  joe_cia: {
    primary: 0x315c91,
    accent: 0xd4a8e5,
    skin: 0xc9875b,
    hair: 0x423128,
    initials: 'J+C',
  },
  kris_lea: {
    primary: 0xb44f52,
    accent: 0x79b85a,
    skin: 0xe3a875,
    hair: 0xd2b06f,
    initials: 'K+L',
  },
};

export function applyTeamAppearance(
  sprite: Phaser.GameObjects.Sprite,
  teamId: TeamId,
): void {
  sprite.setTint(TEAM_APPEARANCES[teamId].primary);
}

export function drawTeamPortrait(
  scene: Phaser.Scene,
  teamId: TeamId,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const look = TEAM_APPEARANCES[teamId];
  const g = scene.add.graphics();
  g.fillStyle(0x091520).fillCircle(0, 0, 10);
  g.fillStyle(look.accent).fillCircle(0, 0, 8);
  g.fillStyle(look.skin).fillCircle(-3, -1, 4).fillCircle(3, 1, 4);
  g.fillStyle(look.hair).fillRect(-7, -6, 7, 3).fillRect(1, -4, 7, 3);
  g.fillStyle(look.primary)
    .fillTriangle(-8, 8, -3, 3, 1, 8)
    .fillTriangle(-1, 8, 3, 4, 8, 8);
  const initials = scene.add
    .text(0, 10, look.initials, {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '4px',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  return scene.add.container(x, y, [g, initials]);
}
