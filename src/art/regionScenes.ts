import Phaser from 'phaser';
import type { BossLocationId } from '../game/progression/bossLocations';
import {
  addParticles,
  ART_RESOLUTION,
  addPainted,
  type Ctx,
  css,
  ellipse,
  ensureFxTextures,
  glow,
  line,
  linear,
  paintTexture,
  path,
  radial,
  seeded,
} from './painter';

const W = 256;
const H = 240;

/* ------------------------------ shared ------------------------------ */

function sky(ctx: Ctx, stops: Parameters<typeof linear>[5], bottom = H): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, bottom, stops);
  ctx.fillRect(0, 0, W, H);
}

function stars(
  ctx: Ctx,
  seed: number,
  count: number,
  maxY: number,
  alpha = 0.8,
): void {
  const random = seeded(seed);
  for (let i = 0; i < count; i += 1) {
    ellipse(
      ctx,
      random() * W,
      random() * maxY,
      0.35 + random() * 0.4,
      0.35 + random() * 0.4,
    );
    ctx.fillStyle = css(0xffffff, alpha * (0.3 + random() * 0.7));
    ctx.fill();
  }
}

/** A ridge line from left to right, filled down to the bottom. */
function ridge(
  ctx: Ctx,
  seed: number,
  baseY: number,
  amplitude: number,
  color: number | CanvasGradient,
  roughness = 0.06,
): void {
  const random = seeded(seed);
  const phase = random() * 10;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) {
    const y =
      baseY -
      Math.sin(x * roughness + phase) * amplitude * 0.6 -
      Math.sin(x * roughness * 2.7 + phase * 2) * amplitude * 0.3 -
      random() * amplitude * 0.15;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = typeof color === 'number' ? css(color) : color;
  ctx.fill();
}

function haze(
  ctx: Ctx,
  y: number,
  height: number,
  color: number,
  alpha: number,
): void {
  ctx.fillStyle = linear(ctx, 0, y - height, 0, y + height, [
    [0, color, 0],
    [0.5, color, alpha],
    [1, color, 0],
  ]);
  ctx.fillRect(0, y - height, W, height * 2);
}

function fir(
  ctx: Ctx,
  x: number,
  base: number,
  height: number,
  color: number,
  rim?: number,
): void {
  const width = height * 0.36;
  const tiers = 5;
  ctx.beginPath();
  ctx.moveTo(x, base - height);
  for (let i = 1; i <= tiers; i += 1) {
    const y = base - height + (height * 0.92 * i) / tiers;
    const w = (width * i) / tiers;
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.55, y - height * 0.04);
  }
  for (let i = tiers; i >= 1; i -= 1) {
    const y = base - height + (height * 0.92 * i) / tiers;
    const w = (width * i) / tiers;
    ctx.lineTo(x - w * 0.55, y - height * 0.04);
    ctx.lineTo(x - w, y);
  }
  ctx.closePath();
  ctx.fillStyle = css(color);
  ctx.fill();
  ctx.fillRect(
    x - height * 0.025,
    base - height * 0.1,
    height * 0.05,
    height * 0.1,
  );
  if (rim === undefined) return;
  ctx.save();
  ctx.clip();
  ctx.fillStyle = linear(ctx, x, 0, x + width, 0, [
    [0, rim, 0],
    [1, rim, 0.35],
  ]);
  ctx.fillRect(x, base - height, width, height);
  ctx.restore();
}

function lattice(
  ctx: Ctx,
  x: number,
  base: number,
  top: number,
  width: number,
  color: number,
): void {
  const half = (y: number) =>
    (width / 2) * (0.25 + (0.75 * (y - top)) / (base - top));
  const steps = 7;
  line(
    ctx,
    [
      x - half(base),
      base,
      x - half(top),
      top,
      x + half(top),
      top,
      x + half(base),
      base,
    ],
    color,
    1.2,
  );
  for (let i = 0; i < steps; i += 1) {
    const y1 = top + ((base - top) * i) / steps;
    const y2 = top + ((base - top) * (i + 1)) / steps;
    line(ctx, [x - half(y1), y1, x + half(y2), y2], color, 0.5);
    line(ctx, [x + half(y1), y1, x - half(y2), y2], color, 0.5);
    line(ctx, [x - half(y2), y2, x + half(y2), y2], color, 0.5);
  }
  const arms = [top + 3, top + 12];
  arms.forEach((y, i) => {
    const reach = width * (0.9 - i * 0.15);
    line(ctx, [x - reach, y, x + reach, y], color, 1);
    line(ctx, [x - reach, y, x - half(y + 6), y + 6], color, 0.5);
    line(ctx, [x + reach, y, x + half(y + 6), y + 6], color, 0.5);
  });
  line(
    ctx,
    [x - width * 0.3, top, x, top - 8, x + width * 0.3, top],
    color,
    0.8,
  );
}

/** Anchor points on each tower's cross-arms, used for the sagging wires. */
const EAST_TOWERS = [
  { x: 36, base: 214, top: 74, width: 34 },
  { x: 132, base: 168, top: 112, width: 14 },
  { x: 222, base: 214, top: 70, width: 36 },
] as const;

