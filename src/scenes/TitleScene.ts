import Phaser from 'phaser';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { sceneForCheckpoint } from '../game/progression/checkpoints';
import { sanitizeGamepads } from '../game/input/PhaserInput';

const COLORS = {
  ocean: 0x176eb0,
  sand: 0xd7b46a,
  forest: 0x28613c,
  snow: 0xd9edf2,
  panel: 0x08111d,
  frame: 0xcfe9f4,
} as const;

export class TitleScene extends Phaser.Scene {
  private save?: SaveData;
  private selectedIndex = 0;
  private options: Phaser.GameObjects.Text[] = [];
  private status?: Phaser.GameObjects.Text;
  private confirmingNewGame = false;
  private readonly selectPrevious = () => this.moveSelection(-1);
  private readonly selectNext = () => this.moveSelection(1);
  private readonly activate = () => this.activateSelection();
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('title');
  }

  create(): void {
    this.save = this.repository.load() ?? undefined;
    this.drawBackdrop();
    this.createMenu();
    this.input.keyboard?.on('keydown-UP', this.selectPrevious);
    this.input.keyboard?.on('keydown-W', this.selectPrevious);
    this.input.keyboard?.on('keydown-DOWN', this.selectNext);
    this.input.keyboard?.on('keydown-S', this.selectNext);
    this.input.keyboard?.on('keydown-ENTER', this.activate);
    this.input.keyboard?.on('keydown-SPACE', this.activate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-UP', this.selectPrevious);
      this.input.keyboard?.off('keydown-W', this.selectPrevious);
      this.input.keyboard?.off('keydown-DOWN', this.selectNext);
      this.input.keyboard?.off('keydown-S', this.selectNext);
      this.input.keyboard?.off('keydown-ENTER', this.activate);
      this.input.keyboard?.off('keydown-SPACE', this.activate);
    });
  }

  private createMenu(): void {
    const labels = this.save ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
    this.options = labels.map((label, index) =>
      this.add
        .text(128, 166 + index * 24, label, {
          align: 'center',
          backgroundColor: '#08111ddd',
          fontFamily: 'monospace',
          fontSize: '8px',
          padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selectedIndex = index;
          this.renderSelection();
          this.activateSelection();
        }),
    );
    this.status = this.add
      .text(128, 225, '', {
        align: 'center',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(0.5);
    this.renderSelection();
  }

  private moveSelection(delta: number): void {
    this.selectedIndex = Phaser.Math.Wrap(
      this.selectedIndex + delta,
      0,
      this.options.length,
    );
    this.confirmingNewGame = false;
    this.renderSelection();
  }

  private activateSelection(): void {
    sanitizeGamepads(this);
    const continuing = Boolean(this.save) && this.selectedIndex === 0;
    if (continuing) {
      this.scene.start(sceneForCheckpoint(this.save!.checkpointId));
      return;
    }
    if (this.save && !this.confirmingNewGame) {
      this.confirmingNewGame = true;
      this.status?.setText('NEW GAME ERASES CURRENT PROGRESS • CONFIRM AGAIN');
      this.cameras.main.shake(80, 0.002);
      return;
    }
    this.scene.start('team-select');
  }

  private renderSelection(): void {
    this.options.forEach((option, index) => {
      const selected = index === this.selectedIndex;
      option
        .setColor(selected ? '#f6d77a' : '#ffffff')
        .setBackgroundColor(selected ? '#173f57ee' : '#08111ddd')
        .setText(`${selected ? '▶ ' : ''}${option.text.replace(/^▶ /, '')}`);
    });
    if (!this.status || this.confirmingNewGame) return;
    this.status.setText(
      this.save && this.selectedIndex === 0
        ? `ARTIFACTS ${this.save.relics.length}/5 • LIVES ${this.save.resources.lives}/${this.save.resources.maxLives} • XP ${this.save.stats.experience}`
        : this.save
          ? 'START OVER WITH A NEW FAMILY TEAM'
          : 'BEGIN A NEW ROOD HOLIDAY ADVENTURE',
    );
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.ocean).fillRect(0, 0, 256, 240);
    graphics.fillStyle(COLORS.sand).fillRect(0, 135, 256, 105);
    graphics.fillStyle(COLORS.forest).fillTriangle(0, 145, 52, 58, 106, 145);
    graphics.fillTriangle(74, 145, 138, 42, 202, 145);
    graphics.fillStyle(COLORS.snow).fillTriangle(104, 94, 138, 42, 169, 94);
    graphics.fillStyle(COLORS.panel, 0.94).fillRoundedRect(19, 18, 218, 57, 4);
    graphics.lineStyle(2, COLORS.frame).strokeRoundedRect(19, 18, 218, 57, 4);
    this.add
      .text(128, 31, 'THE BLUE HOLE QUEST', {
        color: '#cfe9f4',
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(128, 53, 'ROOD HOLIDAY ADVENTURE', {
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '8px',
      })
      .setOrigin(0.5);
  }
}
