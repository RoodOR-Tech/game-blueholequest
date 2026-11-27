import Phaser from 'phaser';
import type { BossLocationId } from '../game/progression/bossLocations';
import {
  JOURNEY_FRAME,
  journeyLayout,
  type JourneyLayout,
  type MapPoint,
} from '../game/progression/journeyPaths';
import {
  type Ctx,
  css,
  ellipse,
  glow,
  line,
  linear,
  paintTexture,
  path,
  radial,
  seeded,
} from './painter';

const F = JOURNEY_FRAME;

export interface JourneyTrail {
  readonly layout: JourneyLayout;
  readonly curve: Phaser.Curves.Spline;
  /** Evenly spaced points along the trail, for drawing and spacing checks. */
  readonly samples: readonly Phaser.Math.Vector2[];
}

export function journeyTrail(id: BossLocationId): JourneyTrail {
  const layout = journeyLayout(id);
  const curve = new Phaser.Curves.Spline(
    layout.waypoints.map((point) => new Phaser.Math.Vector2(point.x, point.y)),
  );
  return { layout, curve, samples: curve.getPoints(220) };
}

interface MapContext {
  readonly ctx: Ctx;
  readonly trail: JourneyTrail;
  readonly random: () => number;
  /** Distance from (x, y) to the trail. */
  readonly clearance: (x: number, y: number) => number;
  readonly stop: (index: number) => MapPoint;
}

/** Scatters items in the frame, skipping spots too close to the trail. */
function scatter(
  map: MapContext,
  count: number,
  margin: number,
  draw: (x: number, y: number, k: number) => void,
  area: { x: number; y: number; w: number; h: number } = {
    x: F.x + 3,
    y: F.y + 3,
    w: F.width - 6,
    h: F.height - 6,
  },
): void {
  const placed: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = area.x + map.random() * area.w;
    const y = area.y + map.random() * area.h;
    if (map.clearance(x, y) < margin) continue;
    placed.push({ x, y });
  }
  placed.sort((a, b) => a.y - b.y).forEach((p, k) => draw(p.x, p.y, k));
}

function noise(
  map: MapContext,
  colors: readonly number[],
  count: number,
  size: number,
  alpha: number,
): void {
  for (let i = 0; i < count; i += 1) {
    const x = F.x + map.random() * F.width;
    const y = F.y + map.random() * F.height;
    ellipse(
      map.ctx,
      x,
      y,
      size * (0.5 + map.random()),
      size * 0.6 * (0.5 + map.random()),
      map.random() * 3,
    );
    map.ctx.fillStyle = css(colors[i % colors.length] ?? 0, alpha);
    map.ctx.fill();
  }
}

function mapFir(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: number,
): void {
  ellipse(ctx, x + size * 0.3, y + 0.6, size * 0.5, size * 0.2);
  ctx.fillStyle = css(0x000000, 0.25);
  ctx.fill();
  for (let tier = 0; tier < 3; tier += 1) {
    const w = size * (0.5 - tier * 0.12);
    const top = y - size * (0.55 + tier * 0.35);
    path(ctx, [
      x - w,
      y - tier * size * 0.32,
      x,
      top,
      x + w,
      y - tier * size * 0.32,
    ]);
    ctx.fillStyle = linear(ctx, x - w, 0, x + w, 0, [
      [0, color],
      [1, 0x0a1a10],
    ]);
    ctx.fill();
  }
}

function roundTree(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: number,
): void {
  ellipse(ctx, x + size * 0.3, y + size * 0.4, size * 0.9, size * 0.4);
  ctx.fillStyle = css(0x000000, 0.25);
  ctx.fill();
  ellipse(ctx, x, y, size, size * 0.85);
  ctx.fillStyle = radial(ctx, x - size * 0.3, y - size * 0.3, 0.2, size * 1.2, [
    [0, color],
    [1, 0x1a2a18],
  ]);
  ctx.fill();
}

