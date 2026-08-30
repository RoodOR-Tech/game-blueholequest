import Phaser from 'phaser';
import { TEAMS, type TeamDefinition } from '../content/teams';
import { drawTeamPortrait } from '../actors/teamAppearance';
import { sanitizeGamepads } from '../game/input/PhaserInput';
import { SaveRepository } from '../game/saves/repository';
import { createNewSave } from '../game/saves/schema';

const CARD_WIDTH = 204;
const CARD_HEIGHT = 24;
const CARD_GAP = 4;
const CARD_X = 26;
const CARD_Y = 45;

export class TeamSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private statusText?: Phaser.GameObjects.Text;
  private readonly selectPrevious = () => this.moveSelection(-1);
  private readonly selectNext = () => this.moveSelection(1);
  private readonly confirm = () => this.confirmSelection();

  constructor() {
    super('team-select');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#08111d');
    this.add
      .text(128, 14, 'CHOOSE YOUR FAMILY TEAM', {
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(128, 29, 'UP/DOWN TO SELECT • ENTER TO CONFIRM', {
        color: '#91b4c8',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(0.5);

    this.cards = TEAMS.map((team, index) => this.createCard(team, index));
    this.statusText = this.add
      .text(128, 202, '', {
        align: 'center',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5);

    this.renderSelection();
    this.input.keyboard?.on('keydown-UP', this.selectPrevious);
    this.input.keyboard?.on('keydown-W', this.selectPrevious);
    this.input.keyboard?.on('keydown-DOWN', this.selectNext);
    this.input.keyboard?.on('keydown-S', this.selectNext);
    this.input.keyboard?.on('keydown-ENTER', this.confirm);
    this.input.keyboard?.on('keydown-SPACE', this.confirm);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-UP', this.selectPrevious);
      this.input.keyboard?.off('keydown-W', this.selectPrevious);
      this.input.keyboard?.off('keydown-DOWN', this.selectNext);
      this.input.keyboard?.off('keydown-S', this.selectNext);
      this.input.keyboard?.off('keydown-ENTER', this.confirm);
      this.input.keyboard?.off('keydown-SPACE', this.confirm);
    });
  }

  private createCard(
    team: TeamDefinition,
    index: number,
  ): Phaser.GameObjects.Container {
    const y = CARD_Y + index * (CARD_HEIGHT + CARD_GAP);
    const background = this.add.rectangle(
      0,
      0,
      CARD_WIDTH,
      CARD_HEIGHT,
      0x102b3f,
    );
    background.setStrokeStyle(1, 0x42677e);
    const portrait = drawTeamPortrait(this, team.id, -88, -1);
    const label = this.add
      .text(-72, -6, team.displayName.toUpperCase(), {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    const readiness = this.add
      .text(92, -5, team.productionReady ? 'READY' : 'PLANNED', {
        color: team.productionReady ? '#83e38e' : '#91b4c8',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(1, 0);
    const container = this.add.container(
      CARD_X + CARD_WIDTH / 2,
      y + CARD_HEIGHT / 2,
      [background, portrait, label, readiness],
    );
    container
      .setSize(CARD_WIDTH, CARD_HEIGHT)
      .setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      this.selectedIndex = index;
      this.renderSelection();
      this.confirmSelection();
    });
    return container;
  }

  private moveSelection(delta: number): void {
    this.selectedIndex = Phaser.Math.Wrap(
      this.selectedIndex + delta,
      0,
      TEAMS.length,
    );
    this.renderSelection();
  }

  private renderSelection(): void {
    this.cards.forEach((card, index) => {
      const background = card.first as Phaser.GameObjects.Rectangle;
      const selected = index === this.selectedIndex;
      background.setFillStyle(selected ? 0x255a79 : 0x102b3f);
      background.setStrokeStyle(
        selected ? 2 : 1,
        selected ? 0xf6d77a : 0x42677e,
      );
    });

    const team = TEAMS[this.selectedIndex];
    if (!team || !this.statusText) return;
    this.statusText.setText(
      `${team.displayName.toUpperCase()} • ${team.startingStats.attack} ATK / ${team.startingStats.magic} MAG / ${team.startingStats.life} LIF\n${team.weaponId.replaceAll('_', ' ').toUpperCase()}\n${team.passiveDescription.toUpperCase()}`,
    );
  }

  private confirmSelection(): void {
    const team = TEAMS[this.selectedIndex];
    if (!team || !this.statusText) return;
    if (!team.productionReady) {
      this.statusText.setText(
        `${team.displayName.toUpperCase()}: PLANNED\nCHOOSE DAD & PAULA FOR NOW`,
      );
      this.cameras.main.shake(90, 0.003);
      return;
    }

    const repository = new SaveRepository(window.localStorage);
    repository.save(createNewSave(team.id));
    sanitizeGamepads(this);
    this.scene.start('blue-hole-hub');
  }
}
