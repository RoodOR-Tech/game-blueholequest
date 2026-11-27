import Phaser from 'phaser';
import type { ArtifactId } from '../game/progression/bossLocations';
import {
  ART_RESOLUTION,
  type Ctx,
  css,
  ellipse,
  fillStroke,
  line,
  linear,
  paintTexture,
  path,
  radial,
} from './painter';

/** Every trophy is painted in a 24 × 28 box standing on a base at the bottom. */
const BOX_W = 24;
const BOX_H = 28;

function plinth(ctx: Ctx, trim: number): void {
  ctx.beginPath();
  ctx.roundRect(3, 25, 18, 3, 1);
  fillStroke(
    ctx,
    linear(ctx, 0, 25, 0, 28, [
      [0, 0x6a4028],
      [1, 0x2e1a10],
    ]),
    0x1a0e08,
    0.5,
  );
  line(ctx, [3.6, 25.5, 20.4, 25.5], trim, 0.6, 0.9);
}

function sparkle(ctx: Ctx, x: number, y: number, size: number): void {
  ctx.fillStyle = css(0xffffff, 0.95);
  path(ctx, [x, y - size, x + size * 0.25, y, x, y + size, x - size * 0.25, y]);
  ctx.fill();
  path(ctx, [x - size, y, x, y - size * 0.25, x + size, y, x, y + size * 0.25]);
  ctx.fill();
}

function goldenThumb(ctx: Ctx): void {
  plinth(ctx, 0xf6d77a);
  const gold = (x0: number, y0: number, x1: number, y1: number) =>
    linear(ctx, x0, y0, x1, y1, [
      [0, 0xfff3b8],
      [0.35, 0xf2c94c],
      [0.75, 0xc8901e],
      [1, 0x7a4c0e],
    ]);
  const outline = 0x5a3608;
  // Back of the hand.
  ctx.beginPath();
  ctx.roundRect(4.5, 11, 9, 14.5, 3);
  fillStroke(ctx, gold(4, 11, 14, 26), outline, 0.8);
  // Four curled fingers stacked on the knuckle side.
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.roundRect(9, 11.4 + i * 3.4, 10.5, 3.6, 1.8);
    fillStroke(ctx, gold(9, 11 + i * 3.4, 20, 15 + i * 3.4), outline, 0.7);
  }
  // Knuckle highlights.
  for (let i = 0; i < 4; i += 1)
    line(ctx, [16, 12.3 + i * 3.4, 18.4, 12.6 + i * 3.4], 0xfff3b8, 0.5, 0.8);
  // The thumb, raised.
  ctx.beginPath();
  ctx.moveTo(5, 13);
  ctx.lineTo(5.4, 4);
  ctx.quadraticCurveTo(5.6, 0.8, 8.4, 0.8);
  ctx.quadraticCurveTo(11.4, 0.8, 11.4, 4);
  ctx.lineTo(11.6, 12);
  ctx.closePath();
  fillStroke(ctx, gold(5, 1, 12, 13), outline, 0.8);
  ellipse(ctx, 8.5, 3.4, 2, 1.7);
  fillStroke(ctx, css(0xfff8d8, 0.9), 0xc8901e, 0.35);
  line(ctx, [6, 8.2, 8.4, 8.6], 0x7a4c0e, 0.4, 0.8);
  // Cuff.
  ctx.beginPath();
  ctx.roundRect(4, 22.6, 10, 2.6, 0.8);
  fillStroke(ctx, css(0xc8901e), outline, 0.5);
  sparkle(ctx, 7, 2.4, 1.6);
}

function crystalHound(ctx: Ctx): void {
  plinth(ctx, 0x9ff3ff);
  const crystal = (x0: number, y0: number, x1: number, y1: number) =>
    linear(ctx, x0, y0, x1, y1, [
      [0, 0xf0feff],
      [0.4, 0x8ae6ff],
      [1, 0x2a7fb0],
    ]);
  const edge = 0x1d5a80;
  // Tail curling up behind.
  path(ctx, [5, 22, 2.4, 17.5, 2.8, 14.5, 4.4, 17.6, 6.6, 20.6]);
  fillStroke(ctx, crystal(2, 14, 7, 22), edge, 0.5);
  // Haunch and body, sitting.
  path(ctx, [4.5, 25, 4.6, 19, 8, 15, 12, 11, 15.4, 12.4, 16, 25]);
  fillStroke(ctx, crystal(4, 11, 16, 25), edge, 0.6);
  ellipse(ctx, 8.6, 20.6, 4.6, 4.2);
  fillStroke(ctx, crystal(4, 16, 13, 25), edge, 0.5);
  // Front leg.
  path(ctx, [13, 15, 16, 14, 16.6, 25, 13.4, 25]);
  fillStroke(ctx, crystal(13, 14, 17, 25), edge, 0.5);
  // Head with a long snout, and a pointed ear.
  path(
    ctx,
    [
      11.4, 11, 11.2, 5.6, 13.4, 3, 16.4, 4, 21.4, 6.6, 21.2, 9, 16.4, 10, 14.4,
      12,
    ],
  );
  fillStroke(ctx, crystal(11, 3, 22, 12), edge, 0.6);
  path(ctx, [12, 5, 12.6, 0.6, 15, 4.2]);
  fillStroke(ctx, crystal(12, 0, 15, 5), edge, 0.5);
  ellipse(ctx, 21.2, 7.6, 0.9, 0.8);
  ctx.fillStyle = css(0x1d3a60);
  ctx.fill();
  ellipse(ctx, 16.6, 6, 0.8, 0.7);
  ctx.fillStyle = css(0x0e2a48);
  ctx.fill();
  // Facet lines catch the light.
  [
    [13.4, 3, 14.4, 12],
    [16.4, 4, 16.4, 10],
    [12, 11, 8, 15],
    [8, 15, 12, 25],
    [12, 11, 13, 15],
    [4.6, 19, 10, 22],
  ].forEach((facet) => line(ctx, facet, 0xffffff, 0.35, 0.6));
  sparkle(ctx, 18.4, 5.4, 1.6);
}

