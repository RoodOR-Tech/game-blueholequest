import Phaser from 'phaser';
import type { TeamId } from '../content/teams';
import { DAD_SPRITE_SCALE, DAD_TEXTURE_KEY } from './dadAnimations';

type IllustratedTeamId = Exclude<TeamId, 'dad_paula'>;

const SHEETS: Readonly<Record<IllustratedTeamId, { key: string; path: string; scale: number }>> = {
  jen_omar: { key: 'jen-sprites-v1', path: 'assets/sprites/jen-sprites-v1.png', scale: 0.16 },
  joe_cia: { key: 'joe-sprites-v1', path: 'assets/sprites/joe-sprites-v1.png', scale: 0.16 },
  kris_lea: { key: 'kris-sprites-v1', path: 'assets/sprites/kris-sprites-v1.png', scale: 0.16 },
  jason_hilary: { key: 'jason-sprites-v1', path: 'assets/sprites/jason-sprites-v1.png', scale: 0.16 },
};

export function preloadFamilySprites(scene: Phaser.Scene): void {
  Object.values(SHEETS).forEach((sheet) => scene.load.image(sheet.key, sheet.path));
}

export function registerFamilyAnimations(scene: Phaser.Scene): void {
  (Object.keys(SHEETS) as IllustratedTeamId[]).forEach((teamId) => {
    const sheet = SHEETS[teamId];
    const texture = cleanConnectedBackground(scene, sheet.key);
    const image = texture.getSourceImage() as HTMLCanvasElement;
    const frames = Array.from({ length: 8 }, (_, index) => `${teamId}-frame-${index}`);
    frames.forEach((frame, index) => {
      const bounds = proportionalFrameBounds(image.width, 8, index);
      if (!texture.has(frame))
        texture.add(frame, 0, bounds.x, 0, bounds.width, image.height);
    });
    createAnimation(scene, `${teamId}-idle`, sheet.key, frames.slice(0, 2), 2, -1);
    createAnimation(scene, `${teamId}-walk`, sheet.key, frames.slice(2, 5), 7, -1);
    createAnimation(scene, `${teamId}-attack`, sheet.key, frames.slice(6, 8), 10, 0);
  });
}

export function cleanConnectedBackground(
  scene: Phaser.Scene,
  sourceKey: string,
  frameCount = 8,
): Phaser.Textures.Texture {
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const cleanKey = `${sourceKey}-clean`;
  if (scene.textures.exists(cleanKey)) return scene.textures.get(cleanKey);
  const canvasTexture = scene.textures.createCanvas(cleanKey, source.width, source.height);
  if (!canvasTexture) return scene.textures.get(sourceKey);
  const context = canvasTexture.context;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const visited = new Uint8Array(source.width * source.height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    const position = y * source.width + x;
    if (visited[position]) return;
    visited[position] = 1;
    const offset = position * 4;
    const red = pixels.data[offset] ?? 0;
    const green = pixels.data[offset + 1] ?? 0;
    const blue = pixels.data[offset + 2] ?? 0;
    const paleNeutral =
      red >= 218 &&
      green >= 218 &&
      blue >= 218 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) <= 18;
    if (paleNeutral) queue.push(position);
  };
  for (let x = 0; x < source.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, source.height - 1);
  }
  for (let y = 0; y < source.height; y += 1) {
    enqueue(0, y);
    enqueue(source.width - 1, y);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const position = queue[cursor]!;
    const x = position % source.width;
    const y = Math.floor(position / source.width);
    pixels.data[position * 4 + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < source.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < source.height) enqueue(x, y + 1);
  }
  removeSmallOpaqueComponents(pixels.data, source.width, source.height, frameCount);
  context.putImageData(pixels, 0, 0);
  canvasTexture.refresh();
  scene.textures.remove(sourceKey);
  return canvasTexture;
}

export function proportionalFrameBounds(
  sheetWidth: number,
  frameCount: number,
  frameIndex: number,
): { x: number; width: number } {
  const x = Math.round((frameIndex * sheetWidth) / frameCount);
  const end = Math.round(((frameIndex + 1) * sheetWidth) / frameCount);
  return { x, width: end - x };
}

/** Removes isolated generation debris without erasing any connected character detail. */
export function removeSmallOpaqueComponents(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  frameCount: number,
): void {
  const averageFrameWidth = width / frameCount;
  const minimumComponentPixels = Math.max(240, Math.floor(averageFrameWidth * height * 0.0015));
  for (let frame = 0; frame < frameCount; frame += 1) {
    const bounds = proportionalFrameBounds(width, frameCount, frame);
    const startX = bounds.x;
    const endX = startX + bounds.width;
    const visited = new Uint8Array((endX - startX) * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const local = y * (endX - startX) + x - startX;
        if (visited[local] || pixels[(y * width + x) * 4 + 3] === 0) continue;
        const component: number[] = [];
        const pending = [y * width + x];
        visited[local] = 1;
        for (let cursor = 0; cursor < pending.length; cursor += 1) {
          const position = pending[cursor]!;
          component.push(position);
          const currentX = position % width;
          const currentY = Math.floor(position / width);
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
              if (offsetX === 0 && offsetY === 0) continue;
              const nextX = currentX + offsetX;
              const nextY = currentY + offsetY;
              if (nextX < startX || nextX >= endX || nextY < 0 || nextY >= height) continue;
              const nextLocal = nextY * (endX - startX) + nextX - startX;
              if (visited[nextLocal]) continue;
              visited[nextLocal] = 1;
              const nextPosition = nextY * width + nextX;
              if (pixels[nextPosition * 4 + 3] !== 0) pending.push(nextPosition);
            }
          }
        }
        if (component.length < minimumComponentPixels)
          component.forEach((position) => { pixels[position * 4 + 3] = 0; });
      }
    }
  }
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  texture: string,
  frames: string[],
  frameRate: number,
  repeat: number,
): void {
  if (!scene.anims.exists(key))
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: `${texture}-clean`, frame })),
      frameRate,
      repeat,
    });
}

export function playerVisual(teamId: TeamId) {
  if (teamId === 'dad_paula')
    return {
      texture: DAD_TEXTURE_KEY,
      frame: 'dad-idle-0',
      scale: DAD_SPRITE_SCALE,
      idle: 'dad-idle',
      walk: 'dad-walk',
      attack: 'dad-attack',
      jumpTexture: DAD_TEXTURE_KEY,
      jumpFrame: 'dad-jump',
    };
  const sheet = SHEETS[teamId];
  return {
    texture: `${sheet.key}-clean`,
    frame: `${teamId}-frame-0`,
    scale: sheet.scale,
    idle: `${teamId}-idle`,
    walk: `${teamId}-walk`,
    attack: `${teamId}-attack`,
    jumpTexture: `${sheet.key}-clean`,
    jumpFrame: `${teamId}-frame-5`,
  };
}

export function configurePlayerBody(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  teamId: TeamId,
): void {
  if (teamId === 'dad_paula') sprite.body.setSize(210, 500).setOffset(30, 150);
  else
    sprite.body
      .setSize(teamId === 'jason_hilary' ? 190 : 165, 420)
      .setOffset(teamId === 'jason_hilary' ? 35 : 48, 180);
}