function towerAnchors(index: number): { x: number; y: number }[] {
  const tower = EAST_TOWERS[index];
  if (!tower) return [];
  const y1 = tower.top + 3;
  const y2 = tower.top + 12;
  const r1 = tower.width * 0.9;
  const r2 = tower.width * 0.75;
  return [
    { x: tower.x - r1, y: y1 },
    { x: tower.x + r1, y: y1 },
    { x: tower.x - r2, y: y2 },
    { x: tower.x + r2, y: y2 },
  ];
}

/** Sampled catenary-like wires between towers, shared by art and sparks. */
export function eastWires(): { x: number; y: number }[][] {
  const wires: { x: number; y: number }[][] = [];
  for (let k = 0; k < 4; k += 1) {
    const points: { x: number; y: number }[] = [];
    const a = towerAnchors(0)[k];
    const b = towerAnchors(1)[k];
    const c = towerAnchors(2)[k];
    if (!a || !b || !c) continue;
    [
      [a, b],
      [b, c],
    ].forEach(([from, to]) => {
      for (let i = 0; i <= 16; i += 1) {
        const t = i / 16;
        points.push({
          x: Phaser.Math.Linear(from!.x, to!.x, t),
          y: Phaser.Math.Linear(from!.y, to!.y, t) + Math.sin(t * Math.PI) * 14,
        });
      }
    });
    wires.push(points);
  }
  return wires;
}

/* ------------------------------ painters ------------------------------ */

function paintWest(ctx: Ctx): void {
  sky(ctx, [
    [0, 0x060b16],
    [0.45, 0x14263a],
    [0.68, 0x2a4452],
    [1, 0x0b1714],
  ]);
  stars(ctx, 11, 70, 110);
  ctx.fillStyle = radial(ctx, 194, 60, 10, 60, [
    [0, 0xdfeedd, 0.35],
    [1, 0xdfeedd, 0],
  ]);
  ctx.fillRect(130, 0, 126, 130);
  glow(ctx, 0xdfeedd, 6, () => {
    ellipse(ctx, 194, 60, 15, 15);
    ctx.fillStyle = radial(ctx, 190, 56, 2, 16, [
      [0, 0xf4fbef],
      [1, 0xb8cbb8],
    ]);
    ctx.fill();
  });
  [
    [188, 56, 3],
    [198, 66, 2.2],
    [192, 67, 1.4],
  ].forEach(([x, y, r]) => {
    ellipse(ctx, x ?? 0, y ?? 0, r ?? 1, r ?? 1);
    ctx.fillStyle = css(0x9fb4a4, 0.35);
    ctx.fill();
  });
  ridge(ctx, 3, 118, 18, 0x1b3040, 0.035);
  haze(ctx, 124, 10, 0xc8dcd8, 0.18);
  ridge(ctx, 4, 132, 14, 0x142531, 0.05);
  haze(ctx, 138, 9, 0xc8dcd8, 0.2);
  // A fab campus glows through the trees: this is the Silicon Forest.
  ctx.fillStyle = css(0x10191f);
  ctx.fillRect(150, 128, 58, 16);
  ctx.fillRect(166, 120, 20, 10);
  const random = seeded(21);
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = css(
      random() > 0.3 ? 0xffd88a : 0x8ae6ff,
      0.55 + random() * 0.4,
    );
    ctx.fillRect(152 + random() * 54, 130 + random() * 12, 1.4, 0.8);
  }
  glow(ctx, 0xff3a2a, 3, () => {
    ellipse(ctx, 176, 119, 0.9, 0.9);
    ctx.fillStyle = css(0xff5a4a);
    ctx.fill();
  });
  for (let x = -6; x < W + 10; x += 9 + random() * 6)
    fir(ctx, x, 156 + random() * 6, 28 + random() * 22, 0x0e1c1f, 0x7aa0a0);
  haze(ctx, 158, 10, 0xc8dcd8, 0.16);
  ctx.fillStyle = linear(ctx, 0, 156, 0, H, [
    [0, 0x0d1a17],
    [1, 0x050a09],
  ]);
  ctx.fillRect(0, 156, W, H - 156);
  // Highway 26 curving into the trees.
  ctx.beginPath();
  ctx.moveTo(92, H);
  ctx.bezierCurveTo(110, 205, 150, 185, 134, 160);
  ctx.lineTo(140, 160);
  ctx.bezierCurveTo(162, 186, 150, 214, 178, H);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 160, 0, H, [
    [0, 0x23292e],
    [1, 0x15191d],
  ]);
  ctx.fill();
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(135, H);
  ctx.bezierCurveTo(132, 210, 156, 186, 137, 161);
  ctx.strokeStyle = css(0xe8c450, 0.7);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.setLineDash([]);
  for (let x = -14; x < 40; x += 14)
    fir(ctx, x, H + 8, 120 + (x % 3) * 10, 0x040908);
  for (let x = 222; x < W + 20; x += 15)
    fir(ctx, x, H + 8, 115 + (x % 4) * 8, 0x040908);
}

