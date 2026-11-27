import Phaser from 'phaser';
import type { BossLocationId } from '../game/progression/bossLocations';
import {
  addParticles,
  ART_RESOLUTION,
  type Ctx,
  css,
  ellipse,
  ensureFxTextures,
  fillStroke,
  glow,
  line,
  linear,
  paintTexture,
  path,
  radial,
} from './painter';

type Role =
  'aura' | 'back' | 'armL' | 'armR' | 'body' | 'head' | 'eyes' | 'core';

interface PartSpec {
  readonly role: Role;
  /** Pivot position in rig space (rig origin = boss hitbox centre). */
  readonly x: number;
  readonly y: number;
  /** Painted bounds relative to the pivot. */
  readonly bounds: readonly [
    left: number,
    top: number,
    right: number,
    bottom: number,
  ];
  readonly draw: (ctx: Ctx) => void;
}

interface EmitterSpec {
  readonly x: number;
  readonly y: number;
  readonly config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
  readonly texture?: string;
}

interface RigSpec {
  readonly parts: readonly PartSpec[];
  readonly floats?: boolean;
  /** Distance from rig origin down to the ground, in rig units. */
  readonly footY: number;
  readonly shadowWidth: number;
  /** Arms hang this far outward at rest (radians). */
  readonly armSplay?: number;
  readonly armLength: number;
  /** The eye glow slides side to side, like a scanner. */
  readonly scan?: number;
  readonly glowColor: number;
  readonly emitters: readonly EmitterSpec[];
  readonly arcs?: number;
}

const DRAW_ORDER: readonly Role[] = [
  'aura',
  'back',
  'armL',
  'armR',
  'body',
  'head',
  'eyes',
  'core',
];

const INK = 0x07080c;

function aura(color: number, y: number, radius: number): PartSpec {
  return {
    role: 'aura',
    x: 0,
    y,
    bounds: [-radius, -radius, radius, radius],
    draw: (ctx) => {
      ctx.fillStyle = radial(ctx, 0, 0, 0, radius, [
        [0, color, 0.42],
        [0.45, color, 0.16],
        [1, color, 0],
      ]);
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    },
  };
}

function eyeGlow(
  x: number,
  y: number,
  bounds: PartSpec['bounds'],
  color: number,
  spots: readonly [number, number, number, number][],
): PartSpec {
  return {
    role: 'eyes',
    x,
    y,
    bounds,
    draw: (ctx) =>
      spots.forEach(([sx, sy, rx, ry]) => {
        ellipse(ctx, sx, sy, rx * 2.6, ry * 2.6);
        ctx.fillStyle = radial(ctx, sx, sy, 0, rx * 2.6, [
          [0, 0xffffff, 0.95],
          [0.25, color, 0.8],
          [1, color, 0],
        ]);
        ctx.fill();
      }),
  };
}

function coreGlow(
  y: number,
  bounds: PartSpec['bounds'],
  color: number,
  cx: number,
  cy: number,
  r: number,
): PartSpec {
  return {
    role: 'core',
    x: 0,
    y,
    bounds,
    draw: (ctx) => {
      ctx.fillStyle = radial(ctx, cx, cy, 0, r, [
        [0, 0xffffff, 0.75],
        [0.3, color, 0.55],
        [1, color, 0],
      ]);
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    },
  };
}

function rivets(ctx: Ctx, points: readonly number[], color = 0xc9d1d6): void {
  for (let i = 0; i < points.length; i += 2) {
    ellipse(ctx, points[i] ?? 0, points[i + 1] ?? 0, 0.7, 0.7);
    ctx.fillStyle = css(color);
    ctx.fill();
  }
}

function crack(ctx: Ctx, points: readonly number[]): void {
  glow(ctx, 0xff4a1c, 3, () => line(ctx, points, 0xff6a2a, 1.3));
  line(ctx, points, 0xffe08a, 0.45);
}

