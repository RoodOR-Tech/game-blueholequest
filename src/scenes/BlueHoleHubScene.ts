import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import {
  BUDDA_SPRITE_SCALE,
  BUDDA_TEXTURE_KEY,
  buddaFrame,
  ensureBuddaTexture,
} from '../actors/budda';
import { configurePlayerBody, playerVisual } from '../actors/familyAnimations';
import { getTeam } from '../content/teams';
import { PhaserInput } from '../game/input/PhaserInput';
import { CHECKPOINTS, saveAtCheckpoint } from '../game/progression/checkpoints';
import {
  BOSS_LOCATIONS,
  celebrateHomecoming,
  pendingHomecomingArtifact,
} from '../game/progression/bossLocations';
import { recoveredRelicCount, RELIC_IDS } from '../game/progression/relics';
import {
  BUDDA_ENCOUNTERS,
  buddaFlag,
  discoverBudda,
  foundBuddaCount,
} from '../game/progression/budda';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';
import { HighScoreRepository } from '../game/saves/highScores';
import { sharpenSceneText } from '../ui/textClarity';

const PLAYER_SPEED = 58;
const INTERACTION_DISTANCE = 31;
const RELIC_COLORS = [
  0xf2c94c, 0x7ed6ef, 0xd68b32, 0x58b87a, 0xd6d1c7,
] as const;

interface HubFixture {
  readonly id: 'fridge' | 'mantle' | 'exit' | 'budda';
  readonly x: number;
  readonly y: number;
}

const FIXTURES: readonly HubFixture[] = [
  { id: 'fridge', x: 35, y: 113 },
  { id: 'mantle', x: 191, y: 99 },
  { id: 'exit', x: 220, y: 218 },
  { id: 'budda', x: 67, y: 145 },
];

export class BlueHoleHubScene extends Phaser.Scene {
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private prompt?: Phaser.GameObjects.Text;
  private message?: Phaser.GameObjects.Text;
  private hud?: Phaser.GameObjects.Text;
  private mantleSockets: Phaser.GameObjects.Arc[] = [];
  private homecomingArtifact?: ReturnType<typeof pendingHomecomingArtifact>;
  private postGameMode = false;
  private postGameIndex = 0;
  private postGameOptions: Phaser.GameObjects.Text[] = [];
  private highScorePanel?: Phaser.GameObjects.Text;
  private save?: SaveData;
  private readonly repository = new SaveRepository(window.localStorage);
  private readonly highScores = new HighScoreRepository(window.localStorage);

  constructor() {
    super('blue-hole-hub');
  }