function paintEast(ctx: Ctx): void {
  sky(ctx, [
    [0, 0x14162e],
    [0.35, 0x3c2c58],
    [0.62, 0xb0606a],
    [0.72, 0xe8955e],
    [1, 0x0c0f1c],
  ]);
  const random = seeded(5);
  for (let i = 0; i < 14; i += 1) {
    ellipse(
      ctx,
      random() * W,
      12 + random() * 46,
      22 + random() * 30,
      6 + random() * 8,
    );
    ctx.fillStyle = css(0x241c3a, 0.55 + random() * 0.3);
    ctx.fill();
  }
  haze(ctx, 150, 14, 0xffb47a, 0.35);
  // Skyline with lit windows.
  for (let x = -4; x < W;) {
    const width = 8 + random() * 14;
    const height = 14 + random() * 30;
    ctx.fillStyle = css(random() > 0.5 ? 0x181b30 : 0x14172a);
    ctx.fillRect(x, 168 - height, width, height + 10);
    for (let wy = 168 - height + 3; wy < 166; wy += 3.2)
      for (let wx = x + 1.5; wx < x + width - 1.5; wx += 2.6)
        if (random() > 0.62) {
          ctx.fillStyle = css(
            random() > 0.8 ? 0x8ae6ff : 0xffd88a,
            0.5 + random() * 0.5,
          );
          ctx.fillRect(wx, wy, 1.1, 1.3);
        }
    x += width + random() * 2;
  }
  ctx.fillStyle = linear(ctx, 0, 168, 0, H, [
    [0, 0x10142a],
    [1, 0x06070f],
  ]);
  ctx.fillRect(0, 168, W, H - 168);
  for (let i = 0; i < 18; i += 1) {
    const x = random() * W;
    ctx.fillStyle = linear(ctx, 0, 170, 0, 200, [
      [0, random() > 0.7 ? 0x8ae6ff : 0xffc070, 0.25],
      [1, 0xffc070, 0],
    ]);
    ctx.fillRect(x, 170, 1.2, 24);
  }
  EAST_TOWERS.forEach((tower, index) =>
    lattice(
      ctx,
      tower.x,
      tower.base,
      tower.top,
      tower.width,
      index === 1 ? 0x2a2c48 : 0x07080f,
    ),
  );
  eastWires().forEach((wire) => {
    const flat: number[] = [];
    wire.forEach((p) => flat.push(p.x, p.y));
    line(ctx, flat, 0x05060c, 0.7);
  });
  // The warden crouched on the far tower's arm.
  path(
    ctx,
    [128, 112, 129, 104, 132, 99, 135, 104, 136, 112, 134, 118, 130, 118],
  );
  ctx.fillStyle = css(0x05060c);
  ctx.fill();
}

function paintMilwaukie(ctx: Ctx): void {
  sky(ctx, [
    [0, 0x1e2f42],
    [0.42, 0x6a8a98],
    [0.55, 0xb4c8c6],
    [1, 0x0c2430],
  ]);
  glow(ctx, 0xffffff, 10, () => {
    ellipse(ctx, 74, 78, 11, 11);
    ctx.fillStyle = css(0xf4f0e0, 0.8);
    ctx.fill();
  });
  ridge(ctx, 8, 116, 10, 0x4e6a74, 0.04);
  const random = seeded(31);
  for (let x = 0; x < W; x += 6 + random() * 8) {
    ctx.fillStyle = css(0x3e5862);
    ctx.fillRect(x, 116 - random() * 14, 5 + random() * 6, 30);
  }
  haze(ctx, 124, 12, 0xd8e6e4, 0.45);
  ctx.fillStyle = linear(ctx, 0, 132, 0, H, [
    [0, 0x6c929c],
    [0.25, 0x2f6474],
    [1, 0x0a2632],
  ]);
  ctx.fillRect(0, 132, W, H - 132);
  // Old truss bridge with stone piers.
  const deck = 108;
  [52, 128, 204].forEach((x) => {
    ctx.fillStyle = linear(ctx, x - 6, 0, x + 6, 0, [
      [0, 0x5a6a70],
      [1, 0x2a363c],
    ]);
    ctx.fillRect(x - 6, deck + 4, 12, 46);
    ctx.fillStyle = css(0x0a2632, 0.5);
    ctx.fillRect(x - 6, 134, 12, 16);
    ctx.fillStyle = linear(ctx, 0, 150, 0, 190, [
      [0, 0x2a363c, 0.55],
      [1, 0x2a363c, 0],
    ]);
    ctx.fillRect(x - 6, 150, 12, 40);
  });
  ctx.fillStyle = css(0x1a252b);
  ctx.fillRect(0, deck, W, 5);
  const spans = [
    [-24, 52],
    [52, 128],
    [128, 204],
    [204, 280],
  ];
  spans.forEach(([a, b]) => {
    const left = a ?? 0;
    const right = b ?? 0;
    const mid = (left + right) / 2;
    ctx.beginPath();
    ctx.moveTo(left, deck);
    ctx.quadraticCurveTo(mid, deck - 46, right, deck);
    ctx.strokeStyle = css(0x1a252b);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      const x = left + (right - left) * t;
      const top = deck - Math.sin(t * Math.PI) * 23 * 1.0;
      line(ctx, [x, deck, x, top], 0x1a252b, 0.8);
      if (i < 8) {
        const nx = left + ((right - left) * (i + 1)) / 8;
        const ntop = deck - Math.sin(((i + 1) / 8) * Math.PI) * 23;
        line(
          ctx,
          i < 4 ? [x, deck, nx, ntop] : [x, top, nx, deck],
          0x1a252b,
          0.6,
        );
      }
    }
  });
  for (let x = 0; x < W; x += 10) {
    ellipse(ctx, x + 5, deck - 1, 0.7, 0.7);
    ctx.fillStyle = css(0xffd88a, 0.7);
    ctx.fill();
  }
  haze(ctx, 140, 8, 0xe0ecea, 0.4);
  // Near bank with rail line and reeds.
  ctx.beginPath();
  ctx.moveTo(0, 196);
  ctx.bezierCurveTo(60, 190, 90, 206, 140, 218);
  ctx.lineTo(140, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 190, 0, H, [
    [0, 0x2a3430],
    [1, 0x0e1412],
  ]);
  ctx.fill();
  line(ctx, [0, 206, 120, 226], 0x6a6058, 0.8);
  line(ctx, [0, 210, 116, 232], 0x6a6058, 0.8);
  for (let x = 0; x < 120; x += 5)
    line(ctx, [x, 205 + x * 0.17, x - 1, 211 + x * 0.18], 0x3a2e26, 0.9);
  for (let i = 0; i < 40; i += 1) {
    const x = random() * 150;
    const base = 198 + x * 0.12 + random() * 6;
    line(
      ctx,
      [x, base, x + (random() - 0.5) * 4, base - 8 - random() * 10],
      0x1c2a22,
      0.6,
    );
  }
}