/* ---------------------------------------------------------------- */
/* Hillsboro West: a fab-floor war machine of the Silicon Forest.   */
/* ---------------------------------------------------------------- */
function siliconSentinel(): RigSpec {
  const steel = (ctx: Ctx, y0: number, y1: number) =>
    linear(ctx, 0, y0, 0, y1, [
      [0, 0x7d8999],
      [0.4, 0x46505e],
      [1, 0x171b22],
    ]);
  const gold = (ctx: Ctx, y0: number, y1: number) =>
    linear(ctx, 0, y0, 0, y1, [
      [0, 0xffe39a],
      [0.5, 0xf0b84c],
      [1, 0x8a5a1a],
    ]);
  const arm = (cannon: boolean) => (ctx: Ctx) => {
    ctx.beginPath();
    ctx.roundRect(-5, -2, 10, 14, 3);
    fillStroke(ctx, steel(ctx, -2, 12), INK, 1);
    ellipse(ctx, 0, 13, 4.2, 4.2);
    fillStroke(ctx, css(0x22272f), 0xf0b84c, 0.9);
    path(ctx, [-7, 15, 7, 15, 8, 29, -8, 29]);
    fillStroke(ctx, steel(ctx, 15, 29), INK, 1.1);
    ctx.fillStyle = gold(ctx, 19, 22);
    ctx.fillRect(-7.4, 19, 14.8, 2.6);
    line(ctx, [-6, 16, -6.8, 27], 0xaab6c4, 0.5, 0.7);
    if (cannon) {
      ctx.beginPath();
      ctx.roundRect(-5.5, 28, 11, 7, 1.2);
      fillStroke(ctx, css(0x15181d), INK, 1);
      ellipse(ctx, 0, 35, 5, 1.9);
      fillStroke(ctx, gold(ctx, 33, 37), INK, 0.6);
      glow(ctx, 0xff5a3c, 4, () => {
        ellipse(ctx, 0, 35, 3, 1);
        ctx.fillStyle = css(0xffc08a);
        ctx.fill();
      });
    } else {
      [-6, 0, 6].forEach((x) => {
        path(ctx, [
          x - 2.2,
          28,
          x + 2.2,
          28,
          x + 0.8 * Math.sign(x),
          37,
          x - 0.4,
          33,
        ]);
        fillStroke(
          ctx,
          linear(ctx, 0, 28, 0, 37, [
            [0, 0xe8eef2],
            [1, 0x6d7782],
          ]),
          INK,
          0.7,
        );
      });
    }
  };
  return {
    footY: 32,
    shadowWidth: 54,
    armLength: 34,
    scan: 4.5,
    glowColor: 0xff5a3c,
    parts: [
      aura(0xf0b84c, -14, 52),
      {
        role: 'back',
        x: 0,
        y: -30,
        bounds: [-26, -26, 26, 6],
        draw: (ctx) =>
          [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.roundRect(s * 15 - 4, -22, 8, 24, 1.5);
            fillStroke(ctx, steel(ctx, -22, 2), INK, 1);
            [-18, -13, -8].forEach((y) =>
              line(ctx, [s * 15 - 4, y, s * 15 + 4, y], 0x0d1014, 0.7),
            );
            glow(ctx, 0xff7a3c, 3, () => {
              ellipse(ctx, s * 15, -22, 3.4, 1.4);
              ctx.fillStyle = css(0xffb070);
              ctx.fill();
            });
          }),
      },
      {
        role: 'armL',
        x: -27,
        y: -28,
        bounds: [-10, -4, 10, 40],
        draw: arm(false),
      },
      {
        role: 'armR',
        x: 27,
        y: -28,
        bounds: [-10, -4, 10, 40],
        draw: arm(true),
      },
      {
        role: 'body',
        x: 0,
        y: 0,
        bounds: [-38, -40, 38, 34],
        draw: (ctx) => {
          [-1, 1].forEach((s) => {
            path(ctx, [
              s * 5,
              0,
              s * 18,
              0,
              s * 20,
              14,
              s * 17,
              27,
              s * 6,
              27,
              s * 5,
              14,
            ]);
            fillStroke(ctx, steel(ctx, 0, 27), INK, 1.2);
            path(ctx, [s * 7, 10, s * 19, 10, s * 18, 17, s * 8, 17]);
            fillStroke(ctx, gold(ctx, 10, 17), INK, 0.8);
            path(ctx, [s * 2, 26, s * 21, 26, s * 25, 32, s * 1, 32]);
            fillStroke(ctx, steel(ctx, 26, 32), INK, 1.2);
          });
          path(ctx, [-17, -6, 17, -6, 13, 5, -13, 5]);
          fillStroke(ctx, steel(ctx, -6, 5), INK, 1.2);
          path(ctx, [-29, -35, 29, -35, 25, -15, 15, -2, -15, -2, -25, -15]);
          fillStroke(
            ctx,
            linear(ctx, 0, -35, 0, -2, [
              [0, 0x8692a2],
              [0.3, 0x4d5767],
              [1, 0x1a2029],
            ]),
            INK,
            1.4,
          );
          path(ctx, [12, -35, 29, -35, 25, -15, 15, -2, 8, -2]);
          ctx.fillStyle = css(0x000000, 0.28);
          ctx.fill();
          line(ctx, [-27, -34, 27, -34], 0xc0ccd8, 0.6, 0.9);
          // Gold circuit traces running out from the wafer.
          [
            [-8, -21, -14, -27, -24, -27],
            [8, -21, 14, -27, 24, -27],
            [-8, -16, -19, -16, -22, -12],
            [8, -16, 19, -16, 22, -12],
          ].forEach((trace) => {
            line(ctx, trace, 0xf0b84c, 0.7, 0.85);
            ellipse(ctx, trace[4] ?? 0, trace[5] ?? 0, 1, 1);
            ctx.fillStyle = css(0xffe39a);
            ctx.fill();
          });
          glow(ctx, 0x8af2ff, 4, () => {
            ellipse(ctx, 0, -19, 9, 9);
            ctx.fillStyle = radial(ctx, -2.5, -21.5, 0.5, 9.5, [
              [0, 0xf0feff],
              [0.3, 0x7fd8ff],
              [0.65, 0x6a5cff],
              [1, 0x221d48],
            ]);
            ctx.fill();
          });
          ctx.save();
          ellipse(ctx, 0, -19, 9, 9);
          ctx.clip();
          for (let i = -9; i <= 9; i += 2.3) {
            line(ctx, [i, -28, i, -10], 0x0d1020, 0.3, 0.5);
            line(ctx, [-9, -19 + i, 9, -19 + i], 0x0d1020, 0.3, 0.5);
          }
          ctx.restore();
          ellipse(ctx, 0, -19, 9.6, 9.6);
          ctx.strokeStyle = css(0xf0b84c);
          ctx.lineWidth = 1.3;
          ctx.stroke();
          [0, 1, 2].forEach((i) => {
            ctx.beginPath();
            ctx.roundRect(-9, -8.5 + i * 2.4, 18, 1.3, 0.6);
            ctx.fillStyle = css(0x0b0d11);
            ctx.fill();
          });
          [-1, 1].forEach((s) => {
            path(ctx, [
              s * 15,
              -37,
              s * 34,
              -34,
              s * 37,
              -24,
              s * 31,
              -18,
              s * 18,
              -25,
            ]);
            fillStroke(ctx, gold(ctx, -37, -18), INK, 1.2);
            ctx.save();
            path(ctx, [
              s * 15,
              -37,
              s * 34,
              -34,
              s * 37,
              -24,
              s * 31,
              -18,
              s * 18,
              -25,
            ]);
            ctx.clip();
            for (let k = -60; k < 60; k += 5)
              line(ctx, [k, -40, k + 14, -14], 0x1a1206, 1.6, 0.75);
            ctx.restore();
            rivets(ctx, [s * 31, -31, s * 22, -32]);
          });
        },
      },
      {
        role: 'head',
        x: 0,
        y: -34,
        bounds: [-15, -28, 15, 3],
        draw: (ctx) => {
          line(ctx, [7, -18, 12, -25], 0x56606c, 1.2);
          glow(ctx, 0xff3a2a, 3, () => {
            ellipse(ctx, 12, -25, 1.4, 1.4);
            ctx.fillStyle = css(0xff6a4a);
            ctx.fill();
          });
          path(ctx, [-11, 0, -13, -12, -7, -20, 7, -20, 13, -12, 11, 0]);
          fillStroke(ctx, steel(ctx, -20, 0), INK, 1.3);
          path(ctx, [-13, -12, 13, -12, 11, -9, -11, -9]);
          fillStroke(ctx, css(0xf0b84c), INK, 0.6);
          ctx.beginPath();
          ctx.roundRect(-10, -8, 20, 4.4, 1.6);
          ctx.fillStyle = css(0x120404);
          ctx.fill();
          [-4, 0, 4].forEach((x) => line(ctx, [x, -2.5, x, 0], 0x0d1014, 0.8));
        },
      },
      eyeGlow(0, -34, [-15, -28, 15, 3], 0xff4a2a, [[0, -5.8, 2.6, 1.3]]),
      coreGlow(0, [-38, -40, 38, 34], 0x7fd8ff, 0, -19, 15),
    ],
    emitters: [-1, 1].map((s) => ({
      x: s * 15,
      y: -54,
      config: {
        speedY: { min: -38, max: -16 },
        speedX: { min: -6, max: 6 },
        lifespan: 750,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd27a, 0xff7a3c, 0xff4a2a],
        frequency: 110,
        blendMode: 'ADD',
      },
      texture: 'fx-spark',
    })),
  };
}

