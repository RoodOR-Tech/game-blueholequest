import Phaser from 'phaser';
import { applyDamage, type HealthState } from '../game/combat/damage';
import { PhaserInput } from '../game/input/PhaserInput';
import { SaveRepository } from '../game/saves/repository';
import { TouchControls } from '../ui/TouchControls';

const MOVE_SPEED = 78;
const JUMP_SPEED = 155;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 120;
const ATTACK_COOLDOWN_MS = 260;

export class FoundryTestScene extends Phaser.Scene {
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private drone?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private message?: Phaser.GameObjects.Text;
  private healthText?: Phaser.GameObjects.Text;
  private droneHealth: HealthState = { current: 3, maximum: 3 };
  private facing: -1 | 1 = 1;
  private lastGroundedAt = 0;
  private jumpBufferedUntil = 0;
  private nextAttackAt = 0;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('foundry-test');
  }

  create(): void {
    const save = this.repository.load();
    if (!save) {
      this.scene.start('team-select');
      return;
    }
    this.repository.save({
      ...save,
      checkpointId: 'hillsboro_west_foundry_entry',
      savedAt: new Date().toISOString(),
    });

    this.drawRoom();
    this.createTextures();
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls, {
      primary: 'jump',
      secondary: 'attack',
    });

    const floor = this.add.rectangle(128, 224, 256, 32, 0x53352a);
    this.physics.add.existing(floor, true);

    this.player = this.physics.add.sprite(80, 185, 'foundry-player');
    this.player.setCollideWorldBounds(true).setGravityY(420);
    this.player.body.setSize(12, 20);
    this.physics.add.collider(this.player, floor);

    this.drone = this.physics.add.sprite(154, 200, 'training-drone');
    this.drone.setCollideWorldBounds(true).setImmovable(true);
    this.drone.body.setAllowGravity(false);
    this.drone.body.setSize(16, 14);

    this.message = this.add
      .text(128, 139, 'TRAINING ROOM • DEFEAT THE SILICON DRONE', {
        align: 'center',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '7px',
      })
      .setOrigin(0.5);
    this.healthText = this.add.text(158, 164, '', {
      color: '#ff9c82',
      fontFamily: 'monospace',
      fontSize: '6px',
    });
    this.refreshDroneHealth();

    this.add
      .text(230, 9, 'HOME', {
        backgroundColor: '#08111dcc',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('highway-26'));
  }

  update(time: number): void {
    if (!this.controls || !this.player) return;
    this.controls.update(this.input.gamepad?.getPad(0));

    const horizontal =
      Number(this.controls.actions.get('right').down) -
      Number(this.controls.actions.get('left').down);
    this.player.setVelocityX(horizontal * MOVE_SPEED);
    if (horizontal !== 0) this.facing = horizontal < 0 ? -1 : 1;

    if (this.player.body.blocked.down) this.lastGroundedAt = time;
    if (this.controls.actions.get('jump').pressed)
      this.jumpBufferedUntil = time + JUMP_BUFFER_MS;
    if (
      this.jumpBufferedUntil >= time &&
      time - this.lastGroundedAt <= COYOTE_MS &&
      this.player.body.velocity.y >= 0
    ) {
      this.player.setVelocityY(-JUMP_SPEED);
      this.jumpBufferedUntil = 0;
    }

    if (
      this.controls.actions.get('attack').pressed &&
      time >= this.nextAttackAt
    ) {
      this.attack(time);
    }
    if (this.controls.actions.get('cancel').pressed)
      this.scene.start('highway-26');
  }

  private attack(time: number): void {
    if (!this.player) return;
    this.nextAttackAt = time + ATTACK_COOLDOWN_MS;
    const attackX = this.player.x + this.facing * 13;
    const effect = this.add.rectangle(
      attackX,
      this.player.y,
      18,
      7,
      0xf6d77a,
      0.78,
    );
    this.tweens.add({
      targets: effect,
      alpha: 0,
      duration: 100,
      onComplete: () => effect.destroy(),
    });

    if (!this.drone?.active) return;
    const attackBounds = new Phaser.Geom.Rectangle(
      attackX - 9,
      this.player.y - 5,
      18,
      10,
    );
    if (
      !Phaser.Geom.Intersects.RectangleToRectangle(
        attackBounds,
        this.drone.getBounds(),
      )
    )
      return;

    const result = applyDamage(this.droneHealth, 1);
    this.droneHealth = result.health;
    this.drone.setTintFill(0xffffff);
    this.time.delayedCall(70, () => this.drone?.clearTint());
    if (result.defeated) {
      this.drone.destroy();
      this.message?.setText('DRONE DEFEATED • WRENCH COMBAT ONLINE');
      this.healthText?.setText('');
    } else {
      this.refreshDroneHealth();
    }
  }

  private drawRoom(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x111b23).fillRect(0, 0, 256, 240);
    graphics.fillStyle(0x6b3424).fillRect(0, 34, 256, 92);
    graphics.lineStyle(2, 0x9d5938);
    for (let x = 0; x < 256; x += 24) graphics.strokeRect(x, 34, 24, 15);
    graphics.fillStyle(0x28343b).fillRect(0, 126, 256, 98);
    graphics.fillStyle(0x9aa4a5).fillRect(18, 82, 74, 8);
    graphics
      .fillStyle(0x52626a)
      .fillRect(21, 90, 7, 36)
      .fillRect(81, 90, 7, 36);
    graphics.fillStyle(0x18384a).fillRect(108, 60, 122, 50);
    graphics.lineStyle(2, 0xb16a3f).strokeRect(108, 60, 122, 50);

    this.add.text(7, 8, 'HILLSBORO WEST • SILICON & SAWDUST FOUNDRY', {
      color: '#f6d77a',
      fontFamily: 'monospace',
      fontSize: '7px',
      fontStyle: 'bold',
    });
    this.add.text(7, 21, 'MOVE: ARROWS  JUMP: Z/A  WRENCH: X/B  ESC: RETURN', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '6px',
    });
  }

  private createTextures(): void {
    if (!this.textures.exists('foundry-player')) {
      const player = this.add.graphics();
      player.fillStyle(0x5cb8e6).fillRect(0, 0, 12, 20);
      player.fillStyle(0xf2c49b).fillRect(3, 2, 6, 6);
      player.fillStyle(0x263d4e).fillRect(2, 10, 8, 8);
      player.generateTexture('foundry-player', 12, 20).destroy();
    }
    if (!this.textures.exists('training-drone')) {
      const drone = this.add.graphics();
      drone.fillStyle(0x8ca4ad).fillRect(0, 3, 16, 10);
      drone.fillStyle(0xe35d4f).fillRect(6, 0, 4, 4);
      drone.fillStyle(0x263d4e).fillRect(2, 13, 3, 3).fillRect(11, 13, 3, 3);
      drone.generateTexture('training-drone', 16, 16).destroy();
    }
  }

  private refreshDroneHealth(): void {
    this.healthText?.setText(
      `DRONE ${this.droneHealth.current}/${this.droneHealth.maximum}`,
    );
  }
}

