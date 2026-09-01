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
    this.add
      .text(128, 151, 'CHOOSE YOUR PATH', {
        color: '#d8edf5',
        fontFamily: 'monospace',
        fontSize: '6px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.options = labels.map((label, index) =>
      this.add
        .text(128, 166 + index * 24, label, {
          align: 'center',
          backgroundColor: '#08111ddd',
          fontFamily: 'monospace',
          fontSize: '9px',
          fontStyle: 'bold',
          padding: { x: 16, y: 5 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.selectedIndex = index;
          this.confirmingNewGame = false;
          this.renderSelection();
        })
        .on('pointerdown', () => {
          this.selectedIndex = index;
          this.renderSelection();
          this.activateSelection();
        }),
    );
    this.status = this.add
      .text(128, 226, '', {
        align: 'center',
        backgroundColor: '#08111dcc',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '6px',
        padding: { x: 7, y: 4 },
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
    // Oregon coast at twilight: layered sky, mountains, forest, ocean, and the Blue Hole.
    graphics
      .fillGradientStyle(0x07162c, 0x07162c, 0x2f7394, 0x2f7394)
      .fillRect(0, 0, 256, 151);
    graphics.fillStyle(0xf6dfa0, 0.72).fillCircle(211, 41, 18);
    graphics.fillStyle(0x07162c).fillCircle(217, 36, 17);
    for (let index = 0; index < 23; index += 1)
      graphics
        .fillStyle(index % 4 === 0 ? 0xf6d77a : 0xcfe9f4, 0.75)
        .fillCircle(8 + ((index * 37) % 240), 8 + ((index * 19) % 65), index % 5 === 0 ? 1.3 : 0.7);

    graphics.fillStyle(0x274a58).fillTriangle(-15, 148, 47, 72, 112, 148);
    graphics.fillStyle(0x355c67).fillTriangle(56, 148, 132, 53, 207, 148);
    graphics.fillStyle(0x466b73).fillTriangle(139, 148, 206, 78, 270, 148);
    graphics.fillStyle(COLORS.snow).fillTriangle(105, 87, 132, 53, 159, 87);
    graphics.fillStyle(0xbfdce3).fillTriangle(27, 97, 47, 72, 66, 97);

    graphics.fillStyle(COLORS.ocean).fillRect(0, 123, 256, 50);
    graphics.lineStyle(2, 0x8de1ee, 0.52);
    for (let y = 130; y < 168; y += 9)
      for (let x = (y % 18) - 18; x < 256; x += 32)
        graphics.beginPath().moveTo(x, y).lineTo(x + 10, y - 2).lineTo(x + 21, y).strokePath();

    graphics.fillStyle(COLORS.sand).fillRect(0, 171, 256, 69);
    graphics.fillStyle(0xb98c4d).fillEllipse(128, 180, 153, 32);
    graphics.fillStyle(0x09283b).fillEllipse(128, 176, 92, 29);
    graphics.fillStyle(0x0b83b2).fillEllipse(128, 173, 78, 22);
    graphics.lineStyle(2, 0x91edff, 0.8).strokeEllipse(128, 173, 67, 16);

    // Dark Coast Range trees frame the logo without obscuring the menu.
    for (let x = -8; x < 55; x += 15)
      graphics.fillStyle(0x102e28).fillTriangle(x, 178, x + 10, 103 + (x % 4) * 6, x + 21, 178).fillRect(x + 8, 153, 4, 28);
    for (let x = 211; x < 270; x += 15)
      graphics.fillStyle(0x102e28).fillTriangle(x, 178, x + 10, 110 + (x % 3) * 7, x + 21, 178).fillRect(x + 8, 154, 4, 26);

    // Warm route lanterns lead toward the water.
    [76, 180].forEach((x) => {
      graphics.fillStyle(0x342219).fillRect(x - 1, 116, 3, 42);
      graphics.fillStyle(0xffba4f, 0.3).fillCircle(x, 116, 11);
      graphics.fillStyle(0xffd66e).fillRoundedRect(x - 4, 111, 8, 10, 2);
    });

    const shimmer = this.add.ellipse(128, 173, 66, 15, 0xb9f4ff, 0.12);
    this.tweens.add({ targets: shimmer, scaleX: 1.24, alpha: 0.35, duration: 1300, yoyo: true, repeat: -1 });

    graphics.fillStyle(COLORS.panel, 0.96).fillRoundedRect(15, 14, 226, 66, 6);
    graphics.lineStyle(3, 0x173f57).strokeRoundedRect(15, 14, 226, 66, 6);
    graphics.lineStyle(1, COLORS.frame, 0.9).strokeRoundedRect(19, 18, 218, 58, 4);
    this.add
      .text(128, 29, 'THE BLUE HOLE', {
        color: '#73ddff',
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        stroke: '#12394e',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.add
      .text(128, 50, 'Q U E S T', {
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(128, 68, 'A ROOD FAMILY HOLIDAY ADVENTURE', {
        color: '#d8edf5',
        fontFamily: 'monospace',
        fontSize: '5px',
      })
      .setOrigin(0.5);
  }
}
