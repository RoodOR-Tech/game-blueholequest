import Phaser from 'phaser';
import type { BuddaLocationId } from '../game/progression/budda';
import { cleanConnectedBackground, proportionalFrameBounds } from './familyAnimations';

const BUDDA_SOURCE_KEY = 'budda-sprites-v2';
export const BUDDA_TEXTURE_KEY = `${BUDDA_SOURCE_KEY}-clean`;
export const BUDDA_SPRITE_SCALE = 0.18;

const BUDDA_FRAMES: Readonly<Record<BuddaLocationId, string>> = {
  rockaway: 'budda-rockaway',
  hillsboro_west: 'budda-hillsboro-west',
  hillsboro_east: 'budda-hillsboro-east',
  milwaukie: 'budda-milwaukie',
  walla_walla: 'budda-walla-walla',
  bend: 'budda-bend',
};

export function preloadBuddaSprites(scene: Phaser.Scene): void {
  scene.load.image(BUDDA_SOURCE_KEY, 'assets/sprites/budda-sprites-v2.png');
}

export function ensureBuddaTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BUDDA_TEXTURE_KEY)) return;
  const texture = cleanConnectedBackground(scene, BUDDA_SOURCE_KEY, 6);
  const image = texture.getSourceImage() as HTMLCanvasElement;
  (Object.values(BUDDA_FRAMES) as string[]).forEach((frame, index) => {
    const bounds = proportionalFrameBounds(image.width, 6, index);
    texture.add(
      frame,
      0,
      bounds.x,
      0,
      bounds.width,
      image.height,
    );
  });
}

export function buddaFrame(locationId: BuddaLocationId): string {
  return BUDDA_FRAMES[locationId];
}

