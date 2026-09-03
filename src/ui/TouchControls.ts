import Phaser from 'phaser';
import type { GameAction } from '../game/input/actions';
import { PhaserInput } from '../game/input/PhaserInput';

interface TouchButtonDefinition {
  readonly action: GameAction;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface TouchControlActions {
  readonly primary: GameAction;
  readonly secondary: GameAction;
}

const DIRECTION_BUTTONS: readonly TouchButtonDefinition[] = [
  { action: 'up', label: '▲', x: 38, y: 162, radius: 11 },
  { action: 'left', label: '◀', x: 11, y: 190, radius: 11 },
  { action: 'right', label: '▶', x: 65, y: 190, radius: 11 },
  { action: 'down', label: '▼', x: 38, y: 218, radius: 11 },
];

const TOUCH_BUTTON_DEPTH = 700;
const LANDSCAPE_TOUCH_QUERY =
  '(orientation: landscape) and (min-aspect-ratio: 3/2)';

export class TouchControls {
  constructor(
    scene: Phaser.Scene,
    input: PhaserInput,
    actions: TouchControlActions = { primary: 'confirm', secondary: 'cancel' },
  ) {
    const buttons: readonly TouchButtonDefinition[] = [
      ...DIRECTION_BUTTONS,
      { action: actions.primary, label: 'A', x: 228, y: 185, radius: 17 },
      { action: actions.secondary, label: 'B', x: 192, y: 211, radius: 15 },
    ];
    const canvasControls: Array<
      Phaser.GameObjects.Arc | Phaser.GameObjects.Text
    > = [];
    buttons.forEach((definition) => {
      const button = scene.add
        .circle(definition.x, definition.y, definition.radius, 0x08111d, 0.48)
        .setStrokeStyle(1, 0xcfe9f4, 0.75)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .setDepth(TOUCH_BUTTON_DEPTH);
      const label = scene.add
        .text(definition.x, definition.y, definition.label, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: `${definition.radius}px`,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setAlpha(0.8)
        .setScrollFactor(0)
        .setDepth(TOUCH_BUTTON_DEPTH + 1);
      canvasControls.push(button, label);

      const release = (): void => {
        input.setVirtualAction(definition.action, false);
        button.setFillStyle(0x08111d, 0.48);
      };
      button.on('pointerdown', () => {
        input.setVirtualAction(definition.action, true);
        button.setFillStyle(0x2d789b, 0.8);
      });
      button.on('pointerup', release);
      button.on('pointerout', release);
      button.on('pointercancel', release);
      label.disableInteractive();
    });

    const landscapeQuery = window.matchMedia(LANDSCAPE_TOUCH_QUERY);
    const overlay = this.createLandscapeOverlay(input, buttons);
    const updateLayout = (): void => {
      const useSideControls = landscapeQuery.matches;
      canvasControls.forEach((control) => control.setVisible(!useSideControls));
      overlay.classList.toggle('is-visible', useSideControls);
    };
    landscapeQuery.addEventListener('change', updateLayout);
    updateLayout();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      landscapeQuery.removeEventListener('change', updateLayout);
      overlay.remove();
    });
  }

  private createLandscapeOverlay(
    input: PhaserInput,
    buttons: readonly TouchButtonDefinition[],
  ): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'landscape-touch-controls';
    overlay.setAttribute('aria-label', 'Game controls');

    const directions = document.createElement('div');
    directions.className = 'landscape-touch-controls__directions';
    const actions = document.createElement('div');
    actions.className = 'landscape-touch-controls__actions';

    buttons.forEach((definition) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `landscape-touch-controls__button landscape-touch-controls__button--${definition.action}`;
      button.textContent = definition.label;
      button.setAttribute('aria-label', definition.action);

      const release = (): void => {
        input.setVirtualAction(definition.action, false);
        button.classList.remove('is-pressed');
      };
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        input.setVirtualAction(definition.action, true);
        button.classList.add('is-pressed');
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);

      const isDirection = DIRECTION_BUTTONS.some(
        ({ action }) => action === definition.action,
      );
      (isDirection ? directions : actions).append(button);
    });

    overlay.append(directions, actions);
    document.body.append(overlay);
    return overlay;
  }
}