/* ---------------------------------------------------------------- */
/* Hillsboro East: a hooded wraith living in the transmission lines. */
/* ---------------------------------------------------------------- */
function circuitWarden(): RigSpec {
  const steel = (ctx: Ctx, y0: number, y1: number) =>
    linear(ctx, 0, y0, 0, y1, [
      [0, 0x9cb4d4],
      [0.5, 0x4c6286],
      [1, 0x1b2640],
    ]);
  const arm = (ctx: Ctx) => {
    line(ctx, [-1.2, 0, -1.2, 22], 0x0b1222, 3.6);
    line(ctx, [-1.2, 0, -1.2, 22], 0x6d86ad, 1.6);
    line(ctx, [-1.8, 0, -1.8, 22], 0xc4d6ee, 0.5);
    [6, 14].forEach((y) => {
      ellipse(ctx, -1.2, y, 2.6, 1.3);
      fillStroke(ctx, css(0xcfe3ea), INK, 0.5);
    });
    for (let y = 22; y <= 30; y += 1.6) {
      ellipse(ctx, -1.2, y, 3.2, 1);
      fillStroke(
        ctx,
        linear(ctx, -4, 0, 2, 0, [
          [0, 0xf3b26a],
          [1, 0x7a4417],
        ]),
        0x3a1f0a,
        0.35,
      );
    }
    glow(ctx, 0x6ee6ff, 6, () => {
      ellipse(ctx, -1.2, 33.5, 3.6, 3.6);
      ctx.fillStyle = radial(ctx, -2, 32.5, 0.3, 3.6, [
        [0, 0xffffff],
        [0.5, 0x9ff3ff],
        [1, 0x2a8bc0],
      ]);
      ctx.fill();
    });
  };
  return {
    floats: true,
    footY: 36,
    shadowWidth: 40,
    armSplay: 0.22,
    armLength: 34,
    glowColor: 0x6ee6ff,
    arcs: 0x9ff3ff,
    parts: [
      aura(0x55c8ef, -10, 54),
      {
        role: 'back',
        x: 0,
        y: 0,
        bounds: [-32, -34, 32, 40],
        draw: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(-18, -28);
          ctx.quadraticCurveTo(-32, 4, -24, 32);
          const hem = [
            -24, 32, -18, 26, -14, 38, -8, 28, -3, 39, 2, 29, 7, 38, 12, 27, 17,
            36, 24, 30,
          ];
          for (let i = 2; i < hem.length; i += 2)
            ctx.lineTo(hem[i] ?? 0, hem[i + 1] ?? 0);
          ctx.quadraticCurveTo(32, 4, 18, -28);
          ctx.closePath();
          ctx.fillStyle = linear(ctx, 0, -28, 0, 38, [
            [0, 0x2a4078],
            [0.6, 0x15224a, 0.85],
            [1, 0x0b1430, 0.2],
          ]);
          ctx.fill();
          [-14, -6, 4, 12].forEach((x, i) =>
            glow(ctx, 0x6ee6ff, 2, () =>
              line(
                ctx,
                [x * 0.6, -20, x * 0.9 + (i % 2 ? 2 : -2), 4, x, 30],
                0x6ee6ff,
                0.5,
                0.55,
              ),
            ),
          );
        },
      },
      { role: 'armL', x: -27, y: -29, bounds: [-7, -3, 5, 39], draw: arm },
      { role: 'armR', x: 27, y: -29, bounds: [-7, -3, 5, 39], draw: arm },
      {
        role: 'body',
        x: 0,
        y: 0,
        bounds: [-35, -36, 35, 10],
        draw: (ctx) => {
          path(ctx, [-17, -28, 17, -28, 6, 6, -6, 6]);
          ctx.fillStyle = css(0x111a30);
          ctx.fill();
          const half = (y: number) => 17 - ((y + 28) / 34) * 11;
          const levels = [-28, -17, -6, 6];
          levels.slice(0, -1).forEach((y, i) => {
            const y2 = levels[i + 1] ?? 6;
            line(ctx, [-half(y), y, half(y2), y2], 0x7f9bc2, 0.7);
            line(ctx, [half(y), y, -half(y2), y2], 0x7f9bc2, 0.7);
            line(ctx, [-half(y2), y2, half(y2), y2], 0x7f9bc2, 0.7);
          });
          path(ctx, [-17, -28, -6, 6], false);
          ctx.strokeStyle = css(0xb7cbe6);
          ctx.lineWidth = 1.4;
          ctx.stroke();
          path(ctx, [17, -28, 6, 6], false);
          ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(-33, -32, 66, 3.6, 1);
          fillStroke(ctx, steel(ctx, -32, -28), INK, 0.9);
          [-30, -22, 22, 30].forEach((x) => {
            line(ctx, [x, -28.5, x, -26], 0x3a4a66, 0.6);
            [0, 1, 2].forEach((k) => {
              ellipse(ctx, x, -25 + k * 1.9, 2.1, 0.9);
              fillStroke(
                ctx,
                linear(ctx, x - 2, 0, x + 2, 0, [
                  [0, 0xf2fbff],
                  [1, 0x8fa8b4],
                ]),
                0x2a3a48,
                0.3,
              );
            });
          });
          glow(ctx, 0x6ee6ff, 6, () => {
            path(ctx, [0, -22, 5.5, -14, 0, -5, -5.5, -14]);
            ctx.fillStyle = radial(ctx, 0, -14, 0.5, 7, [
              [0, 0xffffff],
              [0.45, 0x9ff3ff],
              [1, 0x2a8bc0],
            ]);
            ctx.fill();
          });
        },
      },
      {
        role: 'head',
        x: 0,
        y: -31,
        bounds: [-13, -38, 13, 3],
        draw: (ctx) => {
          [-5, 0, 5].forEach((x) => {
            const top = x === 0 ? -36 : -31;
            line(ctx, [x * 0.6, -25, x, top], 0x8aa6c8, 0.9);
            glow(ctx, 0xffe369, 3, () => {
              ellipse(ctx, x, top, 1.1, 1.1);
              ctx.fillStyle = css(0xfff3a8);
              ctx.fill();
            });
          });
          path(ctx, [0, -28, 9, -18, 11, -4, 6, 1, -6, 1, -11, -4, -9, -18]);
          fillStroke(
            ctx,
            linear(ctx, 0, -28, 0, 1, [
              [0, 0x3c5794],
              [1, 0x0e1630],
            ]),
            INK,
            1.1,
          );
          ellipse(ctx, 0, -8, 6, 6.6);
          ctx.fillStyle = css(0x03050b);
          ctx.fill();
          [-1, 1].forEach((s) => {
            path(ctx, [
              s * 5.2,
              -10.4,
              s * 1.4,
              -8.4,
              s * 1.8,
              -7,
              s * 5.4,
              -8.6,
            ]);
            ctx.fillStyle = css(0xd8fbff);
            ctx.fill();
          });
        },
      },
      eyeGlow(0, -31, [-13, -38, 13, 3], 0x6ee6ff, [
        [-3.4, -8.6, 2, 1.1],
        [3.4, -8.6, 2, 1.1],
      ]),
      coreGlow(0, [-35, -36, 35, 10], 0x6ee6ff, 0, -14, 14),
    ],
    emitters: [
      {
        x: 0,
        y: -14,
        config: {
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(-34, -34, 68, 64),
          } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          speed: { min: 10, max: 40 },
          lifespan: 260,
          scale: { start: 0.55, end: 0 },
          tint: [0xffffff, 0x9ff3ff, 0xffe369],
          frequency: 70,
          blendMode: 'ADD',
        },
        texture: 'fx-spark',
      },
    ],
  };
}