  create(): void {
    gameAudio.bind(this, 'title');
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    if (
      this.save.flags.quest_victory_celebrated &&
      recoveredRelicCount(this.save.relics) === RELIC_IDS.length
    ) {
      this.postGameMode = true;
      this.drawRoom();
      this.refreshMantle();
      this.controls = new PhaserInput(this);
      new TouchControls(this, this.controls);
      this.createPostGameMenu();
      sharpenSceneText(this);
      return;
    }
    this.homecomingArtifact = pendingHomecomingArtifact(this.save);
    this.save = this.homecomingArtifact
      ? celebrateHomecoming(
          this.save,
          this.homecomingArtifact,
          new Date().toISOString(),
        )
      : saveAtCheckpoint(this.save, CHECKPOINTS.home, new Date().toISOString());
    this.repository.save(this.save);

    this.drawRoom();
    ensureBuddaTexture(this);
    this.add
      .sprite(67, 145, BUDDA_TEXTURE_KEY, buddaFrame('rockaway'))
      .setScale(BUDDA_SPRITE_SCALE);
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls);
    this.createPlayer();
    this.createInterface();
    this.refreshHud();
    this.refreshMantle();
    if (this.homecomingArtifact) this.presentHomecoming();
    sharpenSceneText(this);
  }

  update(): void {
    if (!this.controls || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (this.postGameMode) {
      this.updatePostGameMenu();
      return;
    }
    if (!this.player) return;

    const horizontal =
      Number(this.controls.actions.get('right').down) -
      Number(this.controls.actions.get('left').down);
    const vertical =
      Number(this.controls.actions.get('down').down) -
      Number(this.controls.actions.get('up').down);
    const direction = new Phaser.Math.Vector2(horizontal, vertical).normalize();
    this.player.setVelocity(
      direction.x * PLAYER_SPEED,
      direction.y * PLAYER_SPEED,
    );
    if (horizontal !== 0) this.player.setFlipX(horizontal < 0);
    const visual = playerVisual(this.save.activeTeamId);
    this.player.play(
      direction.lengthSq() > 0 ? visual.walk : visual.idle,
      true,
    );

    const fixture = this.nearestFixture();
    this.prompt?.setVisible(Boolean(fixture));
    if (fixture && this.controls.actions.get('confirm').pressed)
      this.interact(fixture.id);
  }

  private drawRoom(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x4c2d20).fillRect(0, 0, 256, 38);
    graphics.fillStyle(0x8f6543).fillRect(0, 38, 256, 126);
    graphics.fillStyle(0x5b3929).fillRect(0, 164, 256, 76);
    graphics.lineStyle(1, 0x79513b);
    for (let y = 171; y < 240; y += 12) graphics.lineBetween(0, y, 256, y);
    for (let x = 0; x < 256; x += 32) graphics.lineBetween(x, 164, x, 240);

    graphics.fillStyle(0x98d6e8).fillRect(82, 48, 92, 54);
    graphics.fillStyle(0x2875aa).fillRect(82, 80, 92, 22);
    graphics.fillStyle(0x354c45).fillTriangle(95, 82, 112, 57, 129, 82);
    graphics.fillTriangle(124, 82, 146, 52, 165, 82);
    graphics.lineStyle(3, 0x3c241a).strokeRect(80, 46, 96, 58);
    graphics.lineBetween(128, 47, 128, 103);

    graphics.fillStyle(0xdbe7e8).fillRoundedRect(17, 77, 36, 72, 3);
    graphics.lineStyle(2, 0x334850).strokeRoundedRect(17, 77, 36, 72, 3);
    graphics.lineBetween(17, 104, 53, 104);
    graphics
      .fillStyle(0x334850)
      .fillRect(45, 87, 3, 12)
      .fillRect(45, 111, 3, 18);

    graphics.fillStyle(0x633627).fillRect(176, 78, 66, 79);
    graphics.fillStyle(0x1b1515).fillRoundedRect(187, 111, 44, 43, 14);
    graphics.fillStyle(0xe06023).fillTriangle(199, 151, 209, 121, 218, 151);
    graphics.fillStyle(0xffc14f).fillTriangle(207, 151, 215, 131, 224, 151);
    graphics.fillStyle(0x3a2119).fillRect(169, 74, 80, 7);

    // Beach-access exit mat stays clear of the centered dialogue panel.
    graphics.fillStyle(0x172a35).fillRoundedRect(195, 211, 50, 18, 2);
    graphics.lineStyle(1, 0xf6d77a).strokeRoundedRect(195, 211, 50, 18, 2);
    this.add
      .text(220, 217, 'TO HWY 26', {
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(0.5);

    this.mantleSockets = RELIC_IDS.map((_, index) =>
      this.add
        .circle(183 + index * 13, 70, 4, 0x10161c)
        .setStrokeStyle(1, 0xd9c69a),
    );

    this.add.text(7, 8, 'THE BLUE HOLE • ROCKAWAY BEACH', {
      color: '#f6d77a',
      fontFamily: 'monospace',
      fontSize: '8px',
      fontStyle: 'bold',
    });
  }

  private createPlayer(): void {
    if (!this.save) return;
    const visual = playerVisual(this.save.activeTeamId);
    const player = this.physics.add.sprite(
      128,
      190,
      visual.texture,
      visual.frame,
    );
    player.setScale(visual.scale).setCollideWorldBounds(true).play(visual.idle);
    configurePlayerBody(player, this.save.activeTeamId);
    this.player = player;
  }

  private createInterface(): void {
    this.hud = this.add.text(7, 21, '', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '7px',
    });
    this.prompt = this.add
      .text(128, 218, 'ENTER / A: INTERACT', {
        backgroundColor: '#08111ddd',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.message = this.add
      .text(128, 203, 'WELCOME HOME. THE HEARTH AWAITS FIVE RELICS.', {
        align: 'center',
        backgroundColor: '#08111dee',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '7px',
        lineSpacing: 2,
        padding: { x: 8, y: 6 },
        wordWrap: { width: 220, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private nearestFixture(): HubFixture | undefined {
    if (!this.player || !this.save) return undefined;
    return FIXTURES.find(
      (fixture) =>
        (fixture.id !== 'budda' || !this.save!.flags[buddaFlag('rockaway')]) &&
        Phaser.Math.Distance.Between(
          this.player!.x,
          this.player!.y,
          fixture.x,
          fixture.y,
        ) <= INTERACTION_DISTANCE,
    );
  }

  private interact(id: HubFixture['id']): void {
    if (!this.save || !this.message) return;
    if (id === 'exit') {
      if (recoveredRelicCount(this.save.relics) === RELIC_IDS.length) {
        this.scene.start('victory-celebration');
        return;
      }
      const nextRouteIndex = BOSS_LOCATIONS.findIndex(
        (location) => !this.save?.relics.includes(location.artifactId),
      );
      this.scene.start('highway-26', {
        routeIndex: Math.max(0, nextRouteIndex),
        nodeIndex: 0,
        traveling: true,
      });
      return;
    }
    if (id === 'fridge') {
      this.save = {
        ...this.save,
        checkpointId: 'rockaway_blue_hole',
        resources: {
          ...this.save.resources,
          life: this.save.resources.maxLife,
          magic: this.save.resources.maxMagic,
        },
        savedAt: new Date().toISOString(),
      };
      this.repository.save(this.save);
      this.message.setText(
        'FRIDGE CHECKED • HEALTH & MAGIC RESTORED • GAME SAVED',
      );
      this.cameras.main.flash(130, 140, 220, 255, false);
      this.refreshHud();
      return;
    }
    if (id === 'budda') {
      this.save = discoverBudda(
        this.save,
        'rockaway',
        new Date().toISOString(),
      );
      this.repository.save(this.save);
      const count = foundBuddaCount(this.save);
      this.message.setText(
        `BUDDA THE GINGER CAT\n“${BUDDA_ENCOUNTERS.rockaway.line}”\nREWARD: ${BUDDA_ENCOUNTERS.rockaway.reward}  •  FOUND ${count}/6`,
      );
      this.refreshHud();
      return;
    }

    const count = recoveredRelicCount(this.save.relics);
    this.message.setText(
      count === RELIC_IDS.length
        ? 'ALL FIVE ARTIFACTS RESTORED • THE HOLIDAY HEARTH BURNS BRIGHT!'
        : `THE HEARTH IS COLD • ${count} / ${RELIC_IDS.length} ARTIFACTS RESTORED`,
    );
  }

  private refreshHud(): void {
    if (!this.save || !this.hud) return;
    const team = getTeam(this.save.activeTeamId);
    this.hud.setText(
      `${team.displayName.toUpperCase()}  SCORE ${this.save.stats.score}\nHP ${this.save.resources.life}/${this.save.resources.maxLife}  LIVES ${this.save.resources.lives}/${this.save.resources.maxLives}  MAGIC ${this.save.resources.magic}/${this.save.resources.maxMagic}`,
    );
  }

  private refreshMantle(): void {
    if (!this.save) return;
    const recovered = new Set(this.save.relics);
    this.mantleSockets.forEach((socket, index) => {
      const id = RELIC_IDS[index];
      socket.setFillStyle(
        id && recovered.has(id) ? (RELIC_COLORS[index] ?? 0x74d7f2) : 0x10161c,
      );
    });
  }

  private presentHomecoming(): void {
    if (!this.homecomingArtifact || !this.message) return;
    const index = RELIC_IDS.indexOf(this.homecomingArtifact.artifactId);
    const socket = this.mantleSockets[index];
    if (socket) {
      socket.setScale(0.25);
      this.tweens.add({
        targets: socket,
        scale: 1.8,
        duration: 420,
        yoyo: true,
        ease: 'Back.easeOut',
      });
    }
    gameAudio.play('artifact');
    this.cameras.main.flash(420, 255, 218, 112, false);
    const allRecovered =
      recoveredRelicCount(this.save!.relics) === RELIC_IDS.length;
    this.message.setText(
      `WELCOME HOME, HERO!\n${this.homecomingArtifact.artifactName} NOW RESTS ON THE MANTEL.\nTHE FAMILY CHEERS • HEALTH & MAGIC RESTORED${
        allRecovered
          ? '\nALL FIVE ARTIFACTS ARE HOME • HEAD OUTSIDE FOR THE PARTY!'
          : '\nWHEN READY, HEAD OUT FOR THE NEXT LOCATION.'
      }`,
    );
  }

  private createPostGameMenu(): void {
    this.add
      .rectangle(128, 148, 224, 134, 0x08111d, 0.96)
      .setStrokeStyle(3, 0xf6d77a);
    this.add
      .text(128, 96, 'THE QUEST IS COMPLETE', {
        color: '#73ddff',
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(128, 112, `FINAL SCORE • ${this.save?.stats.score ?? 0}`, {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
      })
      .setOrigin(0.5);
    this.postGameOptions = ['SEE HIGH SCORES', 'START NEW GAME'].map(
      (label, index) =>
        this.add
          .text(128, 145 + index * 30, label, {
            align: 'center',
            fontFamily: 'monospace',
            fontSize: '9px',
            fontStyle: 'bold',
            padding: { x: 12, y: 6 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            this.postGameIndex = index;
            this.activatePostGameOption();
          }),
    );
    this.add
      .text(128, 207, 'UP / DOWN • A / ENTER: CHOOSE', {
        color: '#bfeaff',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(0.5);
    this.refreshPostGameMenu();
  }

  private updatePostGameMenu(): void {
    if (!this.controls) return;
    if (this.highScorePanel) {
      if (
        this.controls.actions.get('confirm').pressed ||
        this.controls.actions.get('cancel').pressed ||
        this.controls.actions.get('jump').pressed
      ) {
        this.highScorePanel.destroy();
        this.highScorePanel = undefined;
      }
      return;
    }
    if (
      this.controls.actions.get('up').pressed ||
      this.controls.actions.get('down').pressed
    ) {
      this.postGameIndex = this.postGameIndex === 0 ? 1 : 0;
      gameAudio.play('select');
      this.refreshPostGameMenu();
    }
    if (
      this.controls.actions.get('confirm').pressed ||
      this.controls.actions.get('jump').pressed
    )
      this.activatePostGameOption();
  }

  private refreshPostGameMenu(): void {
    this.postGameOptions.forEach((option, index) =>
      option
        .setText(
          `${index === this.postGameIndex ? '▶ ' : ''}${option.text.replace(/^▶ /, '')}`,
        )
        .setColor(index === this.postGameIndex ? '#f6d77a' : '#ffffff')
        .setBackgroundColor(
          index === this.postGameIndex ? '#173f57' : '#0d202c',
        ),
    );
  }

  private activatePostGameOption(): void {
    gameAudio.play('confirm');
    if (this.postGameIndex === 1) {
      this.repository.clear();
      this.scene.start('team-select');
      return;
    }
    const scores = this.highScores.list();
    const lines = scores.length
      ? scores
          .slice(0, 10)
          .map(
            (entry, index) =>
              `${index + 1}. ${getTeam(entry.teamId).displayName.toUpperCase()}  ${entry.score}`,
          )
      : ['NO COMPLETED QUESTS RECORDED'];
    this.highScorePanel = this.add
      .text(128, 147, `HIGH SCORES\n\n${lines.join('\n')}\n\nA / B: BACK`, {
        align: 'center',
        backgroundColor: '#07111c',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '7px',
        lineSpacing: 3,
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(600);
    sharpenSceneText(this);
  }
}