function paintWalla(ctx: Ctx): void {
  sky(ctx, [
    [0, 0x4a74b0],
    [0.3, 0x92a8c0],
    [0.46, 0xf2c27a],
    [0.52, 0xffdc96],
    [1, 0x8a5a20],
  ]);
  ctx.fillStyle = radial(ctx, 64, 112, 4, 80, [
    [0, 0xfff4d0, 0.9],
    [0.25, 0xffd890, 0.45],
    [1, 0xffd890, 0],
  ]);
  ctx.fillRect(0, 30, 160, 160);
  const random = seeded(41);
  for (let i = 0; i < 6; i += 1) {
    ellipse(
      ctx,
      20 + random() * 220,
      30 + random() * 50,
      30 + random() * 26,
      2 + random() * 2,
    );
    ctx.fillStyle = css(0xffe6c0, 0.35);
    ctx.fill();
  }
  ridge(ctx, 12, 112, 10, 0x7a76a0, 0.03);
  haze(ctx, 116, 6, 0xffe0a0, 0.4);
  const hill = (
    seed: number,
    y: number,
    amp: number,
    top: number,
    bottom: number,
  ) =>
    ridge(
      ctx,
      seed,
      y,
      amp,
      linear(ctx, 0, y - amp, 0, y + 40, [
        [0, top],
        [1, bottom],
      ]),
      0.022,
    );
  hill(13, 128, 14, 0xd8b060, 0xb08a3a);
  // Vineyard rows climbing the middle hill.
  hill(14, 150, 16, 0x8aa048, 0x5a7a2a);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 120, W, 60);
  ctx.clip();
  for (let k = -16; k <= 16; k += 1) {
    ctx.beginPath();
    ctx.moveTo(128 + k * 3, 134);
    ctx.quadraticCurveTo(128 + k * 9, 150, 128 + k * 22, 180);
    ctx.setLineDash([1.2, 1.4]);
    ctx.strokeStyle = css(0x2f4a1a, 0.85);
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  // A red barn and the colossus waiting on the crest.
  ctx.fillStyle = css(0x7a2a1e);
  ctx.fillRect(34, 122, 14, 8);
  path(ctx, [32, 122, 41, 115, 50, 122]);
  ctx.fillStyle = css(0x5a1c14);
  ctx.fill();
  const tree = 0x2a1e14;
  // Twisted trunk with a face-like burl, arms of vine reaching out.
  ctx.beginPath();
  ctx.moveTo(178, 130);
  ctx.bezierCurveTo(186, 122, 180, 112, 186, 104);
  ctx.quadraticCurveTo(190, 96, 186, 90);
  ctx.lineTo(197, 90);
  ctx.quadraticCurveTo(193, 98, 198, 106);
  ctx.bezierCurveTo(202, 114, 198, 122, 206, 130);
  ctx.closePath();
  ctx.fillStyle = css(tree);
  ctx.fill();
  [
    [186, 104, 172, 98, 160, 104, 152, 98],
    [184, 112, 170, 114, 162, 122],
    [197, 104, 212, 96, 222, 102, 230, 96],
    [198, 112, 212, 116, 218, 124],
    [190, 92, 182, 80, 172, 76],
    [194, 92, 202, 80, 212, 78],
  ].forEach((branch, i) => line(ctx, branch, tree, i < 4 ? 2.2 : 1.6));
  [
    [152, 98],
    [230, 96],
    [162, 122],
    [218, 124],
  ].forEach(([x, y]) => {
    [-1, 0, 1].forEach((k) =>
      line(
        ctx,
        [x ?? 0, y ?? 0, (x ?? 0) + k * 2.5, (y ?? 0) + 4 + Math.abs(k)],
        tree,
        0.8,
      ),
    );
  });
  [
    [172, 76, 8, 5],
    [212, 78, 8, 5],
    [192, 80, 9, 6],
    [182, 84, 6, 4],
    [203, 85, 6, 4],
  ].forEach(([x, y, rx, ry]) => {
    ellipse(ctx, x ?? 0, y ?? 0, rx ?? 1, ry ?? 1);
    ctx.fillStyle = css(0x24361a);
    ctx.fill();
  });
  [
    [164, 102],
    [222, 100],
    [176, 80],
    [208, 82],
  ].forEach(([x, y]) => {
    [0, 1.6, -1.6].forEach((dx, i) => {
      ellipse(ctx, (x ?? 0) + dx, (y ?? 0) + 2 + (i ? 1.6 : 0), 1.2, 1.2);
      ctx.fillStyle = css(0x4a1c46);
      ctx.fill();
    });
  });
  ellipse(ctx, 191.5, 101, 6, 3.2);
  ctx.fillStyle = css(0x120c08);
  ctx.fill();
  hill(15, 184, 10, 0xe8c060, 0xc8962e);
  ctx.fillStyle = linear(ctx, 0, 188, 0, H, [
    [0, 0xd8a840],
    [1, 0x8a5a1a],
  ]);
  ctx.fillRect(0, 196, W, H - 196);
}

