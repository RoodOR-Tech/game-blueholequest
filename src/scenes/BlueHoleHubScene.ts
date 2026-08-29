import Phaser from 'phaser';
import { getTeam } from '../content/teams';
import { PhaserInput } from '../game/input/PhaserInput';
import { recoveredRelicCount, RELIC_IDS } from '../game/progression/relics';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';

const PLAYER_SPEED = 58;
const INTERACTION_DISTANCE = 31;

interface HubFixture {
  readonly id: 'fridge' | 'mantle' | 'exit';
  readonly x: number;
  readonly y: number;
}

const FIXTURES: readonly HubFixture[] = [
  { id: 'fridge', x: 35, y: 113 },
  { id: 'mantle', x: 191, y: 99 },
  { id: 'exit', x: 128, y: 218 },
];

export class BlueHoleHubScene extends Phaser.Scene {
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private prompt?: Phaser.GameObjects.Text;
  private message?: Phaser.GameObjects.Text;
  private hud?: Phaser.GameObjects.Text;
  private mantleSockets: Phaser.GameObjects.Arc[] = [];
  private save?: SaveData;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('blue-hole-hub');
  }

  create(): void {
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }

    this.drawRoom();
    this.controls = new PhaserInput(this);
    this.createPlayer();
    this.createInterface();
    this.refreshHud();
    this.refreshMantle();
  }

  update(): void {
    if (!this.controls || !this.player || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));

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

    // Beach-access exit mat. The player begins close enough to see its prompt.
    graphics.fillStyle(0x172a35).fillRoundedRect(105, 211, 46, 18, 2);
    graphics.lineStyle(1, 0xf6d77a).strokeRoundedRect(105, 211, 46, 18, 2);
    this.add
      .text(128, 217, 'TO HWY 26', {
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
    if (!this.textures.exists('player-placeholder')) {
      const texture = this.add.graphics();
      texture.fillStyle(0x5cb8e6).fillRect(0, 0, 12, 20);
      texture.fillStyle(0xf2c49b).fillRect(3, 2, 6, 6);
      texture.fillStyle(0x183b56).fillRect(2, 10, 8, 8);
      texture.generateTexture('player-placeholder', 12, 20);
      texture.destroy();
    }
    const player = this.physics.add.sprite(128, 190, 'player-placeholder');
    player.setCollideWorldBounds(true);
    player.body.setSize(12, 20);
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
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '6px',
        wordWrap: { width: 232 },
      })
      .setOrigin(0.5);
  }

  private nearestFixture(): HubFixture | undefined {
    if (!this.player) return undefined;
    return FIXTURES.find(
      (fixture) =>
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
      this.scene.start('highway-26');
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
        'FRIDGE CHECKED • LIFE & MAGIC RESTORED • GAME SAVED',
      );
      this.cameras.main.flash(130, 140, 220, 255, false);
      this.refreshHud();
      return;
    }

    const count = recoveredRelicCount(this.save.relics);
    this.message.setText(
      count === RELIC_IDS.length
        ? 'ALL FIVE RELICS RESTORED • THE HOLIDAY HEARTH BURNS BRIGHT!'
        : `THE HEARTH IS COLD • ${count} / ${RELIC_IDS.length} RELICS RESTORED`,
    );
  }

  private refreshHud(): void {
    if (!this.save || !this.hud) return;
    const team = getTeam(this.save.activeTeamId);
    this.hud.setText(
      `${team.displayName.toUpperCase()}  LIFE ${this.save.resources.life}/${this.save.resources.maxLife}  MAGIC ${this.save.resources.magic}/${this.save.resources.maxMagic}`,
    );
  }

  private refreshMantle(): void {
    if (!this.save) return;
    const recovered = new Set(this.save.relics);
    this.mantleSockets.forEach((socket, index) => {
      const id = RELIC_IDS[index];
      socket.setFillStyle(id && recovered.has(id) ? 0x74d7f2 : 0x10161c);
    });
  }
}