/* ---------------------------------------------------------------- */
/* Milwaukie: river water held together by old bridge steel.        */
/* ---------------------------------------------------------------- */
function riverforgedGuardian(): RigSpec {
  const iron = (ctx: Ctx, y0: number, y1: number) =>
    linear(ctx, 0, y0, 0, y1, [
      [0, 0x8a9ca2],
      [0.45, 0x4a5d63],
      [1, 0x1b2629],
    ]);
  const rust = (ctx: Ctx, y0: number, y1: number) =>
    linear(ctx, 0, y0, 0, y1, [
      [0, 0xc8784a],
      [0.5, 0x8a4b2a],
      [1, 0x4a2414],
    ]);
  return {
    footY: 31,
    shadowWidth: 60,
    armLength: 36,
    glowColor: 0x5be0ee,
    parts: [
      aura(0x3dc4df, -12, 56),
      {
        role: 'armL',
        x: -31,
        y: -30,
        bounds: [-10, -4, 10, 42],
        draw: (ctx) => {
          for (let y = 0; y < 24; y += 4.2) {
            const vertical = Math.round(y / 4.2) % 2 === 0;
            ellipse(ctx, 0, y + 2, vertical ? 2.2 : 1.1, 3);
            ctx.strokeStyle = css(0x0e1416);
            ctx.lineWidth = 2.4;
            ctx.stroke();
            ctx.strokeStyle = css(vertical ? 0x7d8f95 : 0x5a6a70);
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
          line(ctx, [0, 25, 0, 36], 0x0e1416, 3.6);
          line(ctx, [0, 25, 0, 36], 0x6b7d83, 2);
          line(ctx, [-5, 28, 5, 28], 0x0e1416, 2.6);
          line(ctx, [-5, 28, 5, 28], 0x7d8f95, 1.3);
          ctx.beginPath();
          ctx.arc(0, 31, 7.5, 0.25, Math.PI - 0.25);
          ctx.strokeStyle = css(0x0e1416);
          ctx.lineWidth = 3.4;
          ctx.stroke();
          ctx.strokeStyle = css(0x7d8f95);
          ctx.lineWidth = 1.8;
          ctx.stroke();
          [-1, 1].forEach((s) => {
            path(ctx, [s * 7.6, 32, s * 9.6, 33.5, s * 6.4, 36.8]);
            fillStroke(ctx, css(0x9fb0b5), 0x0e1416, 0.6);
          });
        },
      },
      {
        role: 'armR',
        x: 31,
        y: -30,
        bounds: [-11, -4, 11, 42],
        draw: (ctx) => {
          ctx.beginPath();
          ctx.rect(-2, 0, 4, 22);
          fillStroke(ctx, iron(ctx, 0, 22), INK, 0.9);
          [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.rect(s > 0 ? 2 : -6, 0, 4, 22);
            fillStroke(ctx, rust(ctx, 0, 22), INK, 0.9);
          });
          for (let y = 3; y < 22; y += 4) rivets(ctx, [-4, y, 4, y]);
          ctx.beginPath();
          ctx.roundRect(-9, 21, 18, 14, 3.5);
          fillStroke(ctx, iron(ctx, 21, 35), INK, 1.3);
          [-5, 0, 5].forEach((x) => line(ctx, [x, 25, x, 34], 0x1b2629, 0.8));
          line(ctx, [-8, 23, 8, 23], 0xb8c8cc, 0.6, 0.8);
          [-6, 2, 7].forEach((x, i) => {
            line(ctx, [x, 35, x + 0.4, 38 + i * 1.5], 0x5be0ee, 0.9, 0.75);
          });
        },
      },
      {
        role: 'body',
        x: 0,
        y: 0,
        bounds: [-40, -44, 40, 36],
        draw: (ctx) => {
          [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.roundRect(s * 12 - 6.5, 0, 13, 28, 2);
            fillStroke(
              ctx,
              linear(ctx, s * 12 - 6.5, 0, s * 12 + 6.5, 0, [
                [0, 0xa8b0b4],
                [0.5, 0x737b80],
                [1, 0x3c4246],
              ]),
              INK,
              1.2,
            );
            line(
              ctx,
              [s * 12 - 2, 6, s * 12 + 1, 12, s * 12 - 1, 18],
              0x2c3236,
              0.6,
            );
            ellipse(ctx, s * 12, 29, 11, 3.2);
            ctx.fillStyle = css(0x2fa7c4, 0.9);
            ctx.fill();
            ellipse(ctx, s * 12, 28.4, 9, 2);
            ctx.strokeStyle = css(0xe6fbff, 0.85);
            ctx.lineWidth = 0.8;
            ctx.stroke();
          });
          ctx.beginPath();
          ctx.moveTo(-29, -32);
          ctx.bezierCurveTo(-36, -14, -26, 2, -14, 6);
          ctx.lineTo(14, 6);
          ctx.bezierCurveTo(26, 2, 36, -14, 29, -32);
          ctx.quadraticCurveTo(0, -40, -29, -32);
          ctx.closePath();
          fillStroke(
            ctx,
            linear(ctx, 0, -38, 0, 6, [
              [0, 0x6fe3f5],
              [0.35, 0x2a8ea8],
              [1, 0x0b2f3d],
            ]),
            INK,
            1.4,
          );
          ctx.save();
          ctx.clip();
          for (let k = 0; k < 7; k += 1) {
            const y = -30 + k * 5;
            ctx.beginPath();
            ctx.moveTo(-32, y);
            for (let x = -32; x <= 32; x += 4)
              ctx.lineTo(x, y + Math.sin(x * 0.35 + k) * 1.4);
            ctx.strokeStyle = css(0xc9f8ff, 0.35);
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
          [-22, -11, 0].forEach((y) => {
            ctx.beginPath();
            ctx.moveTo(-34, y + 3);
            ctx.quadraticCurveTo(0, y - 4, 34, y + 3);
            ctx.strokeStyle = css(0x121a1c);
            ctx.lineWidth = 3.6;
            ctx.stroke();
            ctx.strokeStyle = css(0x56686e);
            ctx.lineWidth = 2.2;
            ctx.stroke();
            for (let x = -24; x <= 24; x += 8)
              rivets(ctx, [x, y + 3 - 7 * (1 - (x / 34) ** 2) * 0.5]);
          });
          ctx.beginPath();
          ctx.rect(-2.5, -36, 5, 44);
          ctx.fillStyle = iron(ctx, -36, 8);
          ctx.fill();
          ctx.restore();
          [-1, 1].forEach((s) => {
            const pts = [s * 12, -41, s * 38, -35, s * 36, -22, s * 15, -27];
            path(ctx, pts);
            fillStroke(ctx, rust(ctx, -41, -22), INK, 1.2);
            line(
              ctx,
              [s * 15, -39, s * 24, -25, s * 26, -38, s * 35, -24],
              0xe0a070,
              0.6,
              0.7,
            );
            rivets(
              ctx,
              [s * 15, -38, s * 22, -37, s * 30, -36, s * 35, -27],
              0xf0c8a0,
            );
          });
        },
      },
      {
        role: 'head',
        x: 0,
        y: -31,
        bounds: [-13, -21, 13, 5],
        draw: (ctx) => {
          ellipse(ctx, 0, -8, 10.5, 10);
          fillStroke(
            ctx,
            radial(ctx, -3, -12, 1, 12, [
              [0, 0x9aaeb2],
              [0.6, 0x45585d],
              [1, 0x1a2427],
            ]),
            INK,
            1.3,
          );
          ellipse(ctx, 0, 1.5, 11, 3);
          fillStroke(ctx, css(0xc99a4a), INK, 0.9);
          [-1, 1].forEach((s) => {
            ellipse(ctx, s * 8.4, -7, 2, 2.4);
            fillStroke(ctx, css(0x0b2a33), 0xc99a4a, 0.9);
          });
          ellipse(ctx, 0, -7.5, 5.6, 5.6);
          fillStroke(
            ctx,
            radial(ctx, 0, -7.5, 0.5, 5.6, [
              [0, 0x0f4f5c],
              [1, 0x03161b],
            ]),
            0xd9a95a,
            1.6,
          );
          line(ctx, [-4.5, -7.5, 4.5, -7.5], 0xd9a95a, 0.5, 0.8);
          line(ctx, [0, -12, 0, -3], 0xd9a95a, 0.5, 0.8);
          rivets(ctx, [-7, -14, -3, -16.5, 3, -16.5, 7, -14], 0xe0c890);
          [-1, 1].forEach((s) => {
            ellipse(ctx, s * 2.2, -8, 1.2, 0.8);
            ctx.fillStyle = css(0xd8ffff);
            ctx.fill();
          });
        },
      },
      eyeGlow(0, -31, [-13, -21, 13, 5], 0x5be0ee, [
        [-2.2, -8, 1.6, 1.1],
        [2.2, -8, 1.6, 1.1],
      ]),
      coreGlow(0, [-40, -44, 40, 36], 0x5be0ee, 0, -16, 14),
    ],
    emitters: [
      {
        x: 0,
        y: 4,
        config: {
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(-26, -6, 52, 6),
          } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          speedY: { min: 10, max: 30 },
          gravityY: 140,
          lifespan: 500,
          scale: { start: 0.5, end: 0.2 },
          alpha: { start: 0.9, end: 0 },
          tint: [0x9ff3ff, 0x5be0ee, 0xffffff],
          frequency: 90,
          blendMode: 'ADD',
        },
        texture: 'fx-spark',
      },
      {
        x: 0,
        y: 30,
        config: {
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(-30, -2, 60, 4),
          } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          speedX: { min: -8, max: 8 },
          speedY: { min: -6, max: -2 },
          lifespan: 1600,
          scale: { start: 0.6, end: 1.6 },
          alpha: { start: 0.22, end: 0 },
          tint: 0xd8f6ff,
          frequency: 160,
        },
        texture: 'fx-soft',
      },
    ],
  };
}

