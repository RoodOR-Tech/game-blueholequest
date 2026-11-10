import Phaser from 'phaser';

export interface StatusHudState {
  readonly title: string;
  readonly score?: number;
  readonly life: number;
  readonly maxLife: number;
  readonly lives: number;
  readonly maxLives: number;
  readonly magic?: number;
  readonly maxMagic?: number;
}

const LIFE_COLOR = 0xe2504a;
const MAGIC_COLOR = 0x4fa8e8;
const LIVES_COLOR = 0xf6d77a;
const EMPTY_COLOR = 0x10202c;
const OUTLINE_COLOR = 0x08111d;
const PIP = 6;
const GAP = 2;

/** Draws life, magic and lives as meters instead of a line of numbers. */
export class StatusHud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    depth = 300,
  ) {
    this.title = scene.add
      .text(x, y, '', { color: '#ffffff', fontSize: '7px' })
      .setScrollFactor(0)
      .setDepth(depth);
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(depth);
  }

  update(state: StatusHudState): void {
    this.title.setText(
      state.score === undefined
        ? state.title
        : `${state.title}  •  SCORE ${state.score}`,
    );
    this.labels.forEach((label) => label.destroy());
    this.labels.length = 0;
    this.graphics.clear();
    const rowY = this.y + 13;
    let cursor = this.x;
    cursor = this.meter(
      'HP',
      cursor,
      rowY,
      state.life,
      state.maxLife,
      LIFE_COLOR,
    );
    if (state.magic !== undefined && state.maxMagic !== undefined)
      cursor = this.meter(
        'MP',
        cursor + 6,
        rowY,
        state.magic,
        state.maxMagic,
        MAGIC_COLOR,
      );
    this.meter(
      'LIVES',
      cursor + 6,
      rowY,
      state.lives,
      state.maxLives,
      LIVES_COLOR,
      true,
    );
  }

  private meter(
    name: string,
    x: number,
    y: number,
    value: number,
    maximum: number,
    color: number,
    round = false,
  ): number {
    const label = this.scene.add
      .text(x, y, name, { color: '#cfe9f4', fontSize: '6px' })
      .setScrollFactor(0)
      .setDepth(this.title.depth);
    this.labels.push(label);
    let cursor = x + label.width + 3;
    for (let index = 0; index < maximum; index += 1) {
      const filled = index < value;
      this.graphics.fillStyle(OUTLINE_COLOR);
      if (round) this.graphics.fillCircle(cursor + PIP / 2, y + 4, PIP / 2 + 1);
      else this.graphics.fillRect(cursor - 1, y, PIP + 2, PIP + 2);
      this.graphics.fillStyle(filled ? color : EMPTY_COLOR);
      if (round) this.graphics.fillCircle(cursor + PIP / 2, y + 4, PIP / 2);
      else this.graphics.fillRect(cursor, y + 1, PIP, PIP);
      if (filled && !round)
        this.graphics.fillStyle(0xffffff, 0.35).fillRect(cursor, y + 1, PIP, 2);
      cursor += PIP + GAP;
    }
    return cursor;
  }
}

/** A wide health bar for the boss, centred along the top of the arena. */
export class BossBar {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly width: number,
    name: string,
    private readonly color: number,
  ) {
    scene.add
      .text(x + width / 2, y - 5, name, { color: '#ffe08a', fontSize: '6px' })
      .setOrigin(0.5, 1)
      .setDepth(300);
    this.graphics = scene.add.graphics().setDepth(300);
  }

  update(current: number, maximum: number): void {
    const segment = this.width / maximum;
    this.graphics.clear();
    this.graphics
      .fillStyle(OUTLINE_COLOR)
      .fillRect(this.x - 2, this.y - 2, this.width + 4, 9);
    this.graphics
      .lineStyle(1, 0xcfe9f4)
      .strokeRect(this.x - 2, this.y - 2, this.width + 4, 9);
    for (let index = 0; index < maximum; index += 1) {
      this.graphics
        .fillStyle(index < current ? this.color : EMPTY_COLOR)
        .fillRect(this.x + index * segment + 0.5, this.y, segment - 1, 5);
    }
  }
}
