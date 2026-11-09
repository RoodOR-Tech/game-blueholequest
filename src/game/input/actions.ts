export const GAME_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'jump',
  'attack',
  'spell',
  'pause',
] as const;

export type GameAction = (typeof GAME_ACTIONS)[number];

export interface ActionFrame {
  readonly down: boolean;
  readonly pressed: boolean;
  readonly released: boolean;
}

const RELEASED: ActionFrame = {
  down: false,
  pressed: false,
  released: false,
};

export class ActionState {
  private previous = new Set<GameAction>();
  private current = new Set<GameAction>();

  update(actions: Iterable<GameAction>): void {
    this.previous = this.current;
    this.current = new Set(actions);
  }

  get(action: GameAction): ActionFrame {
    const down = this.current.has(action);
    const wasDown = this.previous.has(action);
    if (!down && !wasDown) return RELEASED;
    return {
      down,
      pressed: down && !wasDown,
      released: !down && wasDown,
    };
  }
}