function amberStein(ctx: Ctx): void {
  plinth(ctx, 0xffc66a);
  // Handle behind the glass.
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.bezierCurveTo(22.4, 11.6, 22.4, 22.4, 16, 22);
  ctx.strokeStyle = css(0x4a2408);
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.strokeStyle = css(0xc87a2a);
  ctx.lineWidth = 2;
  ctx.stroke();
  // Amber glass body.
  ctx.beginPath();
  ctx.roundRect(4.5, 8.5, 12, 16.6, 1.6);
  fillStroke(
    ctx,
    linear(ctx, 4.5, 0, 16.5, 0, [
      [0, 0x7a3c0c],
      [0.3, 0xf0a040],
      [0.5, 0xffd27a],
      [1, 0x9a4e12],
    ]),
    0x3a1a06,
    0.7,
  );
  [7.5, 10.5, 13.5].forEach((x) =>
    line(ctx, [x, 10.5, x, 23.5], 0x6a3008, 0.4, 0.6),
  );
  line(ctx, [6.2, 11, 6.2, 22.6], 0xfff0c8, 0.6, 0.75);
  [
    [9, 20, 0.5],
    [12, 17, 0.4],
    [10.4, 14, 0.35],
    [13.6, 21.4, 0.45],
  ].forEach(([x, y, r]) => {
    ellipse(ctx, x ?? 0, y ?? 0, r ?? 0.4, r ?? 0.4);
    ctx.fillStyle = css(0xfff4d0, 0.85);
    ctx.fill();
  });
  // Pewter bands.
  [8.4, 23.4].forEach((y) => {
    ctx.beginPath();
    ctx.roundRect(4, y, 13, 1.8, 0.6);
    fillStroke(
      ctx,
      linear(ctx, 0, y, 0, y + 1.8, [
        [0, 0xe8eef2],
        [1, 0x7a848c],
      ]),
      0x3a3f44,
      0.35,
    );
  });
  // Foam spilling over the rim.
  [
    [6, 7.4, 2.6],
    [9.4, 6.2, 3],
    [13, 6.8, 2.8],
    [15.6, 8, 2],
    [7.8, 4.6, 2.2],
    [11.6, 4.4, 2.3],
  ].forEach(([x, y, r]) => {
    ellipse(ctx, x ?? 0, y ?? 0, r ?? 2, (r ?? 2) * 0.9);
    ctx.fillStyle = radial(ctx, (x ?? 0) - 0.6, (y ?? 0) - 0.6, 0.2, r ?? 2, [
      [0, 0xffffff],
      [1, 0xe8dcc0],
    ]);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.moveTo(15.4, 9);
  ctx.quadraticCurveTo(16.6, 11.4, 15.8, 13.2);
  ctx.quadraticCurveTo(15, 11.2, 14.4, 9.4);
  ctx.fillStyle = css(0xf6eedc);
  ctx.fill();
  sparkle(ctx, 8.2, 13, 1.4);
}

function emeraldLeaf(ctx: Ctx): void {
  plinth(ctx, 0x7de06f);
  line(ctx, [12, 25.4, 12, 20.6], 0x2a5a1a, 1.4);
  const cx = 12;
  const cy = 12;
  ctx.beginPath();
  for (let step = 0; step <= 160; step += 1) {
    const theta = (step / 160) * Math.PI * 2;
    // Five pointed, serrated lobes, with a notch where the stem joins.
    const phase = ((theta * 5) / (Math.PI * 2)) % 1;
    const lobe = Math.pow(Math.abs(1 - 2 * phase), 0.9);
    const teeth = Math.abs(Math.sin(theta * 30)) * 0.06;
    const radius = 10.6 * (0.7 + 0.3 * lobe - teeth);
    const x = cx + Math.sin(theta) * radius;
    const y = cy - Math.cos(theta) * radius * 0.96;
    if (step === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  fillStroke(
    ctx,
    radial(ctx, cx - 3, cy - 4, 0.5, 13, [
      [0, 0xc8ffd8],
      [0.35, 0x3fd27a],
      [0.8, 0x14864a],
      [1, 0x0a5a30],
    ]),
    0x063a1e,
    0.8,
  );
  // Gold veins out to each lobe, like a set gem.
  for (let k = 0; k < 5; k += 1) {
    const theta = (k / 5) * Math.PI * 2;
    const tipX = cx + Math.sin(theta) * 9;
    const tipY = cy - Math.cos(theta) * 8.6;
    line(ctx, [cx, cy + 2, tipX, tipY], 0xf6d77a, 0.55, 0.9);
    const midX = (cx + tipX) / 2;
    const midY = (cy + 2 + tipY) / 2;
    line(
      ctx,
      [
        midX,
        midY,
        midX + Math.sin(theta + 0.9) * 2.4,
        midY - Math.cos(theta + 0.9) * 2.4,
      ],
      0xf6d77a,
      0.35,
      0.7,
    );
  }
  ellipse(ctx, cx, cy + 2, 1.1, 1.1);
  ctx.fillStyle = css(0xf6d77a);
  ctx.fill();
  ellipse(ctx, cx - 3.6, cy - 4.6, 2.6, 1.3, -0.6);
  ctx.fillStyle = css(0xffffff, 0.45);
  ctx.fill();
  sparkle(ctx, 16, 5.6, 1.6);
}

function marbleMountain(ctx: Ctx): void {
  // Carved marble plinth instead of a wooden base.
  path(ctx, [3, 28, 4, 23.6, 20, 23.6, 21, 28]);
  fillStroke(
    ctx,
    linear(ctx, 0, 23.6, 0, 28, [
      [0, 0xf4f2ec],
      [1, 0xa8a49c],
    ]),
    0x5a5650,
    0.5,
  );
  line(ctx, [4.4, 25, 19.6, 25], 0x8a867e, 0.4);
  const peaks = [3.4, 23.6, 8.6, 9.6, 11, 12.4, 15, 2.4, 20.6, 23.6];
  path(ctx, peaks);
  fillStroke(
    ctx,
    linear(ctx, 6, 3, 18, 24, [
      [0, 0xffffff],
      [0.5, 0xe6e2da],
      [1, 0xb4b0a6],
    ]),
    0x5a5650,
    0.7,
  );
  ctx.save();
  path(ctx, peaks);
  ctx.clip();
  // Shadowed faces and grey veining.
  path(ctx, [15, 2.4, 20.6, 23.6, 14, 23.6, 16, 14]);
  ctx.fillStyle = css(0x6a6660, 0.28);
  ctx.fill();
  path(ctx, [8.6, 9.6, 11, 12.4, 9.6, 23.6, 6, 23.6]);
  ctx.fillStyle = css(0x6a6660, 0.18);
  ctx.fill();
  [
    [4, 20, 8, 17, 10, 19, 14, 15],
    [9, 23, 12, 19, 16, 20, 19, 17],
    [12, 9, 13.6, 12, 12.4, 15],
  ].forEach((vein) => line(ctx, vein, 0x8a867e, 0.35, 0.8));
  // Polished ridgelines.
  line(ctx, [15, 2.4, 14, 8, 15.6, 13], 0xffffff, 0.6, 0.9);
  line(ctx, [8.6, 9.6, 8, 14], 0xffffff, 0.5, 0.8);
  ctx.restore();
  sparkle(ctx, 15, 3.6, 1.6);
}

const PAINTERS: Readonly<Record<ArtifactId, (ctx: Ctx) => void>> = {
  relic_golden_thumb: goldenThumb,
  relic_crystal_hound: crystalHound,
  relic_amber_stein: amberStein,
  relic_emerald_leaf: emeraldLeaf,
  relic_marble_mountain: marbleMountain,
};

export function trophyTextureKey(artifactId: ArtifactId): string {
  return `trophy-${artifactId}`;
}

/** Paints the trophy texture once per game. */
export function ensureTrophy(
  scene: Phaser.Scene,
  artifactId: ArtifactId,
): string {
  const key = trophyTextureKey(artifactId);
  if (!scene.textures.exists(key))
    paintTexture(scene, key, BOX_W, BOX_H, PAINTERS[artifactId]);
  return key;
}

/** Image scale that shows a trophy at the given height in world pixels. */
export function trophyScale(height: number): number {
  return height / BOX_H / ART_RESOLUTION;
}

/** Adds a trophy standing with its base at (x, y). */
export function addTrophy(
  scene: Phaser.Scene,
  x: number,
  y: number,
  artifactId: ArtifactId,
  height: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, ensureTrophy(scene, artifactId))
    .setOrigin(0.5, 1)
    .setScale(trophyScale(height));
}
