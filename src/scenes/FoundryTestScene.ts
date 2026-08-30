import Phaser from 'phaser';
import { DAD_SPRITE_SCALE, DAD_TEXTURE_KEY } from '../actors/dadAnimations';
import { applyDamage, type HealthState } from '../game/combat/damage';
import { awardFoundryVictory } from '../game/combat/foundryReward';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  prepareCheckpointRetry,
  recoverFromGameOver,
  resolveKnockout,
} from '../game/progression/lives';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const MOVE_SPEED = 78;
const JUMP_SPEED = 155;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 120;
const ATTACK_COOLDOWN_MS = 260;
const DRONE_SPEED = 24;
const DRONE_CHARGE_SPEED = 92;
const DRONE_WINDUP_MS = 420;
const DRONE_ATTACK_COOLDOWN_MS = 1350;
const PLAYER_INVULNERABLE_MS = 900;
const PLAYER_ATTACK_REACH = 19;
const DRONE_SCALE = 1.45;

export class FoundryTestScene extends Phaser.Scene {
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private drone?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private message?: Phaser.GameObjects.Text;
  private healthText?: Phaser.GameObjects.Text;
  private playerHealthText?: Phaser.GameObjects.Text;
  private save?: SaveData;
  private droneHealth: HealthState = { current: 3, maximum: 3 };
  private facing: -1 | 1 = 1;
  private lastGroundedAt = 0;
  private jumpBufferedUntil = 0;
  private nextAttackAt = 0;
  private attackingUntil = 0;
  private nextDroneAttackAt = 900;
  private droneChargingUntil = 0;
  private playerInvulnerableUntil = 0;
  private combatOver = false;
  private knockedOut = false;
  private gameOver = false;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('foundry-test');
  }

  create(): void {
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    this.save = {
      ...this.save,
      checkpointId: 'hillsboro_west_foundry_entry',
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);

    this.drawRoom();
    this.createTextures();
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls, {
      primary: 'jump',
      secondary: 'attack',
    });

    const floor = this.add.rectangle(128, 224, 256, 32, 0x53352a);
    this.physics.add.existing(floor, true);

    this.player = this.physics.add.sprite(
      80,
      185,
      DAD_TEXTURE_KEY,
      'dad-idle-0',
    );
    this.player
      .setScale(DAD_SPRITE_SCALE)
      .setCollideWorldBounds(true)
      .setGravityY(420)
      .play('dad-idle');
    this.player.body.setSize(210, 500).setOffset(30, 150);
    this.physics.add.collider(this.player, floor);

    this.drone = this.physics.add.sprite(154, 200, 'training-drone');
    this.drone
      .setScale(DRONE_SCALE)
      .setCollideWorldBounds(true)
      .setImmovable(true);
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
    this.playerHealthText = this.add.text(7, 34, '', {
      color: '#8fe3ff',
      fontFamily: 'monospace',
      fontSize: '7px',
    });
    this.refreshDroneHealth();
    this.refreshPlayerHealth();

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
    if (!this.controls || !this.player || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));

    if (this.combatOver) {
      this.player.setVelocityX(0);
      if (!this.knockedOut) this.player.play('dad-idle', true);
      if (
        this.controls.actions.get('confirm').pressed ||
        this.controls.actions.get('cancel').pressed ||
        this.controls.actions.get('jump').pressed ||
        this.controls.actions.get('attack').pressed
      ) {
        if (this.knockedOut) {
          if (this.gameOver) {
            this.save = recoverFromGameOver(
              this.save,
              new Date().toISOString(),
            );
            this.repository.save(this.save);
            this.scene.start('blue-hole-hub');
          } else {
            this.save = prepareCheckpointRetry(
              this.save,
              new Date().toISOString(),
            );
            this.repository.save(this.save);
            this.scene.restart();
          }
        } else this.scene.start('blue-hole-hub');
      }
      return;
    }

    const horizontal =
      Number(this.controls.actions.get('right').down) -
      Number(this.controls.actions.get('left').down);
    this.player.setVelocityX(horizontal * MOVE_SPEED);
    if (horizontal !== 0) {
      this.facing = horizontal < 0 ? -1 : 1;
      this.player.setFlipX(horizontal < 0);
    }

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
    if (time >= this.attackingUntil) {
      if (!this.player.body.blocked.down) this.player.setFrame('dad-jump');
      else this.player.play(horizontal === 0 ? 'dad-idle' : 'dad-walk', true);
    }
    this.updateDrone(time);
    if (this.controls.actions.get('cancel').pressed)
      this.scene.start('highway-26');
  }

  private updateDrone(time: number): void {
    if (!this.drone?.active || !this.player || !this.save) return;
    const distance = this.player.x - this.drone.x;

    if (time < this.droneChargingUntil) {
      if (Math.abs(distance) < 22 && time >= this.playerInvulnerableUntil)
        this.damagePlayer(time, Math.sign(distance) || 1);
      return;
    }

    if (this.droneChargingUntil > 0) {
      this.droneChargingUntil = 0;
      this.drone.setVelocityX(0).clearTint();
      this.nextDroneAttackAt = time + DRONE_ATTACK_COOLDOWN_MS;
    }

    if (time >= this.nextDroneAttackAt && Math.abs(distance) < 82) {
      this.nextDroneAttackAt = Number.POSITIVE_INFINITY;
      this.drone.setVelocityX(0).setTint(0xff6b55);
      this.message?.setText('DRONE LOCKED ON • JUMP OR MOVE!');
      this.time.delayedCall(DRONE_WINDUP_MS, () => {
        if (!this.drone?.active || !this.player) return;
        const direction = this.player.x < this.drone.x ? -1 : 1;
        this.drone
          .setTint(0xffd36a)
          .setVelocityX(direction * DRONE_CHARGE_SPEED);
        this.droneChargingUntil = this.time.now + 520;
      });
      return;
    }

    if (Number.isFinite(this.nextDroneAttackAt))
      this.drone.setVelocityX(Math.sign(distance) * DRONE_SPEED);
  }

  private damagePlayer(time: number, knockbackDirection: number): void {
    if (!this.player || !this.save) return;
    this.playerInvulnerableUntil = time + PLAYER_INVULNERABLE_MS;
    const result = applyDamage(
      {
        current: this.save.resources.life,
        maximum: this.save.resources.maxLife,
      },
      1,
    );
    this.save = {
      ...this.save,
      resources: { ...this.save.resources, life: result.health.current },
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);
    this.player.setVelocity(knockbackDirection * 92, -92).setTintFill(0xff6b55);
    this.cameras.main.shake(110, 0.006);
    this.time.delayedCall(180, () => {
      if (!this.knockedOut) this.player?.clearTint();
    });
    this.refreshPlayerHealth();

    if (result.defeated) {
      const knockout = resolveKnockout(this.save, new Date().toISOString());
      this.save = knockout.save;
      this.repository.save(this.save);
      this.combatOver = true;
      this.knockedOut = true;
      this.gameOver = knockout.gameOver;
      this.drone?.setVelocityX(0);
      this.player
        .setVelocity(0, 0)
        .setAngle(90)
        .setAlpha(0.7)
        .setTint(0xb94b4b);
      this.message?.setText(
        knockout.gameOver
          ? 'GAME OVER • ENTER / A: RECOVER HOME (-25% EXP)'
          : `KNOCKED OUT • ${this.save.resources.lives} LIVES LEFT • ENTER / A: RETRY`,
      );
      this.refreshPlayerHealth();
    } else {
      this.message?.setText(
        `DRONE HIT • ${result.health.current} LIFE REMAINS`,
      );
    }
  }

  private attack(time: number): void {
    if (!this.player) return;
    this.nextAttackAt = time + ATTACK_COOLDOWN_MS;
    this.attackingUntil = time + 210;
    this.player.play('dad-attack', true);
    const attackX = this.player.x + this.facing * PLAYER_ATTACK_REACH;
    const effect = this.add.rectangle(
      attackX,
      this.player.y,
      25,
      10,
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
      attackX - 13,
      this.player.y - 8,
      26,
      16,
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
      this.completeVictory();
      this.healthText?.setText('');
    } else {
      this.refreshDroneHealth();
    }
  }

  private completeVictory(): void {
    if (!this.save) return;
    const reward = awardFoundryVictory(this.save, new Date().toISOString());
    const firstVictory = reward.firstVictory;
    this.save = reward.save;
    this.repository.save(this.save);
    this.combatOver = true;
    this.add
      .circle(154, 184, 8, 0x78c8e8)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(20);
    this.message?.setText(
      firstVictory
        ? 'CRYSTAL HOUND RECOVERED • POWER WRENCH LEARNED\n+100 EXP • ENTER / A: RETURN HOME'
        : 'DRONE DEFEATED • ENTER / A: RETURN HOME',
    );
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

  private refreshPlayerHealth(): void {
    if (!this.save) return;
    this.playerHealthText?.setText(
      `DAD HP ${this.save.resources.life}/${this.save.resources.maxLife}  LIVES ${this.save.resources.lives}/${this.save.resources.maxLives}`,
    );
  }
}