function paintBend(ctx: Ctx): void {
  sky(ctx, [
    [0, 0x160c24],
    [0.3, 0x4a1c38],
    [0.55, 0xc0483a],
    [0.66, 0xf08a4c],
    [1, 0x1a100e],
  ]);
  stars(ctx, 17, 40, 60, 0.6);
  const random = seeded(51);
  for (let i = 0; i < 10; i += 1) {
    ellipse(
      ctx,
      random() * W,
      20 + random() * 40,
      30 + random() * 20,
      4 + random() * 4,
    );
    ctx.fillStyle = css(0x2a1424, 0.5);
    ctx.fill();
  }
  // Cinder cone to the right.
  path(ctx, [168, 168, 206, 128, 224, 127, 262, 168]);
  ctx.fillStyle = linear(ctx, 0, 127, 0, 168, [
    [0, 0x5a2a24],
    [1, 0x2a1614],
  ]);
  ctx.fill();
  // The great volcano.
  ctx.beginPath();
  ctx.moveTo(14, 170);
  ctx.bezierCurveTo(70, 140, 104, 84, 118, 64);
  ctx.lineTo(142, 64);
  ctx.bezierCurveTo(156, 84, 190, 140, 246, 170);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 60, 64, 200, 170, [
    [0, 0x4a3a46],
    [0.5, 0x2a2028],
    [1, 0x120c10],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(100, 84);
  for (let x = 100; x <= 160; x += 4)
    ctx.lineTo(x, 92 + Math.sin(x * 0.7) * 4 + (x % 8 ? 3 : -2));
  ctx.lineTo(160, 50);
  ctx.lineTo(100, 50);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 60, 0, 100, [
    [0, 0xffffff],
    [1, 0xc8b8c8],
  ]);
  ctx.fill();
  ctx.restore();
  // Brow ridges where the titan's face hides in the rock.
  line(ctx, [108, 98, 118, 101, 126, 99], 0x120c10, 1.6, 0.8);
  line(ctx, [134, 99, 142, 101, 152, 98], 0x120c10, 1.6, 0.8);
  [
    [126, 66, 118, 96, 108, 120, 96, 150],
    [136, 66, 142, 92, 150, 116, 158, 142],
  ].forEach((flow) =>
    glow(ctx, 0xff4a1c, 4, () => line(ctx, flow, 0xff7a3a, 1.4, 0.9)),
  );
  glow(ctx, 0xff5a2a, 8, () => {
    ellipse(ctx, 130, 64, 12, 2.6);
    ctx.fillStyle = css(0xffc06a);
    ctx.fill();
  });
  haze(ctx, 166, 8, 0xf08a4c, 0.35);
  ctx.fillStyle = linear(ctx, 0, 166, 0, H, [
    [0, 0x3a2420],
    [1, 0x120a08],
  ]);
  ctx.fillRect(0, 166, W, H - 166);
  for (let i = 0; i < 70; i += 1) {
    const x = random() * W;
    const y = 172 + random() * 64;
    ellipse(ctx, x, y, 1.6 + (y - 170) * 0.03, 0.9 + (y - 170) * 0.015);
    ctx.fillStyle = css(random() > 0.5 ? 0x5a6a50 : 0x6a7058, 0.75);
    ctx.fill();
  }
  const juniper = (x: number, base: number, size: number) => {
    line(
      ctx,
      [
        x,
        base,
        x - size * 0.1,
        base - size * 0.5,
        x + size * 0.12,
        base - size * 0.8,
      ],
      0x120a08,
      size * 0.08,
    );
    [
      [0, -0.85, 0.32],
      [-0.25, -0.6, 0.28],
      [0.25, -0.62, 0.26],
      [0, -0.45, 0.24],
    ].forEach(([dx, dy, r]) => {
      ellipse(
        ctx,
        x + (dx ?? 0) * size,
        base + (dy ?? 0) * size,
        (r ?? 0.3) * size,
        (r ?? 0.3) * size * 0.75,
      );
      ctx.fillStyle = css(0x0e0a0a);
      ctx.fill();
    });
  };
  juniper(18, 226, 50);
  juniper(236, 222, 44);
  juniper(204, 192, 18);
}

