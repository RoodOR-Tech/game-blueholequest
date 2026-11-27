import Phaser from 'phaser';

/**
 * Painted art is drawn with the Canvas 2D API at several device pixels per
 * world pixel, then shown at 1 / ART_RESOLUTION scale. The camera zooms the
 * 256 × 240 world up to device resolution, so this keeps gradients, curves and
 * glows smooth instead of rendering them as chunky world-sized pixels.
 */
export const ART_RESOLUTION = 4;

export type Ctx = CanvasRenderingContext2D;
export type Stop = readonly [offset: number, color: number, alpha?: number];

export function css(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

/**
 * Paints a texture whose drawing space is measured in world pixels. The
 * origin (ox, oy) is where (0, 0) falls inside the texture, so parts can be
 * drawn relative to their pivot.
 */
export function paintTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: Ctx) => void,
  ox = 0,
  oy = 0,
): string {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(
    key,
    Math.ceil(width * ART_RESOLUTION),
    Math.ceil(height * ART_RESOLUTION),
  );
  if (!texture) return key;
  const ctx = texture.getContext();
  ctx.save();
  ctx.scale(ART_RESOLUTION, ART_RESOLUTION);
  ctx.translate(ox, oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  ctx.restore();
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}

/** Adds a painted texture at world scale. */
export function addPainted(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  originX = 0.5,
  originY = 0.5,
): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, key)
    .setOrigin(originX, originY)
    .setScale(1 / ART_RESOLUTION);
}

export function path(ctx: Ctx, points: readonly number[], close = true): Ctx {
  ctx.beginPath();
  ctx.moveTo(points[0] ?? 0, points[1] ?? 0);
  for (let i = 2; i < points.length; i += 2)
    ctx.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
  if (close) ctx.closePath();
  return ctx;
}

export function linear(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly Stop[],
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([offset, color, alpha]) =>
    gradient.addColorStop(offset, css(color, alpha ?? 1)),
  );
  return gradient;
}

export function radial(
  ctx: Ctx,
  x: number,
  y: number,
  r0: number,
  r1: number,
  stops: readonly Stop[],
): CanvasGradient {
  const gradient = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([offset, color, alpha]) =>
    gradient.addColorStop(offset, css(color, alpha ?? 1)),
  );
  return gradient;
}

/** Fills the current path, then outlines it. */
export function fillStroke(
  ctx: Ctx,
  fill: string | CanvasGradient,
  stroke?: number,
  lineWidth = 1,
): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke === undefined) return;
  ctx.strokeStyle = css(stroke);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** Runs a drawing step with a soft glow; blur is in world pixels. */
export function glow(
  ctx: Ctx,
  color: number,
  blur: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.shadowColor = css(color);
  ctx.shadowBlur = blur * ART_RESOLUTION;
  draw();
  ctx.restore();
}

export function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation = 0,
): Ctx {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  return ctx;
}

export function line(
  ctx: Ctx,
  points: readonly number[],
  color: number,
  width: number,
  alpha = 1,
): void {
  path(ctx, points, false);
  ctx.strokeStyle = css(color, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Small deterministic random source so painted scenery is stable. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

/** Soft round particle and glow textures shared by every scene. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('fx-soft'))
    paintTexture(scene, 'fx-soft', 16, 16, (ctx) => {
      ctx.fillStyle = radial(ctx, 8, 8, 0, 8, [
        [0, 0xffffff, 1],
        [0.35, 0xffffff, 0.6],
        [1, 0xffffff, 0],
      ]);
      ctx.fillRect(0, 0, 16, 16);
    });
  if (!scene.textures.exists('fx-spark'))
    paintTexture(scene, 'fx-spark', 4, 4, (ctx) => {
      ctx.fillStyle = radial(ctx, 2, 2, 0, 2, [
        [0, 0xffffff, 1],
        [0.5, 0xffffff, 0.9],
        [1, 0xffffff, 0],
      ]);
      ctx.fillRect(0, 0, 4, 4);
    });
  if (!scene.textures.exists('fx-leaf'))
    paintTexture(scene, 'fx-leaf', 6, 4, (ctx) => {
      ellipse(ctx, 3, 2, 2.8, 1.5, 0.2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      line(ctx, [0.6, 2.2, 5.4, 1.8], 0x000000, 0.3, 0.25);
    });
  if (!scene.textures.exists('fx-streak'))
    paintTexture(scene, 'fx-streak', 14, 2, (ctx) => {
      ctx.fillStyle = linear(ctx, 0, 0, 14, 0, [
        [0, 0xffffff, 0],
        [0.6, 0xffffff, 0.8],
        [1, 0xffffff, 0],
      ]);
      ctx.fillRect(0, 0.4, 14, 1.2);
    });
}

type ScaleValue = Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType &
  Phaser.Types.GameObjects.Particles.EmitterOpOnUpdateType;

function shrink(value: unknown): unknown {
  if (typeof value === 'number') return value / ART_RESOLUTION;
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {
      ...(value as Record<string, unknown>),
    };
    ['start', 'end', 'min', 'max'].forEach((key) => {
      if (typeof copy[key] === 'number')
        copy[key] = (copy[key] as number) / ART_RESOLUTION;
    });
    return copy;
  }
  return value;
}

/**
 * Adds particles that use the painted fx textures. Scales in the config are
 * in world terms: scale 1 shows the texture at its painted world size.
 */
export function addParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  texture: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const scaled = { ...config };
  if (config.scale === undefined && config.scaleX === undefined)
    scaled.scale = 1 / ART_RESOLUTION;
  (['scale', 'scaleX', 'scaleY'] as const).forEach((key) => {
    if (config[key] !== undefined)
      scaled[key] = shrink(config[key]) as ScaleValue;
  });
  if (config.scaleX !== undefined && config.scaleY === undefined)
    scaled.scaleY = 1 / ART_RESOLUTION;
  return scene.add.particles(x, y, texture, scaled);
}