/* ---------------------------------------------------------------- */
/* Walla Walla: an old vine that grew a will of its own.            */
/* ---------------------------------------------------------------- */
function vineyardColossus(): RigSpec {
  const bark = (ctx: Ctx, x0: number, x1: number) =>
    linear(ctx, x0, 0, x1, 0, [
      [0, 0x2d1f18],
      [0.35, 0x6b4a36],
      [0.6, 0x5b3c2d],
      [1, 0x231711],
    ]);
  const leaf = (
    ctx: Ctx,
    x: number,
    y: number,
    size: number,
    angle: number,
    color: number,
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      -size * 0.9,
      -size * 0.2,
      -size * 0.8,
      -size * 1.1,
      -size * 0.3,
      -size * 0.9,
    );
    ctx.quadraticCurveTo(0, -size * 1.5, size * 0.3, -size * 0.9);
    ctx.bezierCurveTo(size * 0.8, -size * 1.1, size * 0.9, -size * 0.2, 0, 0);
    fillStroke(
      ctx,
      linear(ctx, 0, -size * 1.3, 0, 0, [
        [0, color],
        [1, 0x1f3a19],
      ]),
      0x14240f,
      0.6,
    );
    line(ctx, [0, 0, 0, -size * 1.1], 0xb8e08a, 0.35, 0.6);
    line(ctx, [0, -size * 0.4, -size * 0.5, -size * 0.8], 0xb8e08a, 0.3, 0.5);
    line(ctx, [0, -size * 0.4, size * 0.5, -size * 0.8], 0xb8e08a, 0.3, 0.5);
    ctx.restore();
  };
  const grapes = (ctx: Ctx, x: number, y: number) => {
    const spots = [
      0, 0, -1.6, 1.4, 1.6, 1.4, 0, 2.8, -0.8, 4.2, 0.8, 4.2, 0, 5.6, -2.6, 0.2,
      2.6, 0.2,
    ];
    for (let i = 0; i < spots.length; i += 2) {
      ellipse(ctx, x + (spots[i] ?? 0), y + (spots[i + 1] ?? 0), 1.25, 1.25);
      ctx.fillStyle = radial(
        ctx,
        x + (spots[i] ?? 0) - 0.4,
        y + (spots[i + 1] ?? 0) - 0.4,
        0.1,
        1.4,
        [
          [0, 0xc77dc0],
          [0.5, 0x7e3f78],
          [1, 0x3a1638],
        ],
      );
      ctx.fill();
    }
  };
  const arm = (s: number) => (ctx: Ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 9, 8, s * 9, 18, s * 3, 28);
    ctx.strokeStyle = css(0x1a110c);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = bark(ctx, -4, 4);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = css(0x9a7458, 0.7);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    [-1, 0, 1].forEach((k) => {
      ctx.beginPath();
      ctx.moveTo(s * 3, 27);
      ctx.quadraticCurveTo(s * 3 + k * 5, 33, s * 3 + k * 6 - s * 2, 37);
      ctx.strokeStyle = css(0x1a110c);
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.strokeStyle = css(0x6b4a36);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(s * 7, 12);
    ctx.bezierCurveTo(s * 14, 10, s * 14, 4, s * 11, 4);
    ctx.strokeStyle = css(0x6e9b45);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    leaf(ctx, s * 8, 18, 4.5, s * 1.2, 0x6e9b45);
    grapes(ctx, s * 5, 8);
  };
  return {
    footY: 31,
    shadowWidth: 66,
    armLength: 36,
    armSplay: 0.1,
    glowColor: 0xffc94a,
    parts: [
      aura(0x7de06f, -16, 58),
      {
        role: 'back',
        x: 0,
        y: -30,
        bounds: [-34, -24, 34, 8],
        draw: (ctx) =>
          [-1, 1].forEach((s) => {
            for (let k = 0; k < 5; k += 1) {
              const bx = s * (12 + k * 3.5);
              const tx = s * (18 + k * 4);
              const ty = -14 - (k % 2) * 6 - k;
              line(ctx, [bx, 2, tx, ty], 0xb08a3a, 0.6);
              ellipse(ctx, tx, ty - 1.6, 1, 2.6, s * 0.3);
              ctx.fillStyle = linear(ctx, 0, ty - 4, 0, ty + 1, [
                [0, 0xfff0a0],
                [1, 0xc89a3a],
              ]);
              ctx.fill();
            }
          }),
      },
      {
        role: 'armL',
        x: -20,
        y: -29,
        bounds: [-16, -5, 14, 41],
        draw: arm(-1),
      },
      { role: 'armR', x: 20, y: -29, bounds: [-14, -5, 16, 41], draw: arm(1) },
      {
        role: 'body',
        x: 0,
        y: 0,
        bounds: [-38, -40, 38, 34],
        draw: (ctx) => {
          [
            [-6, -34, 20, -16, 31],
            [-4, -20, 30, -30, 30],
            [-3, -8, 31, -10, 33],
            [6, 34, 20, 16, 31],
            [4, 20, 30, 30, 30],
            [3, 8, 31, 10, 33],
          ].forEach(([sx, cx, cy, ex, ey]) => {
            ctx.beginPath();
            ctx.moveTo(sx ?? 0, 10);
            ctx.quadraticCurveTo(cx ?? 0, cy ?? 0, ex ?? 0, ey ?? 0);
            ctx.strokeStyle = css(0x1a110c);
            ctx.lineWidth = 3.8;
            ctx.stroke();
            ctx.strokeStyle = css(0x5b3c2d);
            ctx.lineWidth = 2.2;
            ctx.stroke();
          });
          ctx.beginPath();
          ctx.moveTo(-11, 14);
          ctx.bezierCurveTo(-16, 0, -14, -14, -27, -30);
          ctx.quadraticCurveTo(-20, -38, -8, -34);
          ctx.quadraticCurveTo(0, -38, 8, -34);
          ctx.quadraticCurveTo(20, -38, 27, -30);
          ctx.bezierCurveTo(14, -14, 16, 0, 11, 14);
          ctx.closePath();
          fillStroke(ctx, bark(ctx, -24, 24), 0x120b08, 1.4);
          ctx.save();
          ctx.clip();
          for (let k = -4; k <= 4; k += 1) {
            ctx.beginPath();
            ctx.moveTo(k * 6 - 10, 16);
            ctx.bezierCurveTo(k * 6 + 10, 0, k * 6 - 12, -16, k * 6 + 8, -38);
            ctx.strokeStyle = css(
              k % 2 ? 0x1f140f : 0x8a6448,
              k % 2 ? 0.8 : 0.45,
            );
            ctx.lineWidth = k % 2 ? 1.6 : 0.7;
            ctx.stroke();
          }
          ctx.restore();
          line(ctx, [-26, -24, 26, -24], 0xb8c0c4, 0.4, 0.55);
          line(ctx, [-20, -10, 20, -10], 0xb8c0c4, 0.4, 0.55);
          ellipse(ctx, 0, -17, 4.6, 6);
          fillStroke(ctx, css(0x0c0604), 0x2d1f18, 1);
          glow(ctx, 0xffa830, 5, () => {
            ellipse(ctx, 0, -16.5, 2.4, 3.6);
            ctx.fillStyle = radial(ctx, 0, -16.5, 0.2, 3.6, [
              [0, 0xffffff],
              [0.4, 0xffd36a],
              [1, 0xc8641a],
            ]);
            ctx.fill();
          });
          grapes(ctx, -22, -28);
          grapes(ctx, 21, -27);
        },
      },
      {
        role: 'head',
        x: 0,
        y: -35,
        bounds: [-22, -32, 22, 8],
        draw: (ctx) => {
          [
            [-14, -6, 7, -1.1, 0x5b8a3a],
            [14, -6, 7, 1.1, 0x5b8a3a],
            [-8, -12, 8, -0.5, 0x6e9b45],
            [8, -12, 8, 0.5, 0x6e9b45],
            [0, -14, 9, 0, 0x7fb04f],
          ].forEach(([x, y, size, angle, color]) =>
            leaf(ctx, x ?? 0, y ?? 0, size ?? 6, angle ?? 0, color ?? 0x6e9b45),
          );
          ctx.beginPath();
          ctx.moveTo(-10, 2);
          ctx.bezierCurveTo(-14, -6, -11, -15, -4, -16);
          ctx.quadraticCurveTo(0, -18, 4, -16);
          ctx.bezierCurveTo(11, -15, 14, -6, 10, 2);
          ctx.quadraticCurveTo(0, 6, -10, 2);
          ctx.closePath();
          fillStroke(
            ctx,
            radial(ctx, -3, -10, 1, 15, [
              [0, 0x8a6448],
              [0.6, 0x4a3024],
              [1, 0x22160f],
            ]),
            0x120b08,
            1.2,
          );
          [-1, 1].forEach((s) => {
            ellipse(ctx, s * 4.6, -8, 3.4, 2.2, s * 0.45);
            ctx.fillStyle = css(0x080402);
            ctx.fill();
            ellipse(ctx, s * 4.4, -7.8, 1.3, 1);
            ctx.fillStyle = css(0xffe7a0);
            ctx.fill();
          });
          path(
            ctx,
            [-5, -1, -2.5, -3, 0, -1.2, 2.5, -3, 5, -1, 2, 1.6, -2, 1.6],
          );
          ctx.fillStyle = css(0x080402);
          ctx.fill();
          grapes(ctx, -12, -2);
          grapes(ctx, 12, -2);
        },
      },
      eyeGlow(0, -35, [-22, -32, 22, 8], 0xffb02a, [
        [-4.4, -7.8, 1.6, 1.2],
        [4.4, -7.8, 1.6, 1.2],
      ]),
      coreGlow(0, [-38, -40, 38, 34], 0xffa830, 0, -17, 12),
    ],
    emitters: [
      {
        x: 0,
        y: -52,
        config: {
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(-18, -4, 36, 8),
          } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          speedX: { min: -46, max: -18 },
          speedY: { min: -8, max: 14 },
          gravityY: 18,
          rotate: { min: 0, max: 360 },
          lifespan: 2200,
          scale: { start: 0.9, end: 0.6 },
          alpha: { start: 1, end: 0 },
          tint: [0x6e9b45, 0x8fc25a, 0xc8a83a, 0x7e3f78],
          frequency: 260,
        },
        texture: 'fx-leaf',
      },
    ],
  };
}

