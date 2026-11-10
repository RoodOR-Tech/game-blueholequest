import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../app/display';
import type { GameAction } from '../game/input/actions';
import { PhaserInput } from '../game/input/PhaserInput';
import { openPauseMenu } from './PauseMenu';

export interface TouchControlActions {
  readonly primary: GameAction;
  readonly secondary: GameAction;
}

type ButtonRole = 'up' | 'down' | 'left' | 'right' | 'primary' | 'secondary';
type TouchLayout = 'none' | 'sides' | 'below';

interface Binding {
  readonly input: PhaserInput;
  readonly actions: TouchControlActions;
}

const DEFAULT_ACTIONS: TouchControlActions = {
  primary: 'confirm',
  secondary: 'cancel',
};
const BUTTONS: readonly { role: ButtonRole; label: string }[] = [
  { role: 'up', label: '▲' },
  { role: 'left', label: '◀' },
  { role: 'right', label: '▶' },
  { role: 'down', label: '▼' },
  { role: 'primary', label: 'A' },
  { role: 'secondary', label: 'B' },
];
// Space reserved outside the picture, in control units. Mirrors style.css.
const SIDE_GUTTER = 180;
const BELOW_STRIP = 260;
// One control unit is a CSS pixel on a 400-pixel-wide phone. Sizing from the
// viewport keeps buttons finger-sized when the browser lays the page out wider
// than the screen, as "Desktop site" mode does.
const UNIT_BASIS = 400;
const MINIMUM_UNIT = 0.8;
const MAXIMUM_UNIT = 2.6;

let overlay: HTMLDivElement | undefined;
let binding: Binding | undefined;
let touchDevice = false;
let unit = 0;
const held = new Map<ButtonRole, GameAction>();

function actionFor(role: ButtonRole): GameAction | undefined {
  if (!binding) return undefined;
  if (role === 'primary') return binding.actions.primary;
  if (role === 'secondary') return binding.actions.secondary;
  return role;
}

function releaseAll(): void {
  held.forEach((action) => binding?.input.setVirtualAction(action, false));
  held.clear();
  overlay
    ?.querySelectorAll('.is-pressed')
    .forEach((button) => button.classList.remove('is-pressed'));
}

function measureUnit(): number {
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const raw = shortSide / UNIT_BASIS;
  return Math.min(MAXIMUM_UNIT, Math.max(MINIMUM_UNIT, raw));
}

/** Picks whichever control placement leaves the larger picture. */
function chooseLayout(scale: number): TouchLayout {
  if (!touchDevice) return 'none';
  const width = window.innerWidth;
  const height = window.innerHeight;
  const sides = Math.min(
    (width - SIDE_GUTTER * scale * 2) / WORLD_WIDTH,
    height / WORLD_HEIGHT,
  );
  const below = Math.min(
    width / WORLD_WIDTH,
    (height - BELOW_STRIP * scale) / WORLD_HEIGHT,
  );
  return sides >= below ? 'sides' : 'below';
}

function refreshLayout(): void {
  const nextUnit = measureUnit();
  const layout = chooseLayout(nextUnit);
  if (nextUnit === unit && document.body.dataset.touchLayout === layout) return;
  unit = nextUnit;
  document.documentElement.style.setProperty('--u', nextUnit.toFixed(3));
  document.body.dataset.touchLayout = layout;
  window.dispatchEvent(new Event('blue-hole-layout'));
}

function createOverlay(): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.setAttribute('aria-label', 'Game controls');
  const directions = document.createElement('div');
  directions.className = 'touch-controls__directions';
  const actions = document.createElement('div');
  actions.className = 'touch-controls__actions';

  BUTTONS.forEach(({ role, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch-controls__button touch-controls__button--${role}`;
    button.textContent = label;
    button.setAttribute('aria-label', role);
    const release = (): void => {
      const action = held.get(role);
      if (action) binding?.input.setVirtualAction(action, false);
      held.delete(role);
      button.classList.remove('is-pressed');
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const action = actionFor(role);
      if (!action || !binding) return;
      button.setPointerCapture(event.pointerId);
      held.set(role, action);
      binding.input.setVirtualAction(action, true);
      button.classList.add('is-pressed');
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    (role === 'primary' || role === 'secondary' ? actions : directions).append(
      button,
    );
  });

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'game-menu-button';
  menu.textContent = 'II';
  menu.setAttribute('aria-label', 'Pause and settings');
  menu.addEventListener('click', () => openPauseMenu());

  root.append(directions, actions);
  document.body.append(root, menu);
  return root;
}

/** Creates the page-level controls once; they sit outside the game picture. */
export function installTouchControls(): void {
  if (overlay) return;
  overlay = createOverlay();
  touchDevice = window.matchMedia('(pointer: coarse)').matches;
  window.addEventListener(
    'touchstart',
    () => {
      if (touchDevice) return;
      touchDevice = true;
      refreshLayout();
    },
    { passive: true },
  );
  window.addEventListener('resize', refreshLayout);
  window.addEventListener('orientationchange', refreshLayout);
  window.addEventListener('blur', releaseAll);
  refreshLayout();
}

/** Routes the on-screen buttons to one scene's input for that scene's lifetime. */
export class TouchControls {
  constructor(
    scene: Phaser.Scene,
    input: PhaserInput,
    actions: TouchControlActions = DEFAULT_ACTIONS,
  ) {
    installTouchControls();
    releaseAll();
    const own: Binding = { input, actions };
    binding = own;
    overlay?.classList.add('is-bound');
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (binding !== own) return;
      releaseAll();
      binding = undefined;
      overlay?.classList.remove('is-bound');
    });
  }
}
