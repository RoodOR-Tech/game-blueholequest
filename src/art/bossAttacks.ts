import Phaser from 'phaser';
import {
  ART_RESOLUTION,
  css,
  ellipse,
  glow,
  line,
  linear,
  paintTexture,
  path,
  radial,
} from './painter';

/**
 * Painted boss attacks. Each keeps the world size of the flat shape it
 * replaced, so hitboxes are unchanged once shown at 1 / ART_RESOLUTION.
 */
export function paintAttackTextures(scene: Phaser.Scene, color: number): void {
  paintTexture(scene, 'boss-projectile', 12, 12, (ctx) => {
    ctx.fillStyle = radial(ctx, 6, 6, 0, 6, [
      [0, 0xffffff],
      [0.35, color],
      [0.8, color, 0.6],
      [1, color, 0],
    ]);
    ctx.fillRect(0, 0, 12, 12);
    ellipse(ctx, 6, 6, 4.2, 4.2);
    ctx.strokeStyle = css(0xffffff, 0.75);
    ctx.lineWidth = 0.6;
    ctx.setLineDash([1.6, 1.2]);
    ctx.stroke();
  });
  paintTexture(scene, 'boss-wave', 38, 15, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(38, 15);
    ctx.lineTo(0, 15);
    ctx.bezierCurveTo(2, 8, 6, 2, 13, 1.5);
    ctx.bezierCurveTo(18, 1, 20, 5, 16, 7);
    ctx.bezierCurveTo(24, 4, 30, 6, 38, 11);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 1, 0, 15, [
      [0, 0x9ff3ff],
      [0.4, 0x2fa7c4],
      [1, 0x0b4a5c, 0.9],
    ]);
    ctx.fill();
    line(ctx, [1, 12, 4, 6, 9, 2.4, 14, 2, 17, 4.6], 0xffffff, 1.1, 0.95);
    line(ctx, [16, 7.4, 24, 5.4, 32, 7.6, 37, 10.6], 0xe6fbff, 0.7, 0.8);
    [
      [6, 10],
      [12, 11],
      [22, 10],
      [29, 12],
    ].forEach(([x, y]) => {
      ellipse(ctx, x ?? 0, y ?? 0, 1, 0.6);
      ctx.fillStyle = css(0xe6fbff, 0.7);
      ctx.fill();
    });
  });
  paintTexture(scene, 'boss-meteor', 16, 18, (ctx) => {
    glow(ctx, 0xff5b35, 4, () => {
      path(ctx, [8, 2, 13, 5, 15, 10, 12, 16, 6, 17, 2, 13, 1, 7, 4, 3]);
      ctx.fillStyle = radial(ctx, 6, 8, 1, 10, [
        [0, 0x5a4048],
        [1, 0x1a1012],
      ]);
      ctx.fill();
    });
    [
      [4, 6, 8, 9, 7, 14],
      [12, 6, 9, 10, 12, 13],
    ].forEach((points) => {
      glow(ctx, 0xff4a1c, 2, () => line(ctx, points, 0xff8a3d, 1));
      line(ctx, points, 0xffe08a, 0.35);
    });
  });
  paintTexture(scene, 'boss-root', 12, 48, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(1, 48);
    ctx.bezierCurveTo(3, 30, 9, 20, 6, 0);
    ctx.bezierCurveTo(11, 18, 9, 32, 11, 48);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 12, 0, [
      [0, 0x2d1f18],
      [0.4, 0x6b4a36],
      [1, 0x231711],
    ]);
    ctx.fill();
    ctx.strokeStyle = css(0x120b08);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    [
      [4, 34, 0.5, 31],
      [8.6, 26, 11.6, 23],
      [5.6, 18, 2.6, 15],
      [7.4, 10, 10, 7.4],
    ].forEach(([x, y, tx, ty]) => {
      path(ctx, [
        x ?? 0,
        (y ?? 0) - 1.2,
        tx ?? 0,
        ty ?? 0,
        x ?? 0,
        (y ?? 0) + 1.2,
      ]);
      ctx.fillStyle = css(0x3a2a1c);
      ctx.fill();
    });
    [
      [3, 40, -0.6],
      [9.4, 30, 0.6],
    ].forEach(([x, y, a]) => {
      ellipse(ctx, x ?? 0, y ?? 0, 2.4, 1.2, a ?? 0);
      ctx.fillStyle = css(0x6e9b45);
      ctx.fill();
    });
  });
}

/** A jagged bolt with a soft glow, drawn from top to bottom at x. */
export function strikeBolt(
  scene: Phaser.Scene,
  x: number,
  top: number,
  bottom: number,
): void {
  const bolt = scene.add
    .graphics()
    .setDepth(15)
    .setBlendMode(Phaser.BlendModes.ADD);
  const points = [new Phaser.Math.Vector2(x, top)];
  for (let y = top + 10; y < bottom; y += 10)
    points.push(new Phaser.Math.Vector2(x + Phaser.Math.Between(-5, 5), y));
  points.push(new Phaser.Math.Vector2(x, bottom));
  bolt
    .lineStyle(9, 0x6ee6ff, 0.25)
    .strokePoints(points)
    .lineStyle(4, 0x9ff3ff, 0.6)
    .strokePoints(points)
    .lineStyle(1.5, 0xffffff, 1)
    .strokePoints(points);
  bolt.fillStyle(0xd8fbff, 0.6).fillEllipse(x, bottom, 26, 6);
  scene.tweens.add({
    targets: bolt,
    alpha: 0,
    duration: 220,
    delay: 60,
    onComplete: () => bolt.destroy(),
  });
}

export const ATTACK_SCALE = 1 / ART_RESOLUTION;