function caption(ctx: Ctx, x: number, y: number, color: number): void {
  ellipse(ctx, x, y, 1.6, 1.6);
  ctx.fillStyle = css(color);
  ctx.fill();
}

/* ------------------------------ regions ------------------------------ */

function westMap(map: MapContext): void {
  const { ctx } = map;
  ctx.fillStyle = linear(ctx, 0, F.y, 0, F.y + F.height, [
    [0, 0x23402c],
    [1, 0x182e20],
  ]);
  ctx.fillRect(F.x, F.y, F.width, F.height);
  noise(map, [0x2e5236, 0x14261a, 0x3a5a32], 140, 7, 0.35);
  // Creek running down from the Coast Range.
  ctx.beginPath();
  ctx.moveTo(40, F.y);
  ctx.bezierCurveTo(60, 70, 30, 100, 64, 128);
  ctx.bezierCurveTo(90, 150, 84, 176, 100, F.y + F.height);
  ctx.strokeStyle = css(0x1f5a78);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = css(0x5ab0d0, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  // Flooded underpass: the highway crossing with water pooled under it.
  const s1 = map.stop(1);
  ellipse(ctx, s1.x + 2, s1.y + 4, 13, 6);
  ctx.fillStyle = css(0x2f7fa8, 0.85);
  ctx.fill();
  ctx.fillStyle = css(0x3a3f44);
  ctx.fillRect(F.x, s1.y - 6, F.width * 0.5, 7);
  ctx.setLineDash([2, 2]);
  line(ctx, [F.x, s1.y - 2.5, F.x + F.width * 0.5, s1.y - 2.5], 0xe8c450, 0.5);
  ctx.setLineDash([]);
  // Blackberry thicket.
  const s2 = map.stop(2);
  for (let i = 0; i < 26; i += 1) {
    const a = map.random() * Math.PI * 2;
    const r = 6 + map.random() * 10;
    const x = s2.x + Math.cos(a) * r;
    const y = s2.y + Math.sin(a) * r * 0.7;
    if (map.clearance(x, y) < 4) continue;
    ellipse(ctx, x, y, 3, 2.4);
    ctx.fillStyle = css(map.random() > 0.5 ? 0x1c3420 : 0x2a4426);
    ctx.fill();
    caption(ctx, x + 1, y - 0.5, 0x4a1c46);
  }
  // Construction detour.
  const s3 = map.stop(3);
  ctx.fillStyle = css(0x7a5a38);
  ellipse(ctx, s3.x - 4, s3.y + 4, 16, 9);
  ctx.fill();
  [
    [-14, -4],
    [-8, 8],
    [6, 10],
    [12, -6],
  ].forEach(([dx, dy]) => {
    const x = s3.x + (dx ?? 0);
    const y = s3.y + (dy ?? 0);
    path(ctx, [x - 1.8, y + 1.4, x, y - 2.8, x + 1.8, y + 1.4]);
    ctx.fillStyle = css(0xff8a2a);
    ctx.fill();
    line(ctx, [x - 1, y - 0.4, x + 1, y - 0.4], 0xffffff, 0.5);
  });
  ctx.fillStyle = css(0xffffff);
  ctx.fillRect(s3.x - 20, s3.y - 14, 12, 2.4);
  for (let k = 0; k < 4; k += 1) {
    ctx.fillStyle = css(0xe04a2a);
    ctx.fillRect(s3.x - 20 + k * 3, s3.y - 14, 1.5, 2.4);
  }
  scatter(map, 260, 7, (x, y) =>
    mapFir(
      ctx,
      x,
      y,
      7 + map.random() * 3,
      map.random() > 0.5 ? 0x2a5a34 : 0x1f4a2a,
    ),
  );
  // The fab in the forest, near the lair.
  const lair = map.stop(4);
  ctx.fillStyle = css(0x2a3038);
  ctx.fillRect(lair.x + 6, lair.y - 22, 18, 9);
  for (let i = 0; i < 6; i += 1)
    caption(ctx, lair.x + 8 + i * 3, lair.y - 18, 0xffd88a);
  noise(map, [0xd8e6e4], 10, 18, 0.07);
}

function eastMap(map: MapContext): void {
  const { ctx } = map;
  ctx.fillStyle = linear(ctx, 0, F.y, 0, F.y + F.height, [
    [0, 0x252c3e],
    [1, 0x1a2030],
  ]);
  ctx.fillRect(F.x, F.y, F.width, F.height);
  for (let x = F.x + 10; x < F.x + F.width; x += 22)
    line(ctx, [x, F.y, x, F.y + F.height], 0x343c52, 2);
  for (let y = F.y + 12; y < F.y + F.height; y += 20)
    line(ctx, [F.x, y, F.x + F.width, y], 0x343c52, 2);
  scatter(map, 220, 8, (x, y) => {
    const w = 5 + map.random() * 8;
    const h = 4 + map.random() * 6;
    ctx.fillStyle = css(0x000000, 0.3);
    ctx.fillRect(x - w / 2 + 1.5, y - h / 2 + 1.5, w, h);
    ctx.fillStyle = linear(ctx, x - w / 2, y - h / 2, x + w / 2, y + h / 2, [
      [0, 0x4a5470],
      [1, 0x2e364c],
    ]);
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    if (map.random() > 0.6)
      caption(ctx, x, y, map.random() > 0.5 ? 0xffd88a : 0x8ae6ff);
  });
  // Ice storm sheen.
  const s1 = map.stop(1);
  ctx.fillStyle = radial(ctx, s1.x, s1.y, 2, 26, [
    [0, 0xd8f4ff, 0.6],
    [1, 0xd8f4ff, 0],
  ]);
  ctx.fillRect(s1.x - 26, s1.y - 26, 52, 52);
  for (let i = 0; i < 30; i += 1)
    caption(
      ctx,
      s1.x + (map.random() - 0.5) * 44,
      s1.y + (map.random() - 0.5) * 34,
      0xffffff,
    );
  // Power corridor: a march of towers with wires, crossing stop 2.
  const s2 = map.stop(2);
  const towers: number[] = [];
  for (let k = -3; k <= 3; k += 1)
    towers.push(s2.x + k * 26, s2.y - 30 + k * 18);
  for (let i = 0; i + 3 < towers.length; i += 2)
    line(
      ctx,
      [
        towers[i] ?? 0,
        towers[i + 1] ?? 0,
        towers[i + 2] ?? 0,
        towers[i + 3] ?? 0,
      ],
      0x8ae6ff,
      0.5,
      0.8,
    );
  for (let i = 0; i < towers.length; i += 2) {
    const x = towers[i] ?? 0;
    const y = towers[i + 1] ?? 0;
    if (y < F.y + 4 || y > F.y + F.height - 4) continue;
    line(ctx, [x - 2.5, y + 3, x, y - 4, x + 2.5, y + 3], 0xb8c8e0, 0.7);
    line(ctx, [x - 3, y - 2, x + 3, y - 2], 0xb8c8e0, 0.6);
  }
  // Wetlands.
  const s3 = map.stop(3);
  [
    [-12, 6, 9, 5],
    [10, 10, 7, 4],
    [-2, -10, 6, 3.5],
    [14, -6, 5, 3],
  ].forEach(([dx, dy, rx, ry]) => {
    ellipse(ctx, s3.x + (dx ?? 0), s3.y + (dy ?? 0), rx ?? 4, ry ?? 3);
    ctx.fillStyle = css(0x2a7a7a, 0.9);
    ctx.fill();
    ctx.strokeStyle = css(0x5ab090, 0.8);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  });
  for (let i = 0; i < 24; i += 1) {
    const x = s3.x + (map.random() - 0.5) * 40;
    const y = s3.y + (map.random() - 0.5) * 30;
    line(ctx, [x, y, x + 0.6, y - 2.6], 0x6aa060, 0.5);
  }
  const lair = map.stop(4);
  ctx.strokeStyle = css(0x8ae6ff, 0.7);
  ctx.lineWidth = 0.6;
  ctx.setLineDash([1, 1]);
  ctx.strokeRect(lair.x - 16, lair.y - 14, 32, 26);
  ctx.setLineDash([]);
}

function milwaukieMap(map: MapContext): void {
  const { ctx, trail } = map;
  ctx.fillStyle = linear(ctx, 0, F.y, 0, F.y + F.height, [
    [0, 0x3c5a44],
    [1, 0x2e4838],
  ]);
  ctx.fillRect(F.x, F.y, F.width, F.height);
  noise(map, [0x4a6a50, 0x2a4030], 90, 7, 0.3);
  // The Willamette meanders down the map.
  const river = new Phaser.Curves.Spline([
    new Phaser.Math.Vector2(150, F.y - 4),
    new Phaser.Math.Vector2(102, 70),
    new Phaser.Math.Vector2(150, 118),
    new Phaser.Math.Vector2(112, 168),
    new Phaser.Math.Vector2(128, F.y + F.height + 4),
  ]);
  const riverPoints = river.getPoints(120);
  const flat: number[] = [];
  riverPoints.forEach((p) => flat.push(p.x, p.y));
  line(ctx, flat, 0x24525c, 26);
  line(ctx, flat, 0x2f7f98, 22);
  line(ctx, flat, 0x4aa6c0, 10, 0.5);
  for (let i = 0; i < 40; i += 1) {
    const p = riverPoints[Math.floor(map.random() * riverPoints.length)];
    if (!p) continue;
    line(
      ctx,
      [
        p.x - 3,
        p.y + (map.random() - 0.5) * 10,
        p.x + 3,
        p.y + (map.random() - 0.5) * 10,
      ],
      0xd8f6ff,
      0.4,
      0.5,
    );
  }
  // Plank bridges wherever the trail crosses the water.
  let span: Phaser.Math.Vector2[] = [];
  const bridge = () => {
    if (span.length > 1) {
      const deck: number[] = [];
      span.forEach((p) => deck.push(p.x, p.y));
      line(ctx, deck, 0x1e140c, 10);
      line(ctx, deck, 0x7a5a38, 8);
      for (let i = 0; i < span.length - 1; i += 1) {
        const a = span[i]!;
        const b = span[i + 1]!;
        const angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
        line(
          ctx,
          [
            a.x + Math.cos(angle) * 4,
            a.y + Math.sin(angle) * 4,
            a.x - Math.cos(angle) * 4,
            a.y - Math.sin(angle) * 4,
          ],
          0x4a3420,
          0.5,
        );
      }
    }
    span = [];
  };
  trail.samples.forEach((p) => {
    if (riverPoints.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < 14))
      span.push(p);
    else bridge();
  });
  bridge();
  // Flood spilling over the bank.
  const s1 = map.stop(1);
  ctx.fillStyle = radial(ctx, s1.x, s1.y, 2, 22, [
    [0, 0x2f7f98, 0.85],
    [1, 0x2f7f98, 0],
  ]);
  ctx.fillRect(s1.x - 22, s1.y - 22, 44, 44);
  // Riverbank trail: crumbling bluff hatching.
  const s2 = map.stop(2);
  for (let k = -5; k <= 5; k += 1)
    line(
      ctx,
      [s2.x + k * 3, s2.y - 12, s2.x + k * 3 + 2, s2.y - 8],
      0x7a6a50,
      0.8,
    );
  line(ctx, [s2.x - 16, s2.y - 12, s2.x + 16, s2.y - 12], 0x9a8a6a, 0.8);
  // Rail yard.
  const s3 = map.stop(3);
  for (let k = 0; k < 4; k += 1) {
    const y = s3.y - 18 + k * 4;
    line(ctx, [s3.x - 34, y, s3.x + 30, y], 0x8a8078, 0.5);
  }
  [
    [-28, -18, 0x9a4a2a],
    [-14, -14, 0x3a5a7a],
    [6, -10, 0xa07a2a],
    [18, -18, 0x5a3a2a],
  ].forEach(([dx, dy, color]) => {
    ctx.fillStyle = css(color ?? 0x888888);
    ctx.fillRect(s3.x + (dx ?? 0), s3.y + (dy ?? 0) - 1.4, 9, 2.8);
  });
  scatter(map, 200, 8, (x, y) => {
    if (riverPoints.some((r) => Math.hypot(r.x - x, r.y - y) < 15)) return;
    roundTree(
      ctx,
      x,
      y,
      3 + map.random() * 1.6,
      map.random() > 0.5 ? 0x4a7a4a : 0x3a6a42,
    );
  });
  noise(map, [0xe6f0ee], 12, 20, 0.08);
}

