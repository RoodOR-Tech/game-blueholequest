import Phaser from 'phaser';
import type { TeamId } from '../content/teams';
import { playerVisual } from './familyAnimations';

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

const PORTRAIT_SOURCE_SIZE = 190;
const PORTRAIT_SIZE = 20;
const headCache = new Map<TeamId, { x: number; y: number } | null>();

/** Finds the centre of a character's head in the first frame of their sheet. */
function locateHead(
  scene: Phaser.Scene,
  teamId: TeamId,
  texture: string,
  frameName: string,
): { x: number; y: number } | null {
  const cached = headCache.get(teamId);
  if (cached !== undefined) return cached;
  let head: { x: number; y: number } | null = null;
  const frame = scene.textures.get(texture).get(frameName);
  const source = frame.source.image;
  if (source instanceof HTMLCanvasElement) {
    const width = frame.cutWidth;
    const height = frame.cutHeight;
    const pixels = source
      .getContext('2d')
      ?.getImageData(frame.cutX, frame.cutY, width, height).data;
    if (pixels) {
      const opaque = (x: number, y: number): boolean =>
        (pixels[(y * width + x) * 4 + 3] ?? 0) > 0;
      let top = -1;
      for (let y = 0; y < height && top < 0; y += 1)
        for (let x = 0; x < width; x += 1)
          if (opaque(x, y)) {
            top = y;
            break;
          }
      if (top >= 0) {
        let left = width;
        let right = 0;
        const bottom = Math.min(height, top + 150);
        for (let y = top; y < bottom; y += 1)
          for (let x = 0; x < width; x += 1)
            if (opaque(x, y)) {
              left = Math.min(left, x);
              right = Math.max(right, x);
            }
        head = {
          x: (left + right) / 2,
          y: top + PORTRAIT_SOURCE_SIZE / 2 - 12,
        };
      }
    }
  }
  headCache.set(teamId, head);
  return head;
}

/** A team badge showing the lead character's face, with a drawn fallback. */
export function drawTeamPortrait(
  scene: Phaser.Scene,
  teamId: TeamId,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const look = TEAM_APPEARANCES[teamId];
  const visual = playerVisual(teamId);
  const head = locateHead(scene, teamId, visual.texture, visual.frame);
  if (!head) return drawFallbackPortrait(scene, teamId, x, y);
  const frame = scene.textures.get(visual.texture).get(visual.frame);
  const half = PORTRAIT_SOURCE_SIZE / 2;
  const backing = scene.add.graphics();
  backing.fillStyle(0x091520).fillCircle(0, 0, 11);
  backing.fillStyle(look.accent).fillCircle(0, 0, 10);
  backing.fillStyle(look.primary, 0.55).fillCircle(0, 0, 8);
  const face = scene.add
    .image(0, 0, visual.texture, visual.frame)
    .setCrop(
      head.x - half,
      head.y - half,
      PORTRAIT_SOURCE_SIZE,
      PORTRAIT_SOURCE_SIZE,
    )
    .setOrigin(head.x / frame.width, head.y / frame.height)
    .setScale(PORTRAIT_SIZE / PORTRAIT_SOURCE_SIZE);
  return scene.add.container(x, y, [backing, face]);
}

function drawFallbackPortrait(
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