const PAINTERS: Readonly<Record<BossLocationId, (ctx: Ctx) => void>> = {
  hillsboro_west: paintWest,
  hillsboro_east: paintEast,
  milwaukie: paintMilwaukie,
  walla_walla: paintWalla,
  bend: paintBend,
};

/** Paints (once per scene start) the full-screen still of a region. */
export function paintRegionBackdrop(
  scene: Phaser.Scene,
  id: BossLocationId,
): string {
  return paintTexture(scene, `region-${id}`, W, H, PAINTERS[id]);
}

/* ------------------------------ animation ------------------------------ */

/** Per-frame work that is removed when the scene shuts down. */
function onUpdate(scene: Phaser.Scene, handler: (time: number) => void): void {
  scene.events.on(Phaser.Scenes.Events.UPDATE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.events.off(Phaser.Scenes.Events.UPDATE, handler),
  );
}

function fogBand(
  scene: Phaser.Scene,
  key: string,
  color: number,
  alpha: number,
): string {
  if (scene.textures.exists(key)) return key;
  return paintTexture(scene, key, 200, 30, (ctx) => {
    const random = seeded(key.length * 7);
    for (let i = 0; i < 12; i += 1) {
      const x = 20 + random() * 160;
      const rx = 20 + random() * 30;
      ctx.fillStyle = radial(ctx, x, 15, 0, rx, [
        [0, color, alpha],
        [1, color, 0],
      ]);
      ellipse(ctx, x, 15, rx, 10 + random() * 4);
      ctx.fill();
    }
  });
}

function drift(
  scene: Phaser.Scene,
  key: string,
  y: number,
  speed: number,
  alpha: number,
  depth: number,
): void {
  [0, 200].forEach((offset) => {
    const image = addPainted(scene, offset - 20, y, key, 0, 0.5)
      .setAlpha(alpha)
      .setDepth(depth);
    scene.tweens.add({
      targets: image,
      x: { from: offset - 20, to: offset - 220 },
      duration: speed,
      repeat: -1,
      onRepeat: () => image.setX(offset - 20),
    });
  });
}

/** Two glowing eyes that blink now and then. */
export function lurkingEyes(
  scene: Phaser.Scene,
  x: number,
  y: number,
  gap: number,
  color: number,
  size = 1,
  depth = 5,
): Phaser.GameObjects.Container {
  ensureFxTextures(scene);
  const k = size / ART_RESOLUTION;
  const parts = [-1, 1].flatMap((s) => [
    scene.add
      .image(s * gap * 0.5, 0, 'fx-soft')
      .setTint(color)
      .setScale(0.9 * k, 0.5 * k)
      .setBlendMode(Phaser.BlendModes.ADD),
    scene.add
      .image(s * gap * 0.5, 0, 'fx-soft')
      .setTint(0xffffff)
      .setScale(0.28 * k, 0.16 * k)
      .setBlendMode(Phaser.BlendModes.ADD),
  ]);
  const eyes = scene.add.container(x, y, parts).setDepth(depth);
  let nextBlink: Phaser.Time.TimerEvent | undefined;
  const blink = () => {
    if (!eyes.active) return;
    scene.tweens.add({
      targets: eyes,
      scaleY: 0.08,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        nextBlink = scene.time.delayedCall(
          Phaser.Math.Between(1800, 4200),
          blink,
        );
      },
    });
  };
  nextBlink = scene.time.delayedCall(1400, blink);
  // The eyes can be removed while the scene keeps running (the journey map
  // is redrawn in place), so their timer and tweens must go with them.
  eyes.once(Phaser.GameObjects.Events.DESTROY, () => {
    nextBlink?.remove(false);
    scene.tweens.killTweensOf(eyes);
  });
  scene.tweens.add({
    targets: eyes,
    alpha: { from: 0.75, to: 1 },
    duration: 900,
    yoyo: true,
    repeat: -1,
  });
  return eyes;
}

