import Phaser from 'phaser';
import { isReducedEffects } from './settings';

export const WORLD_WIDTH = 256;
export const WORLD_HEIGHT = 240;

const MINIMUM_FONT_SIZE = 6;
const MAXIMUM_RENDER_SCALE = 10;
const UI_FONT_FAMILY = 'Arial Black, Arial, sans-serif';

let renderScale = 1;
const textScale = new WeakMap<Phaser.GameObjects.Text, number>();

/** Whole number of device pixels drawn for each world pixel. */
export function getRenderScale(): number {
  return renderScale;
}

function measureRenderScale(parent: HTMLElement): number {
  const style = window.getComputedStyle(parent);
  const width =
    parent.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  const height =
    parent.clientHeight -
    parseFloat(style.paddingTop) -
    parseFloat(style.paddingBottom);
  const ratio = window.devicePixelRatio || 1;
  const fit = Math.min(
    (width * ratio) / WORLD_WIDTH,
    (height * ratio) / WORLD_HEIGHT,
  );
  return Phaser.Math.Clamp(Math.floor(fit), 1, MAXIMUM_RENDER_SCALE);
}

function sharpenText(child: Phaser.GameObjects.GameObject): void {
  if (child instanceof Phaser.GameObjects.Text) {
    if (textScale.get(child) === renderScale) return;
    if (!textScale.has(child)) {
      child.setFontFamily(UI_FONT_FAMILY);
      child.setFontStyle('bold');
      const size = parseFloat(String(child.style.fontSize));
      if (size < MINIMUM_FONT_SIZE) child.setFontSize(MINIMUM_FONT_SIZE);
    }
    child.setResolution(renderScale);
    textScale.set(child, renderScale);
    return;
  }
  if (child instanceof Phaser.GameObjects.Container)
    child.list.forEach(sharpenText);
}

/** Draws every label at device resolution so it stays crisp at any scale. */
export function sharpenSceneText(scene: Phaser.Scene): void {
  scene.children.list.forEach(sharpenText);
}

const tunedCameras = new WeakSet<Phaser.Cameras.Scene2D.Camera>();

/**
 * Shake strength is defined against the 256-pixel world, so it is corrected
 * for the render scale. Flashes and shakes are skipped when effects are reduced.
 */
function tuneEffects(camera: Phaser.Cameras.Scene2D.Camera): void {
  if (tunedCameras.has(camera)) return;
  tunedCameras.add(camera);
  const shake = camera.shake.bind(camera);
  camera.shake = (duration, intensity, ...rest) => {
    if (isReducedEffects()) return camera;
    const strength = typeof intensity === 'number' ? intensity : 0.05;
    return shake(duration, strength / (renderScale * renderScale), ...rest);
  };
  const flash = camera.flash.bind(camera);
  camera.flash = (...parameters) =>
    isReducedEffects() ? camera : flash(...parameters);
}

function applyCamera(scene: Phaser.Scene): void {
  scene.cameras?.cameras.forEach((camera) => {
    camera.setOrigin(0, 0).setZoom(renderScale);
    tuneEffects(camera);
  });
}

function applyRenderScale(game: Phaser.Game): void {
  const parent = game.canvas.parentElement;
  if (!parent) return;
  const next = measureRenderScale(parent);
  const ratio = window.devicePixelRatio || 1;
  const zoom = 1 / ratio;
  if (next === renderScale && game.scale.zoom === zoom) return;
  renderScale = next;
  game.scale.setZoom(zoom);
  game.scale.resize(WORLD_WIDTH * next, WORLD_HEIGHT * next);
  // One world pixel covers exactly `next` device pixels on the page.
  game.canvas.style.width = `${(WORLD_WIDTH * next) / ratio}px`;
  game.canvas.style.height = `${(WORLD_HEIGHT * next) / ratio}px`;
  game.scale.refresh();
  game.scene.scenes.forEach(applyCamera);
}

/**
 * Renders the 256 × 240 world at a whole-number multiple of device pixels.
 * Pixels stay square and even, and text is drawn at full device resolution.
 */
export function installDisplay(game: Phaser.Game): void {
  const refresh = (): void => applyRenderScale(game);
  game.scene.scenes.forEach((scene) => {
    scene.events.on(Phaser.Scenes.Events.START, () => applyCamera(scene));
    scene.events.on(Phaser.Scenes.Events.CREATE, () => applyCamera(scene));
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, () =>
      sharpenSceneText(scene),
    );
  });
  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
  window.addEventListener('blue-hole-layout', refresh);
  if (game.canvas.parentElement && 'ResizeObserver' in window)
    new ResizeObserver(refresh).observe(game.canvas.parentElement);
  refresh();
  game.scene.scenes.forEach(applyCamera);
}
