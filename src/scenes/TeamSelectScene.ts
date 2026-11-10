import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { TEAMS, type TeamDefinition } from '../content/teams';
import { drawTeamPortrait } from '../actors/teamAppearance';
import { PhaserInput, sanitizeGamepads } from '../game/input/PhaserInput';
import { TouchControls } from '../ui/TouchControls';
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
  private controls?: PhaserInput;
  private inputReady = false;

  constructor() {
    super('team-select');
  }

  create(): void {
    gameAudio.bind(this, 'title');
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
      .text(128, 29, 'UP / DOWN: SELECT • A / ENTER: CONFIRM', {
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
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls);
    // Ignore a button still held from the previous screen.
    this.inputReady = false;
    this.time.delayedCall(200, () => {
      this.inputReady = true;
    });
  }

  update(): void {
    if (!this.controls) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (!this.inputReady) return;
    const actions = this.controls.actions;
    if (actions.get('up').pressed) this.moveSelection(-1);
    if (actions.get('down').pressed) this.moveSelection(1);
    if (actions.get('confirm').pressed || actions.get('jump').pressed)
      this.confirmSelection();
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
    // Only flag teams that cannot be chosen yet; "ready" on every card says nothing.
    const readiness = this.add
      .text(92, -5, team.productionReady ? '' : 'PLANNED', {
        color: '#91b4c8',
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
    // First tap previews a team; tapping the highlighted team confirms it.
    container.on('pointerdown', () => {
      if (this.selectedIndex === index) {
        this.confirmSelection();
        return;
      }
      this.selectedIndex = index;
      gameAudio.play('select');
      this.renderSelection();
    });
    return container;
  }

  private moveSelection(delta: number): void {
    this.selectedIndex = Phaser.Math.Wrap(
      this.selectedIndex + delta,
      0,
      TEAMS.length,
    );
    gameAudio.play('select');
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
    gameAudio.play('confirm');
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