function animateWest(scene: Phaser.Scene): void {
  drift(scene, fogBand(scene, 'fog-west', 0xc8dcd8, 0.35), 150, 26000, 0.9, 4);
  drift(scene, fogBand(scene, 'fog-west', 0xc8dcd8, 0.35), 196, 18000, 0.7, 6);
  const eye = lurkingEyes(scene, 98, 146, 0.1, 0xff3a2a, 0.7, 5);
  scene.tweens.add({
    targets: eye,
    x: 104,
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  addParticles(scene, 0, 0, 'fx-streak', {
    x: { min: -20, max: 270 },
    y: -6,
    angle: { min: 100, max: 104 },
    speed: { min: 210, max: 260 },
    lifespan: 1200,
    alpha: { start: 0.35, end: 0.1 },
    scaleX: 0.7,
    tint: 0xb8d0e0,
    frequency: 22,
    rotate: 101,
  }).setDepth(7);
}

function animateEast(scene: Phaser.Scene): void {
  lurkingEyes(scene, 132, 104, 2.6, 0x6ee6ff, 0.45, 5);
  const wires = eastWires();
  const sparks = scene.add
    .graphics()
    .setDepth(6)
    .setBlendMode(Phaser.BlendModes.ADD);
  const pulses = wires.map((_, index) => ({ t: index * 0.27 }));
  pulses.forEach((pulse, index) =>
    scene.tweens.add({
      targets: pulse,
      t: { from: 0, to: 1 },
      duration: 2600 + index * 500,
      delay: index * 400,
      repeat: -1,
    }),
  );
  onUpdate(scene, () => {
    sparks.clear();
    pulses.forEach((pulse, index) => {
      const wire = wires[index];
      if (!wire) return;
      const head = Math.floor(pulse.t * (wire.length - 1));
      for (let k = 0; k < 6; k += 1) {
        const point = wire[head - k];
        if (!point) continue;
        sparks
          .fillStyle(k === 0 ? 0xffffff : 0x6ee6ff, 1 - k / 6)
          .fillCircle(point.x, point.y, k === 0 ? 1.4 : 1);
      }
    });
  });
  const flash = scene.add
    .rectangle(128, 120, 256, 240, 0xd8f0ff, 0)
    .setDepth(8);
  const bolt = scene.add
    .graphics()
    .setDepth(3)
    .setBlendMode(Phaser.BlendModes.ADD);
  const strike = () => {
    const x = Phaser.Math.Between(70, 200);
    const points = [new Phaser.Math.Vector2(x, 10)];
    for (let y = 18; y < 120; y += 9)
      points.push(
        new Phaser.Math.Vector2(
          points[points.length - 1]!.x + Phaser.Math.Between(-7, 7),
          y,
        ),
      );
    bolt
      .clear()
      .lineStyle(3, 0x8ae6ff, 0.4)
      .strokePoints(points)
      .lineStyle(1, 0xffffff, 1)
      .strokePoints(points);
    flash.setAlpha(0.35);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 260 });
    scene.time.delayedCall(140, () => bolt.clear());
    scene.time.delayedCall(Phaser.Math.Between(2200, 4200), strike);
  };
  scene.time.delayedCall(1200, strike);
  addParticles(scene, 0, 0, 'fx-streak', {
    x: { min: -40, max: 260 },
    y: -6,
    angle: { min: 112, max: 118 },
    speed: { min: 140, max: 190 },
    lifespan: 1600,
    alpha: { start: 0.5, end: 0.15 },
    scaleX: 0.4,
    tint: 0xd8f4ff,
    frequency: 30,
    rotate: 115,
  }).setDepth(7);
}

