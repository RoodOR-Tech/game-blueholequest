import type Phaser from 'phaser';
import { isReducedEffects, setReducedEffects } from '../app/settings';
import { gameAudio } from '../audio/GameAudio';

export interface PauseLeaveOption {
  readonly label: string;
  readonly run: () => void;
}

let game: Phaser.Game | undefined;
let panel: HTMLDivElement | undefined;
let leaveOption: PauseLeaveOption | undefined;
let gamepadPoll = 0;
let gamepadWasDown = true;
let closedAt = 0;

export function isPaused(): boolean {
  return Boolean(panel);
}

/** Lets the active scene offer a safe way out from the pause menu. */
export function setPauseLeaveOption(option?: PauseLeaveOption): void {
  leaveOption = option;
}

function addButton(
  parent: HTMLElement,
  label: () => string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pause-menu__button';
  button.textContent = label();
  button.addEventListener('click', () => {
    onClick();
    button.textContent = label();
  });
  parent.append(button);
  return button;
}

function pollGamepadResume(): void {
  const down = Array.from(navigator.getGamepads?.() ?? []).some(
    (pad) => pad?.buttons[9]?.pressed || pad?.buttons[0]?.pressed,
  );
  if (down && !gamepadWasDown) {
    closePauseMenu();
    return;
  }
  gamepadWasDown = down;
  gamepadPoll = window.requestAnimationFrame(pollGamepadResume);
}

export function closePauseMenu(): void {
  if (!panel || !game) return;
  window.cancelAnimationFrame(gamepadPoll);
  panel.remove();
  panel = undefined;
  closedAt = window.performance.now();
  game.loop.wake();
  gameAudio.setSuspended(false);
}

export function openPauseMenu(): void {
  if (panel || !game) return;
  game.loop.sleep();
  gameAudio.setSuspended(true);

  panel = document.createElement('div');
  panel.className = 'pause-menu';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Paused');
  const box = document.createElement('div');
  box.className = 'pause-menu__box';
  const title = document.createElement('h2');
  title.className = 'pause-menu__title';
  title.textContent = 'PAUSED';
  box.append(title);

  const resume = addButton(box, () => 'RESUME', closePauseMenu);
  addButton(
    box,
    () => `SOUND: ${gameAudio.isMuted() ? 'OFF' : 'ON'}`,
    () => gameAudio.setMuted(!gameAudio.isMuted()),
  );
  addButton(
    box,
    () => `FLASH & SHAKE: ${isReducedEffects() ? 'OFF' : 'ON'}`,
    () => setReducedEffects(!isReducedEffects()),
  );
  const leave = leaveOption;
  if (leave)
    addButton(
      box,
      () => leave.label,
      () => {
        closePauseMenu();
        leave.run();
      },
    );

  panel.append(box);
  document.body.append(panel);
  resume.focus();
  gamepadWasDown = true;
  gamepadPoll = window.requestAnimationFrame(pollGamepadResume);
}

/**
 * Opens the menu on a scene's request. The key or button that just closed the
 * menu is still held when play resumes, so requests right after closing are ignored.
 */
export function requestPauseMenu(): void {
  if (window.performance.now() - closedAt < 350) return;
  openPauseMenu();
}

export function togglePauseMenu(): void {
  if (panel) closePauseMenu();
  else openPauseMenu();
}

/** Wires the pause key and pauses automatically when the page is hidden. */
export function installPauseMenu(target: Phaser.Game): void {
  game = target;
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyP') togglePauseMenu();
    else if (event.code === 'Escape' && panel) {
      event.stopPropagation();
      closePauseMenu();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) gameAudio.setSuspended(true);
    else if (!panel) gameAudio.setSuspended(false);
  });
}
