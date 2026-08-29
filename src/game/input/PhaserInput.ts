import Phaser from 'phaser';
import { ActionState, type GameAction } from './actions';

type KeyBindings = Readonly<
  Record<GameAction, readonly Phaser.Input.Keyboard.Key[]>
>;

export class PhaserInput {
  readonly actions = new ActionState();
  private readonly bindings: KeyBindings;
  private readonly virtualActions = new Set<GameAction>();
  private readonly pendingActions = new Set<GameAction>();

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable');

    const key = (code: number): Phaser.Input.Keyboard.Key =>
      keyboard.addKey(code);
    this.bindings = {
      up: [
        key(Phaser.Input.Keyboard.KeyCodes.UP),
        key(Phaser.Input.Keyboard.KeyCodes.W),
      ],
      down: [
        key(Phaser.Input.Keyboard.KeyCodes.DOWN),
        key(Phaser.Input.Keyboard.KeyCodes.S),
      ],
      left: [
        key(Phaser.Input.Keyboard.KeyCodes.LEFT),
        key(Phaser.Input.Keyboard.KeyCodes.A),
      ],
      right: [
        key(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        key(Phaser.Input.Keyboard.KeyCodes.D),
      ],
      confirm: [
        key(Phaser.Input.Keyboard.KeyCodes.ENTER),
        key(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ],
      cancel: [key(Phaser.Input.Keyboard.KeyCodes.ESC)],
      jump: [key(Phaser.Input.Keyboard.KeyCodes.Z)],
      attack: [key(Phaser.Input.Keyboard.KeyCodes.X)],
      spell: [key(Phaser.Input.Keyboard.KeyCodes.C)],
      pause: [key(Phaser.Input.Keyboard.KeyCodes.P)],
    };

    for (const [action, keys] of Object.entries(this.bindings) as [
      GameAction,
      readonly Phaser.Input.Keyboard.Key[],
    ][]) {
      keys.forEach((boundKey) => {
        boundKey.on('down', () => this.pendingActions.add(action));
      });
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Object.values(this.bindings)
        .flat()
        .forEach((boundKey) => boundKey.removeAllListeners());
    });
  }

  setVirtualAction(action: GameAction, down: boolean): void {
    if (down) this.virtualActions.add(action);
    else this.virtualActions.delete(action);
  }

  update(gamepad?: Phaser.Input.Gamepad.Gamepad): void {
    const active = new Set([...this.virtualActions, ...this.pendingActions]);

    for (const [action, keys] of Object.entries(this.bindings) as [
      GameAction,
      readonly Phaser.Input.Keyboard.Key[],
    ][]) {
      if (keys.some((key) => key.isDown)) active.add(action);
    }

    if (gamepad) {
      if (gamepad.up) active.add('up');
      if (gamepad.down) active.add('down');
      if (gamepad.left) active.add('left');
      if (gamepad.right) active.add('right');
      if (gamepad.A) active.add('confirm');
      if (gamepad.B) active.add('cancel');
      if (gamepad.buttons[0]?.pressed) active.add('jump');
      if (gamepad.buttons[1]?.pressed) active.add('attack');
      if (gamepad.buttons[2]?.pressed) active.add('spell');
      if (gamepad.buttons[9]?.pressed) active.add('pause');
    }

    this.actions.update(active);
    this.pendingActions.clear();
  }
}