function wallaMap(map: MapContext): void {
  const { ctx } = map;
  ctx.fillStyle = css(0xb89048);
  ctx.fillRect(F.x, F.y, F.width, F.height);
  const patterns = ['wheat', 'wheat', 'vines', 'fallow', 'green'] as const;
  for (let gx = F.x - 10; gx < F.x + F.width; gx += 34)
    for (let gy = F.y - 8; gy < F.y + F.height; gy += 30) {
      const x = gx + map.random() * 6;
      const y = gy + map.random() * 6;
      const w = 30 + map.random() * 6;
      const h = 26 + map.random() * 4;
      const kind =
        patterns[Math.floor(map.random() * patterns.length)] ?? 'wheat';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const base = {
        wheat: 0xe0b450,
        vines: 0x7a9a48,
        fallow: 0x9a7048,
        green: 0x8aa858,
      }[kind];
      ctx.fillStyle = css(base);
      ctx.fillRect(x, y, w, h);
      const angle = map.random() > 0.5;
      for (let k = -40; k < 80; k += kind === 'vines' ? 3.4 : 2.2)
        line(
          ctx,
          angle
            ? [x + k, y, x + k - 20, y + h]
            : [x, y + k * 0.6, x + w, y + k * 0.6 - 6],
          kind === 'vines' ? 0x3a5a22 : 0x000000,
          kind === 'vines' ? 0.8 : 0.4,
          kind === 'vines' ? 0.9 : 0.12,
        );
      ctx.restore();
      ctx.strokeStyle = css(0x8a6a38, 0.8);
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
  // Dust storm swirl.
  const s1 = map.stop(1);
  for (let k = 0; k < 5; k += 1) {
    ctx.beginPath();
    ctx.ellipse(
      s1.x - 4,
      s1.y + 2,
      8 + k * 5,
      5 + k * 3.4,
      -0.3,
      k * 0.6,
      k * 0.6 + 4.4,
    );
    ctx.strokeStyle = css(0xf0dcb0, 0.55 - k * 0.08);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.fillStyle = radial(ctx, s1.x, s1.y, 0, 28, [
    [0, 0xe8cc98, 0.5],
    [1, 0xe8cc98, 0],
  ]);
  ctx.fillRect(s1.x - 28, s1.y - 28, 56, 56);
  // Vineyard maze, tight rows.
  const s3 = map.stop(3);
  ctx.save();
  ellipse(ctx, s3.x, s3.y, 26, 18);
  ctx.clip();
  ctx.fillStyle = css(0x6a8a3a);
  ctx.fillRect(s3.x - 26, s3.y - 18, 52, 36);
  for (let k = -30; k <= 30; k += 3) {
    ctx.setLineDash([1.4, 1]);
    line(ctx, [s3.x + k, s3.y - 18, s3.x + k + 4, s3.y + 18], 0x2a4416, 1);
  }
  ctx.setLineDash([]);
  ctx.restore();
  // Wind streaks.
  for (let i = 0; i < 16; i += 1) {
    const x = F.x + map.random() * F.width;
    const y = F.y + map.random() * F.height;
    line(ctx, [x, y, x - 12, y + 1.5], 0xfff4d8, 0.5, 0.45);
  }
  // The colossus' tree on its hill.
  const lair = map.stop(4);
  ellipse(ctx, lair.x, lair.y + 4, 26, 14);
  ctx.fillStyle = css(0x8a6a38, 0.6);
  ctx.fill();
  scatter(map, 40, 10, (x, y) => roundTree(ctx, x, y, 2.6, 0x4a6a30));
  ctx.fillStyle = css(0x7a2a1e);
  ctx.fillRect(F.x + 12, F.y + 10, 7, 5);
}

function bendMap(map: MapContext): void {
  const { ctx } = map;
  ctx.fillStyle = linear(ctx, F.x, F.y, F.x + F.width, F.y + F.height, [
    [0, 0x9a7a52],
    [1, 0x6a4a34],
  ]);
  ctx.fillRect(F.x, F.y, F.width, F.height);
  noise(map, [0xb08a5a, 0x7a5a3a, 0x5a3e2a], 120, 8, 0.3);
  // Desert canyon: a dark gash crossing stop 3.
  const s3 = map.stop(3);
  ctx.beginPath();
  ctx.moveTo(s3.x - 40, s3.y - 26);
  ctx.bezierCurveTo(
    s3.x - 10,
    s3.y - 8,
    s3.x - 6,
    s3.y + 10,
    s3.x + 30,
    s3.y + 30,
  );
  ctx.strokeStyle = css(0x3a2418);
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = css(0x1e120c);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = css(0xc89a6a, 0.6);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // Lava field.
  const s2 = map.stop(2);
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 8) {
    const r = 18 + Math.sin(a * 3) * 5 + map.random() * 4;
    ctx.lineTo(s2.x + Math.cos(a) * r, s2.y + Math.sin(a) * r * 0.75);
  }
  ctx.closePath();
  ctx.fillStyle = radial(ctx, s2.x, s2.y, 2, 22, [
    [0, 0x2a2024],
    [1, 0x18120f],
  ]);
  ctx.fill();
  for (let i = 0; i < 7; i += 1) {
    const a = map.random() * Math.PI * 2;
    const points = [s2.x, s2.y];
    let x = s2.x;
    let y = s2.y;
    for (let k = 0; k < 4; k += 1) {
      x += Math.cos(a + (map.random() - 0.5)) * 4;
      y += Math.sin(a + (map.random() - 0.5)) * 3;
      points.push(x, y);
    }
    glow(ctx, 0xff4a1c, 2, () => line(ctx, points, 0xff8a3d, 0.7));
  }
  // Wildfire smoke and embers.
  const s1 = map.stop(1);
  for (let i = 0; i < 8; i += 1) {
    ellipse(ctx, s1.x - 10 + i * 4, s1.y - 6 - i * 3, 8 + i, 5 + i * 0.6);
    ctx.fillStyle = css(0x4a4448, 0.22);
    ctx.fill();
  }
  for (let i = 0; i < 14; i += 1)
    caption(
      ctx,
      s1.x + (map.random() - 0.5) * 30,
      s1.y + (map.random() - 0.5) * 22,
      0xff8a3d,
    );
  // The volcano at the lair.
  const lair = map.stop(4);
  path(ctx, [
    lair.x - 26,
    lair.y + 14,
    lair.x - 5,
    lair.y - 16,
    lair.x + 5,
    lair.y - 16,
    lair.x + 26,
    lair.y + 14,
  ]);
  ctx.fillStyle = linear(ctx, lair.x - 20, 0, lair.x + 20, 0, [
    [0, 0x5a4850],
    [1, 0x241a1e],
  ]);
  ctx.fill();
  path(ctx, [
    lair.x - 11,
    lair.y - 4,
    lair.x - 5,
    lair.y - 16,
    lair.x + 5,
    lair.y - 16,
    lair.x + 11,
    lair.y - 4,
    lair.x + 4,
    lair.y - 7,
    lair.x,
    lair.y - 3,
    lair.x - 5,
    lair.y - 7,
  ]);
  ctx.fillStyle = css(0xeef2f6);
  ctx.fill();
  glow(ctx, 0xff5a2a, 4, () => {
    ellipse(ctx, lair.x, lair.y - 16, 5, 1.4);
    ctx.fillStyle = css(0xffb054);
    ctx.fill();
  });
  // Cinder cones and junipers.
  [
    [60, 50],
    [200, 180],
    [150, 46],
  ].forEach(([x, y]) => {
    if (map.clearance(x ?? 0, y ?? 0) < 10) return;
    path(ctx, [
      (x ?? 0) - 8,
      (y ?? 0) + 4,
      (x ?? 0) - 2,
      (y ?? 0) - 4,
      (x ?? 0) + 2,
      (y ?? 0) - 4,
      (x ?? 0) + 8,
      (y ?? 0) + 4,
    ]);
    ctx.fillStyle = css(0x6a3428);
    ctx.fill();
  });
  scatter(map, 220, 7, (x, y) => {
    if (map.random() > 0.35) {
      ellipse(ctx, x, y, 1.6, 1.1);
      ctx.fillStyle = css(0x7a8a68, 0.85);
      ctx.fill();
    } else roundTree(ctx, x, y, 2.4, 0x3a4a2a);
  });
}

const REGION_MAPS: Readonly<Record<BossLocationId, (map: MapContext) => void>> =
  {
    hillsboro_west: westMap,
    hillsboro_east: eastMap,
    milwaukie: milwaukieMap,
    walla_walla: wallaMap,
    bend: bendMap,
  };

const TRAIL_STYLE: Readonly<
  Record<BossLocationId, { edge: number; bed: number; mark: number }>
> = {
  hillsboro_west: { edge: 0x2a1c10, bed: 0x9a7a52, mark: 0xe0c890 },
  hillsboro_east: { edge: 0x0e1220, bed: 0x4a5060, mark: 0xe8c450 },
  milwaukie: { edge: 0x2a2418, bed: 0xa8987a, mark: 0xf0e6cc },
  walla_walla: { edge: 0x5a3e1c, bed: 0xd8bc88, mark: 0x8a6a38 },
  bend: { edge: 0x1e120c, bed: 0x5a2e24, mark: 0xff9a5a },
};

/** Paints a region's map with its winding trail; returns the texture key. */
export function paintJourneyMap(
  scene: Phaser.Scene,
  id: BossLocationId,
  trail: JourneyTrail,
): string {
  return paintTexture(scene, `journey-${id}`, 256, 240, (ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(F.x, F.y, F.width, F.height, 5);
    ctx.clip();
    const map: MapContext = {
      ctx,
      trail,
      random: seeded(id.length * 977 + id.charCodeAt(0)),
      clearance: (x, y) =>
        trail.samples.reduce(
          (best, p) => Math.min(best, Math.hypot(p.x - x, p.y - y)),
          Infinity,
        ),
      stop: (index) => trail.layout.stops[index] ?? { x: 0, y: 0 },
    };
    REGION_MAPS[id](map);
    const flat: number[] = [];
    trail.samples.forEach((p) => flat.push(p.x, p.y));
    const style = TRAIL_STYLE[id];
    line(
      ctx,
      flat.map((v, i) => v + (i % 2 ? 1.4 : 0.8)),
      0x000000,
      7,
      0.3,
    );
    line(ctx, flat, style.edge, 6.4);
    line(ctx, flat, style.bed, 4.4);
    ctx.setLineDash([2.4, 2.6]);
    line(ctx, flat, style.mark, 0.8, 0.85);
    ctx.setLineDash([]);
    // Vignette so the edges of the map fall into shadow.
    ctx.fillStyle = radial(ctx, 128, 110, 70, 170, [
      [0, 0x000000, 0],
      [1, 0x000000, 0.55],
    ]);
    ctx.fillRect(F.x, F.y, F.width, F.height);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(F.x, F.y, F.width, F.height, 5);
    ctx.strokeStyle = css(0x05080e);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(F.x + 1.6, F.y + 1.6, F.width - 3.2, F.height - 3.2, 4);
    ctx.strokeStyle = css(0xd9b76d, 0.8);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
}
