import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { sceneForCheckpoint } from '../game/progression/checkpoints';
import { sanitizeGamepads } from '../game/input/PhaserInput';
import { HighScoreRepository } from '../game/saves/highScores';
import { getTeam } from '../content/teams';
import { sharpenSceneText } from '../ui/textClarity';

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
  private readonly highScores = new HighScoreRepository(window.localStorage);

  constructor() {
    super('title');
  }

  create(): void {
    gameAudio.bind(this, 'title');
    this.save = this.repository.load() ?? undefined;
    this.drawBackdrop();
    this.drawHighScores();
    this.createMenu();
    sharpenSceneText(this);
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
      .text(128, 168, 'CHOOSE YOUR PATH', {
        color: '#d8edf5',
        fontFamily: 'monospace',
        fontSize: '6px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.options = labels.map((label, index) =>
      this.add
        .text(128, 183 + index * 24, label, {
          align: 'center',
          backgroundColor: '#08111d',
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
      .text(128, 231, '', {
        align: 'center',
        backgroundColor: '#08111d',
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
    gameAudio.play('confirm');
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
        .setBackgroundColor(selected ? '#173f57' : '#08111d')
        .setText(`${selected ? '▶ ' : ''}${option.text.replace(/^▶ /, '')}`);
    });
    if (!this.status || this.confirmingNewGame) return;
    this.status.setText(
      this.save && this.selectedIndex === 0
        ? `SCORE ${this.save.stats.score} • ARTIFACTS ${this.save.relics.length}/5 • LIVES ${this.save.resources.lives}/${this.save.resources.maxLives}`
        : this.save
          ? 'START OVER WITH A NEW FAMILY TEAM'
          : 'BEGIN A NEW ROOD HOLIDAY ADVENTURE',
    );
  }

  private drawHighScores(): void {
    const scores = this.highScores.list().slice(0, 3);
    if (scores.length === 0) return;
    const lines = scores.map(
      (entry, index) =>
        `${index + 1}. ${getTeam(entry.teamId).displayName.toUpperCase()}  ${entry.score}`,
    );
    this.add
      .text(249, 84, `HIGH SCORES\n${lines.join('\n')}`, {
        align: 'right',
        backgroundColor: '#08111d',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '6px',
        lineSpacing: 2,
        padding: { x: 4, y: 3 },
      })
      .setOrigin(1, 0);
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    // Oregon coast at twilight, looking toward the family's small Rockaway cabin.
    graphics
      .fillGradientStyle(0x07162c, 0x07162c, 0x2f7394, 0x2f7394)
      .fillRect(0, 0, 256, 151);
    graphics.fillStyle(0xf6dfa0, 0.72).fillCircle(211, 41, 18);
    graphics.fillStyle(0x07162c).fillCircle(217, 36, 17);
    for (let index = 0; index < 23; index += 1)
      graphics
        .fillStyle(index % 4 === 0 ? 0xf6d77a : 0xcfe9f4, 0.75)
        .fillCircle(
          8 + ((index * 37) % 240),
          8 + ((index * 19) % 65),
          index % 5 === 0 ? 1.3 : 0.7,
        );

    graphics.fillStyle(0x274a58).fillTriangle(-15, 148, 47, 72, 112, 148);
    graphics.fillStyle(0x355c67).fillTriangle(56, 148, 132, 53, 207, 148);
    graphics.fillStyle(0x466b73).fillTriangle(139, 148, 206, 78, 270, 148);
    graphics.fillStyle(COLORS.snow).fillTriangle(105, 87, 132, 53, 159, 87);
    graphics.fillStyle(0xbfdce3).fillTriangle(27, 97, 47, 72, 66, 97);

    graphics.fillStyle(COLORS.ocean).fillRect(0, 123, 256, 50);
    graphics.lineStyle(2, 0x8de1ee, 0.52);
    for (let y = 130; y < 168; y += 9)
      for (let x = (y % 18) - 18; x < 256; x += 32)
        graphics
          .beginPath()
          .moveTo(x, y)
          .lineTo(x + 10, y - 2)
          .lineTo(x + 21, y)
          .strokePath();

    graphics.fillStyle(COLORS.sand).fillRect(0, 171, 256, 69);
    graphics.fillStyle(0xb98c4d).fillEllipse(128, 181, 176, 29);

    // The Blue Hole: a warm, weathered beach cabin—not a literal hole.
    graphics.fillStyle(0x2a1b18).fillRect(91, 124, 75, 50);
    graphics.fillStyle(0x704534).fillRect(94, 127, 69, 44);
    graphics.lineStyle(1, 0x9b6a4c, 0.75);
    for (let y = 131; y < 170; y += 7) graphics.lineBetween(95, y, 162, y);
    graphics.fillStyle(0x38231d).fillTriangle(84, 127, 128, 94, 173, 127);
    graphics.fillStyle(0x8a5740).fillTriangle(91, 124, 128, 99, 166, 124);
    graphics.fillStyle(0x40271f).fillRect(139, 101, 9, 20);
    graphics.fillStyle(0xc98c58).fillRect(117, 143, 22, 29);
    graphics.fillStyle(0x2b1d19).fillRect(120, 146, 16, 26);
    graphics
      .fillStyle(0xffcb62, 0.9)
      .fillRect(100, 137, 12, 12)
      .fillRect(146, 137, 11, 12);
    graphics
      .lineStyle(2, 0x35231d)
      .strokeRect(100, 137, 12, 12)
      .strokeRect(146, 137, 11, 12);
    graphics.lineBetween(106, 137, 106, 149).lineBetween(100, 143, 112, 143);
    graphics.lineBetween(151, 137, 151, 149).lineBetween(146, 143, 157, 143);
    graphics.fillStyle(0xd8c18b).fillRoundedRect(103, 116, 50, 12, 2);
    graphics.lineStyle(1, 0x3b291f).strokeRoundedRect(103, 116, 50, 12, 2);
    this.add
      .text(128, 122, 'THE BLUE HOLE', {
        color: '#173f57',
        fontFamily: 'monospace',
        fontSize: '5px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    graphics.fillStyle(0x5c3929).fillRect(110, 172, 36, 3);
    graphics
      .lineStyle(2, 0xc9a15e)
      .lineBetween(124, 174, 117, 185)
      .lineBetween(132, 174, 139, 185);

    // Dark Coast Range trees frame the logo without obscuring the menu.
    for (let x = -8; x < 55; x += 15)
      graphics
        .fillStyle(0x102e28)
        .fillTriangle(x, 178, x + 10, 103 + (x % 4) * 6, x + 21, 178)
        .fillRect(x + 8, 153, 4, 28);
    for (let x = 211; x < 270; x += 15)
      graphics
        .fillStyle(0x102e28)
        .fillTriangle(x, 178, x + 10, 110 + (x % 3) * 7, x + 21, 178)
        .fillRect(x + 8, 154, 4, 26);

    // Warm route lanterns lead toward the water.
    [76, 180].forEach((x) => {
      graphics.fillStyle(0x342219).fillRect(x - 1, 116, 3, 42);
      graphics.fillStyle(0xffba4f, 0.3).fillCircle(x, 116, 11);
      graphics.fillStyle(0xffd66e).fillRoundedRect(x - 4, 111, 8, 10, 2);
    });

    const windowGlow = this.add.rectangle(128, 158, 12, 17, 0xffd474, 0.12);
    this.tweens.add({
      targets: windowGlow,
      alpha: 0.32,
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    graphics.fillStyle(COLORS.panel, 0.96).fillRoundedRect(15, 14, 226, 66, 6);
    graphics.lineStyle(3, 0x173f57).strokeRoundedRect(15, 14, 226, 66, 6);
    graphics
      .lineStyle(1, COLORS.frame, 0.9)
      .strokeRoundedRect(19, 18, 218, 58, 4);
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
      .text(128, 69, 'A ROOD FAMILY HOLIDAY ADVENTURE', {
        align: 'center',
        backgroundColor: '#173f57',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: 'bold',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5);
  }
}