function animateMilwaukie(scene: Phaser.Scene): void {
  drift(scene, fogBand(scene, 'fog-river', 0xe6f0ee, 0.4), 132, 30000, 0.85, 4);
  drift(scene, fogBand(scene, 'fog-river', 0xe6f0ee, 0.4), 178, 21000, 0.55, 6);
  const shimmer = scene.add.graphics().setDepth(3);
  const glints = Array.from({ length: 34 }, (_, i) => ({
    x: Phaser.Math.Between(0, 256),
    y: 140 + ((i * 37) % 96),
    phase: Math.random() * 6,
  }));
  onUpdate(scene, (time: number) => {
    shimmer.clear();
    glints.forEach((glint) => {
      const alpha = 0.25 + 0.25 * Math.sin(time / 400 + glint.phase);
      const width = 3 + (glint.y - 140) * 0.06;
      const x = (glint.x + time * 0.006 * (1 + (glint.y - 140) / 60)) % 270;
      shimmer
        .lineStyle(0.6, 0xd8f6ff, alpha)
        .lineBetween(x - width, glint.y, x + width, glint.y);
    });
  });
  // The guardian's helmet breaks the surface under the bridge.
  const dome = scene.add.ellipse(128, 152, 18, 7, 0x2a3a3e).setDepth(3);
  const eyes = lurkingEyes(scene, 128, 151, 5, 0x5be0ee, 0.5, 4);
  const ring = scene.add
    .ellipse(128, 154, 20, 5)
    .setStrokeStyle(0.6, 0xd8f6ff, 0.6)
    .setDepth(3);
  scene.tweens.add({
    targets: ring,
    scaleX: 2.6,
    scaleY: 2.2,
    alpha: 0,
    duration: 2200,
    repeat: -1,
  });
  scene.tweens.add({
    targets: [dome, eyes],
    y: '+=1.5',
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  addParticles(scene, 0, 0, 'fx-streak', {
    x: { min: -20, max: 270 },
    y: -6,
    angle: { min: 95, max: 98 },
    speed: { min: 120, max: 160 },
    lifespan: 1800,
    alpha: { start: 0.25, end: 0.05 },
    scaleX: 0.4,
    tint: 0xd8f0f4,
    frequency: 45,
    rotate: 96,
  }).setDepth(7);
}

function animateWalla(scene: Phaser.Scene): void {
  lurkingEyes(scene, 191, 101, 5, 0xffb02a, 0.55, 3);
  const wheat = scene.add.graphics().setDepth(5);
  const stalks = Array.from({ length: 150 }, (_, i) => ({
    x: (i * 1.73) % 260,
    base: 244,
    height: 30 + ((i * 13) % 26),
    phase: i * 0.37,
    shade: i % 3,
  }));
  onUpdate(scene, (time: number) => {
    wheat.clear();
    const gust = 0.5 + 0.5 * Math.sin(time / 1600);
    stalks.forEach((stalk) => {
      const lean =
        (Math.sin(time / 420 + stalk.phase + stalk.x * 0.04) * 0.5 + gust) * 9;
      const tipX = stalk.x + lean;
      const tipY = stalk.base - stalk.height + Math.abs(lean) * 0.25;
      const color = [0xc8962e, 0xe0b450, 0xf0cc6a][stalk.shade] ?? 0xe0b450;
      wheat
        .lineStyle(0.6, color, 1)
        .lineBetween(stalk.x, stalk.base, tipX, tipY);
      wheat
        .fillStyle(color, 1)
        .fillEllipse(tipX + lean * 0.06, tipY - 1.6, 1.6, 4.2);
    });
  });
  addParticles(scene, 0, 0, 'fx-streak', {
    x: 270,
    y: { min: 40, max: 230 },
    speedX: { min: -260, max: -180 },
    lifespan: 1600,
    alpha: { start: 0.4, end: 0 },
    tint: 0xfff0d0,
    frequency: 140,
  }).setDepth(6);
  addParticles(scene, 0, 0, 'fx-leaf', {
    x: 270,
    y: { min: 120, max: 230 },
    speedX: { min: -120, max: -60 },
    speedY: { min: -20, max: 20 },
    rotate: { min: 0, max: 360 },
    lifespan: 3200,
    scale: { min: 0.5, max: 0.9 },
    tint: [0xe0b450, 0xc8962e, 0x8aa048, 0x7e3f78],
    frequency: 110,
  }).setDepth(7);
}

function animateBend(scene: Phaser.Scene): void {
  const eyes = lurkingEyes(scene, 130, 103, 22, 0xff6a2a, 1.4, 3);
  eyes.setAlpha(0);
  scene.tweens.add({ targets: eyes, alpha: 1, delay: 900, duration: 1400 });
  const lava = scene.add
    .image(130, 66, 'fx-soft')
    .setTint(0xff6a2a)
    .setScale(3.4 / ART_RESOLUTION, 1.6 / ART_RESOLUTION)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(3);
  scene.tweens.add({
    targets: lava,
    alpha: { from: 0.5, to: 1 },
    duration: 700,
    yoyo: true,
    repeat: -1,
  });
  addParticles(scene, 130, 62, 'fx-soft', {
    speedY: { min: -26, max: -14 },
    speedX: { min: -16, max: 2 },
    lifespan: 4200,
    scale: { start: 1.2, end: 5 },
    alpha: { start: 0.5, end: 0 },
    tint: [0x2a1c22, 0x3e2c32],
    frequency: 140,
  }).setDepth(2);
  addParticles(scene, 0, 0, 'fx-spark', {
    x: { min: 0, max: 256 },
    y: 246,
    speedY: { min: -40, max: -18 },
    speedX: { min: -10, max: 10 },
    lifespan: 5200,
    scale: { start: 0.6, end: 0 },
    tint: [0xffe08a, 0xff8a3d, 0xff4a1c],
    blendMode: 'ADD',
    frequency: 90,
  }).setDepth(7);
}

const ANIMATORS: Readonly<
  Record<BossLocationId, (scene: Phaser.Scene) => void>
> = {
  hillsboro_west: animateWest,
  hillsboro_east: animateEast,
  milwaukie: animateMilwaukie,
  walla_walla: animateWalla,
  bend: animateBend,
};

/** Paints a region and brings it to life with weather and a watching guardian. */
export function addRegionScene(scene: Phaser.Scene, id: BossLocationId): void {
  ensureFxTextures(scene);
  addPainted(scene, 0, 0, paintRegionBackdrop(scene, id), 0, 0).setDepth(0);
  ANIMATORS[id](scene);
}

export function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