/* ---------------------------------------------------------------- */
/* Bend: a volcano that stood up.                                   */
/* ---------------------------------------------------------------- */
function lavaPeakTitan(): RigSpec {
  const rock = (ctx: Ctx, y0: number, y1: number) =>
    linear(ctx, 0, y0, 0, y1, [
      [0, 0x5a4850],
      [0.4, 0x2e2329],
      [1, 0x110c0f],
    ]);
  const arm = (s: number) => (ctx: Ctx) => {
    path(ctx, [-6, -2, 6, -3, 8, 14, -7, 15]);
    fillStroke(ctx, rock(ctx, -3, 15), INK, 1.2);
    path(ctx, [-8, 13, 8, 12, 10, 24, -9, 25]);
    fillStroke(ctx, rock(ctx, 12, 25), INK, 1.2);
    crack(ctx, [s * -2, 0, s * 1, 6, s * -1, 12]);
    path(ctx, [-11, 23, 0, 20, 11, 23, 12, 33, 6, 38, -6, 38, -12, 33]);
    fillStroke(
      ctx,
      linear(ctx, 0, 20, 0, 38, [
        [0, 0x6a565e],
        [0.5, 0x3a2c33],
        [1, 0x150f12],
      ]),
      INK,
      1.4,
    );
    line(ctx, [-8, 28, 8, 28], 0x0c0809, 0.8);
    [-4, 1, 6].forEach((x) => line(ctx, [x, 24, x - 1, 28], 0x0c0809, 0.7));
    crack(ctx, [-6, 31, -1, 34, 4, 32, 7, 36]);
    glow(ctx, 0xff5b35, 3, () => {
      ellipse(ctx, s * 3, 39, 1, 1.6);
      ctx.fillStyle = css(0xffb054);
      ctx.fill();
    });
  };
  return {
    footY: 33,
    shadowWidth: 72,
    armLength: 38,
    armSplay: 0.08,
    glowColor: 0xff5b35,
    parts: [
      aura(0xff5e55, -18, 62),
      {
        role: 'armL',
        x: -31,
        y: -34,
        bounds: [-14, -5, 14, 42],
        draw: arm(-1),
      },
      { role: 'armR', x: 31, y: -34, bounds: [-14, -5, 14, 42], draw: arm(1) },
      {
        role: 'body',
        x: 0,
        y: 0,
        bounds: [-46, -60, 46, 36],
        draw: (ctx) => {
          [-1, 1].forEach((s) => {
            [
              [4, 6, 0],
              [9, 6, -3],
              [14, 6, 1],
            ].forEach(([x, w, lift]) => {
              const cx = s * (x ?? 0);
              path(ctx, [
                cx - (w ?? 6) / 2,
                30,
                cx - (w ?? 6) / 2,
                2 + (lift ?? 0),
                cx,
                0 + (lift ?? 0),
                cx + (w ?? 6) / 2,
                2 + (lift ?? 0),
                cx + (w ?? 6) / 2,
                30,
              ]);
              fillStroke(ctx, rock(ctx, 0, 30), INK, 0.9);
            });
            crack(ctx, [s * 6.5, 6, s * 6.5, 26]);
            path(ctx, [s * 1, 28, s * 20, 28, s * 22, 34, s * 0, 34]);
            fillStroke(ctx, css(0x1a1316), INK, 1);
          });
          [-1, 1].forEach((s) => {
            path(ctx, [s * 14, -36, s * 30, -58, s * 44, -30, s * 28, -26]);
            fillStroke(ctx, rock(ctx, -58, -26), INK, 1.3);
            path(ctx, [
              s * 30,
              -58,
              s * 25,
              -49,
              s * 29,
              -51,
              s * 33,
              -47,
              s * 36,
              -50,
            ]);
            fillStroke(
              ctx,
              linear(ctx, 0, -58, 0, -47, [
                [0, 0xffffff],
                [1, 0xb8c8d8],
              ]),
              0x6a7a8a,
              0.4,
            );
            crack(ctx, [s * 30, -47, s * 33, -40, s * 30, -33, s * 34, -28]);
          });
          path(
            ctx,
            [
              -30, -34, -14, -41, 14, -41, 30, -34, 26, -12, 16, 4, -16, 4, -26,
              -12,
            ],
          );
          fillStroke(
            ctx,
            linear(ctx, 0, -41, 0, 4, [
              [0, 0x5a4850],
              [0.35, 0x2e2329],
              [1, 0x120d10],
            ]),
            INK,
            1.5,
          );
          path(ctx, [-14, -41, 0, -30, -26, -12, -30, -34]);
          ctx.fillStyle = css(0xffffff, 0.06);
          ctx.fill();
          path(ctx, [14, -41, 30, -34, 26, -12, 6, -22]);
          ctx.fillStyle = css(0x000000, 0.25);
          ctx.fill();
          crack(ctx, [0, -20, -6, -26, -12, -28, -20, -34]);
          crack(ctx, [0, -20, 7, -25, 12, -24, 18, -31]);
          crack(ctx, [0, -20, -4, -12, -10, -6, -14, 2]);
          crack(ctx, [0, -20, 5, -12, 8, -4, 12, 2]);
          glow(ctx, 0xff5b35, 7, () => {
            path(ctx, [0, -26, 3.5, -21, 2, -15, -2, -15, -3.5, -21]);
            ctx.fillStyle = radial(ctx, 0, -20, 0.3, 6, [
              [0, 0xffffff],
              [0.35, 0xffe08a],
              [0.75, 0xff8a3d],
              [1, 0xc8301a],
            ]);
            ctx.fill();
          });
        },
      },
      {
        role: 'head',
        x: 0,
        y: -40,
        bounds: [-17, -28, 17, 5],
        draw: (ctx) => {
          path(
            ctx,
            [
              -12, 1, -15, -11, -10, -20, -5, -19, -3, -23, 3, -23, 5, -19, 10,
              -20, 15, -11, 12, 1, 6, 4, -6, 4,
            ],
          );
          fillStroke(ctx, rock(ctx, -23, 4), INK, 1.3);
          glow(ctx, 0xff6a2a, 4, () => {
            ellipse(ctx, 0, -21.5, 4.2, 1.6);
            ctx.fillStyle = radial(ctx, 0, -21.5, 0.2, 4.2, [
              [0, 0xffffff],
              [0.4, 0xffd06a],
              [1, 0xff5b35],
            ]);
            ctx.fill();
          });
          path(ctx, [-14, -12, 0, -9, 14, -12, 13, -9, 0, -6, -13, -9]);
          fillStroke(ctx, css(0x161013), INK, 0.6);
          [-1, 1].forEach((s) => {
            path(ctx, [
              s * 10,
              -8.6,
              s * 2.6,
              -6.6,
              s * 3.2,
              -5,
              s * 9.6,
              -6.4,
            ]);
            ctx.fillStyle = css(0xffe8a0);
            ctx.fill();
          });
          path(ctx, [-6, -2, 6, -2, 4.5, 2.4, -4.5, 2.4]);
          fillStroke(
            ctx,
            linear(ctx, 0, -2, 0, 2.4, [
              [0, 0xffd06a],
              [1, 0xff4a1c],
            ]),
            INK,
            0.6,
          );
          [-4, -1.5, 1.5, 4].forEach((x, i) => {
            path(ctx, [x - 1, -2, x + 1, -2, x, i % 2 ? 0.2 : 0.8]);
            ctx.fillStyle = css(0x1a1316);
            ctx.fill();
          });
          crack(ctx, [-8, -17, -6, -13]);
          crack(ctx, [9, -16, 7, -12]);
        },
      },
      eyeGlow(0, -40, [-17, -28, 17, 5], 0xff6a2a, [
        [-6, -7, 2.6, 1.1],
        [6, -7, 2.6, 1.1],
      ]),
      coreGlow(0, [-46, -60, 46, 36], 0xff6a2a, 0, -20, 18),
    ],
    emitters: [
      {
        x: 0,
        y: -62,
        config: {
          speedY: { min: -40, max: -18 },
          speedX: { min: -10, max: 10 },
          lifespan: 1400,
          scale: { start: 0.7, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xffe08a, 0xff8a3d, 0xff4a1c],
          frequency: 80,
          blendMode: 'ADD',
        },
        texture: 'fx-spark',
      },
      {
        x: 0,
        y: -64,
        config: {
          speedY: { min: -22, max: -12 },
          speedX: { min: -12, max: 4 },
          lifespan: 2000,
          scale: { start: 0.5, end: 2.2 },
          alpha: { start: 0.45, end: 0 },
          tint: [0x3a2f33, 0x55484c],
          frequency: 150,
        },
        texture: 'fx-soft',
      },
    ],
  };
}

const RIGS: Readonly<Record<BossLocationId, () => RigSpec>> = {
  hillsboro_west: siliconSentinel,
  hillsboro_east: circuitWarden,
  milwaukie: riverforgedGuardian,
  walla_walla: vineyardColossus,
  bend: lavaPeakTitan,
};

/** Visual size of each boss relative to its painted rig. */
export const BOSS_RIG_SCALE: Readonly<Record<BossLocationId, number>> = {
  hillsboro_west: 1,
  hillsboro_east: 1.02,
  milwaukie: 1.06,
  walla_walla: 1.1,
  bend: 1.12,
};

interface PartState {
  readonly image: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
}

/**
 * A boss built from painted parts that breathe, sway, flare when they attack
 * and break apart when beaten. It follows an invisible physics hitbox.
 */
export class BossRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly spec: RigSpec;
  private readonly parts = new Map<Role, PartState>();
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[] =
    [];
  private readonly arcs?: Phaser.GameObjects.Graphics;
  private readonly pose = { raise: 0, flare: 0, rise: 1, recoil: 0 };
  private nextArcAt = 0;
  private defeated = false;

  constructor(
    private readonly scene: Phaser.Scene,
    locationId: BossLocationId,
    x: number,
    y: number,
    private readonly scale: number,
  ) {
    ensureFxTextures(scene);
    this.spec = RIGS[locationId]();
    this.shadow = scene.add
      .ellipse(
        x,
        y + this.spec.footY * scale,
        this.spec.shadowWidth * scale,
        9 * scale,
        0x000000,
        0.38,
      )
      .setDepth(9);
    this.container = scene.add.container(x, y).setDepth(10).setScale(scale);
    DRAW_ORDER.forEach((role) =>
      this.spec.parts
        .filter((part) => part.role === role)
        .forEach((part, index) => {
          const [left, top, right, bottom] = part.bounds;
          const key = `boss-${locationId}-${role}-${index}`;
          paintTexture(
            scene,
            key,
            right - left,
            bottom - top,
            part.draw,
            -left,
            -top,
          );
          const image = scene.add
            .image(part.x, part.y, key)
            .setOrigin(-left / (right - left), -top / (bottom - top))
            .setScale(1 / ART_RESOLUTION);
          if (role === 'aura' || role === 'eyes' || role === 'core')
            image.setBlendMode(Phaser.BlendModes.ADD);
          this.container.add(image);
          this.parts.set(role, { image, x: part.x, y: part.y });
        }),
    );
    this.spec.emitters.forEach((emitter) => {
      const particles = addParticles(
        scene,
        0,
        0,
        emitter.texture ?? 'fx-spark',
        emitter.config,
      ).setDepth(emitter.config.blendMode === 'ADD' ? 11 : 9);
      particles.startFollow(
        this.container,
        emitter.x * scale,
        emitter.y * scale,
      );
      this.emitters.push(particles);
    });
    if (this.spec.arcs !== undefined)
      this.arcs = scene.add
        .graphics()
        .setDepth(11)
        .setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Rises out of the ground (or descends, for floating bosses). */
  entrance(duration = 900): void {
    this.pose.rise = 0;
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.pose,
      rise: 1,
      duration,
      ease: 'Cubic.easeOut',
    });
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: duration * 0.6,
    });
    this.scene.time.delayedCall(duration * 0.75, () => this.cast());
  }

  update(time: number, targetX: number, targetY: number): void {
    if (this.defeated) return;
    const spec = this.spec;
    const breath = Math.sin(time / 380);
    const sway = Math.sin(time / 520);
    const bob = spec.floats ? Math.sin(time / 600) * 3 : 0;
    const rise = (1 - this.pose.rise) * (spec.floats ? -26 : 22);
    const x = Phaser.Math.Linear(
      this.container.x,
      targetX + this.pose.recoil,
      0.18,
    );
    const y = Phaser.Math.Linear(this.container.y, targetY + bob + rise, 0.18);
    this.container.setPosition(x, y);
    const { raise, flare } = this.pose;
    const s = 1 / ART_RESOLUTION;
    const body = this.parts.get('body');
    body?.image
      .setY(body.y + breath * 0.4)
      .setScale(s, s * (1 + breath * 0.018));
    this.parts.get('back')?.image.setRotation(sway * 0.02);
    const head = this.parts.get('head');
    const headY = (head?.y ?? 0) + breath * 0.9 - raise * 2;
    const headTilt = Math.sin(time / 610) * 0.05;
    head?.image.setY(headY).setRotation(headTilt);
    const eyes = this.parts.get('eyes');
    const scan = spec.scan ? Math.sin(time / 420) * spec.scan : 0;
    eyes?.image
      .setPosition((eyes?.x ?? 0) + scan, headY)
      .setRotation(headTilt)
      .setAlpha(
        Phaser.Math.Clamp(
          0.65 + 0.35 * Math.sin(time / 130) * 0.5 + flare,
          0,
          1,
        ),
      );
    const splay = spec.armSplay ?? 0;
    const armL = this.parts.get('armL');
    const armR = this.parts.get('armR');
    armL?.image
      .setY(armL.y + breath * 0.5)
      .setRotation(splay + sway * 0.07 + raise * 1.1);
    armR?.image
      .setY(armR.y + breath * 0.5)
      .setRotation(-splay - Math.sin(time / 520 + 1) * 0.07 - raise * 1.1);
    const core = this.parts.get('core');
    core?.image
      .setY((core?.y ?? 0) + breath * 0.4)
      .setAlpha(
        Phaser.Math.Clamp(
          0.55 + 0.25 * Math.sin(time / 260) + flare * 0.6,
          0,
          1,
        ),
      );
    this.parts
      .get('aura')
      ?.image.setScale(s * (1 + Math.sin(time / 700) * 0.06 + flare * 0.25))
      .setAlpha(0.6 + flare * 0.4);
    const ground = targetY + spec.footY * this.scale;
    const lift = spec.floats ? 0.75 + Math.sin(time / 600) * 0.08 : 1;
    this.shadow
      .setPosition(x, ground)
      .setScale(lift * this.pose.rise, lift * this.pose.rise);
    if (this.arcs && time >= this.nextArcAt) {
      this.nextArcAt = time + 70;
      this.drawArcs(raise + flare > 0.2);
    }
  }

  /** Attack pose: arms rise, eyes and aura flare. */
  cast(): void {
    if (this.defeated) return;
    this.scene.tweens.killTweensOf(this.pose);
    this.pose.rise = 1;
    this.scene.tweens.add({
      targets: this.pose,
      raise: { from: this.pose.raise, to: 1 },
      flare: { from: this.pose.flare, to: 1 },
      duration: 160,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 220,
    });
  }

  hurt(): void {
    if (this.defeated) return;
    this.solidParts().forEach((image) => image.setTintFill(0xffffff));
    this.scene.time.delayedCall(90, () =>
      this.solidParts().forEach((image) => image.clearTint()),
    );
    this.scene.tweens.add({
      targets: this.pose,
      recoil: { from: 6, to: 0 },
      duration: 220,
      ease: 'Quad.easeOut',
    });
  }

  /** Flickers, cracks apart in a burst of light and is gone. */
  defeat(color: number): void {
    if (this.defeated) return;
    this.defeated = true;
    this.arcs?.clear();
    this.emitters.forEach((emitter) => emitter.stop());
    let flicker = 0;
    this.scene.time.addEvent({
      delay: 70,
      repeat: 7,
      callback: () => {
        flicker += 1;
        this.solidParts().forEach((image) =>
          flicker % 2 ? image.setTintFill(0xffffff) : image.setTint(color),
        );
        this.container.x += flicker % 2 ? 2 : -2;
      },
    });
    this.scene.cameras.main.shake(520, 0.01);
    this.scene.time.delayedCall(560, () => {
      const burst = addParticles(
        this.scene,
        this.container.x,
        this.container.y - 10,
        'fx-soft',
        {
          speed: { min: 40, max: 130 },
          lifespan: 700,
          scale: { start: 0.9, end: 0 },
          tint: [0xffffff, color, this.spec.glowColor],
          blendMode: 'ADD',
          emitting: false,
        },
      ).setDepth(12);
      burst.explode(40);
      this.scene.time.delayedCall(900, () => burst.destroy());
      this.scene.cameras.main.flash(160, 255, 240, 220, false);
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        scaleX: this.scale * 1.25,
        scaleY: this.scale * 0.6,
        duration: 380,
        ease: 'Quad.easeIn',
        onComplete: () => this.destroy(),
      });
      this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 380 });
    });
  }

  destroy(): void {
    this.emitters.forEach((emitter) => emitter.destroy());
    this.arcs?.destroy();
    this.shadow.destroy();
    this.container.destroy();
  }

  private solidParts(): Phaser.GameObjects.Image[] {
    return (['back', 'armL', 'armR', 'body', 'head'] as const)
      .map((role) => this.parts.get(role)?.image)
      .filter((image): image is Phaser.GameObjects.Image => Boolean(image));
  }

  private handPosition(role: 'armL' | 'armR'): Phaser.Math.Vector2 {
    const part = this.parts.get(role);
    const rotation = part?.image.rotation ?? 0;
    const length = this.spec.armLength;
    const localX = (part?.image.x ?? 0) - Math.sin(rotation) * length;
    const localY = (part?.image.y ?? 0) + Math.cos(rotation) * length;
    return new Phaser.Math.Vector2(
      this.container.x + localX * this.scale,
      this.container.y + localY * this.scale,
    );
  }

  private drawArcs(strong: boolean): void {
    if (!this.arcs || this.spec.arcs === undefined) return;
    const from = this.handPosition('armL');
    const to = this.handPosition('armR');
    this.arcs.clear();
    const strands = strong ? 3 : 1;
    for (let k = 0; k < strands; k += 1) {
      const points: Phaser.Math.Vector2[] = [from];
      const steps = 9;
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const sag = Math.sin(t * Math.PI) * (10 + k * 4);
        points.push(
          new Phaser.Math.Vector2(
            Phaser.Math.Linear(from.x, to.x, t) +
              Phaser.Math.FloatBetween(-2, 2),
            Phaser.Math.Linear(from.y, to.y, t) +
              sag +
              Phaser.Math.FloatBetween(-4, 4),
          ),
        );
      }
      points.push(to);
      this.arcs
        .lineStyle(3, this.spec.arcs, strong ? 0.35 : 0.18)
        .strokePoints(points);
      this.arcs
        .lineStyle(1, 0xffffff, strong ? 0.95 : 0.6)
        .strokePoints(points);
    }
  }
}
