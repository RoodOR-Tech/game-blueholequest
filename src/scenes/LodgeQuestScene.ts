import Phaser from 'phaser';
import { DAD_SPRITE_SCALE, DAD_TEXTURE_KEY } from '../actors/dadAnimations';
import { applyDamage, type HealthState } from '../game/combat/damage';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  recoverFromGameOver,
  resolveKnockout,
} from '../game/progression/lives';
import { awardLodgeRelic } from '../game/progression/lodgeReward';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const MOVE_SPEED = 62;
const ATTACK_COOLDOWN_MS = 280;
const BARREL_INTERVAL_MS = 1350;

export class LodgeQuestScene extends Phaser.Scene {
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private boss?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private bossHealth: HealthState = { current: 6, maximum: 6 };
  private barrels: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[] = [];
  private save?: SaveData;
  private hud?: Phaser.GameObjects.Text;
  private message?: Phaser.GameObjects.Text;
  private facing = new Phaser.Math.Vector2(1, 0);
  private nextAttackAt = 0;
  private attackingUntil = 0;
  private nextBarrelAt = 900;
  private invulnerableUntil = 0;
  private encounterOver = false;
  private knockedOut = false;
  private gameOver = false;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('lodge-quest');
  }

  create(): void {
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    this.drawLodge();
    this.createTextures();
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls, {
      primary: 'attack',
      secondary: 'cancel',
    });
    this.player = this.physics.add.sprite(
      48,
      155,
      DAD_TEXTURE_KEY,
      'dad-idle-0',
    );
    this.player
      .setScale(DAD_SPRITE_SCALE)
      .setCollideWorldBounds(true)
      .play('dad-idle');
    this.player.body.setSize(210, 500).setOffset(30, 150);
    this.boss = this.physics.add.sprite(211, 126, 'keg-golem');
    this.boss.setImmovable(true);
    this.boss.body.setAllowGravity(false);
    this.createHud();
    this.message?.setText('CAMP 18 LODGE • THE KEG GOLEM HAS THE AMBER STEIN');
  }

  update(time: number): void {
    if (!this.controls || !this.player || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (this.encounterOver) {
      this.player.setVelocity(0, 0).play('dad-idle', true);
      if (
        this.controls.actions.get('confirm').pressed ||
        this.controls.actions.get('attack').pressed ||
        this.controls.actions.get('cancel').pressed
      ) {
        if (this.knockedOut) {
          if (this.gameOver) {
            this.save = recoverFromGameOver(
              this.save,
              new Date().toISOString(),
            );
            this.repository.save(this.save);
            this.scene.start('blue-hole-hub');
          } else this.scene.restart();
        } else this.scene.start('blue-hole-hub');
      }
      return;
    }

    const horizontal =
      Number(this.controls.actions.get('right').down) -
      Number(this.controls.actions.get('left').down);
    const vertical =
      Number(this.controls.actions.get('down').down) -
      Number(this.controls.actions.get('up').down);
    const movement = new Phaser.Math.Vector2(horizontal, vertical).normalize();
    this.player.setVelocity(movement.x * MOVE_SPEED, movement.y * MOVE_SPEED);
    if (movement.lengthSq() > 0) {
      this.facing.copy(movement);
      if (horizontal !== 0) this.player.setFlipX(horizontal < 0);
    }
    this.player.play(movement.lengthSq() > 0 ? 'dad-walk' : 'dad-idle', true);
    this.player.y = Phaser.Math.Clamp(this.player.y, 91, 193);

    if (
      this.controls.actions.get('attack').pressed &&
      time >= this.nextAttackAt
    )
      this.attack(time);
    if (time < this.attackingUntil) this.player.play('dad-attack', true);
    if (time >= this.nextBarrelAt && this.boss?.active) this.launchBarrel(time);
    this.updateBarrels(time);
    if (this.controls.actions.get('cancel').pressed)
      this.scene.start('highway-26');
  }

  private attack(time: number): void {
    if (!this.player) return;
    this.nextAttackAt = time + ATTACK_COOLDOWN_MS;
    this.attackingUntil = time + 210;
    const hitX = this.player.x + this.facing.x * 22;
    const hitY = this.player.y + this.facing.y * 22;
    const effect = this.add.circle(hitX, hitY, 11, 0xffd36a, 0.72);
    this.tweens.add({
      targets: effect,
      alpha: 0,
      duration: 100,
      onComplete: () => effect.destroy(),
    });
    const hitBounds = new Phaser.Geom.Rectangle(hitX - 13, hitY - 13, 26, 26);
    const barrel = this.barrels.find(
      (candidate) =>
        candidate.active &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          hitBounds,
          candidate.getBounds(),
        ),
    );
    if (barrel) {
      barrel.destroy();
      this.message?.setText('BARREL SMASHED • KEEP MOVING!');
      return;
    }
    if (
      !this.boss?.active ||
      !Phaser.Geom.Intersects.RectangleToRectangle(
        hitBounds,
        this.boss.getBounds(),
      )
    )
      return;
    const result = applyDamage(this.bossHealth, 1);
    this.bossHealth = result.health;
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(80, () => this.boss?.clearTint());
    if (result.defeated) this.completeVictory();
    else {
      this.message?.setText(
        `KEG GOLEM • ${result.health.current}/${result.health.maximum}`,
      );
      this.refreshHud();
    }
  }

  private launchBarrel(time: number): void {
    if (!this.boss || !this.player) return;
    this.nextBarrelAt = time + BARREL_INTERVAL_MS;
    const barrel = this.physics.add.sprite(
      this.boss.x - 8,
      this.boss.y + 8,
      'rolling-barrel',
    );
    barrel.body.setAllowGravity(false);
    const direction = new Phaser.Math.Vector2(
      this.player.x - barrel.x,
      this.player.y - barrel.y,
    ).normalize();
    barrel.setVelocity(direction.x * 76, direction.y * 76);
    this.barrels.push(barrel);
    this.boss.setTint(0xffc45c);
    this.time.delayedCall(130, () => this.boss?.clearTint());
    this.message?.setText('INCOMING BARREL • DODGE OR SMASH IT!');
  }

  private updateBarrels(time: number): void {
    if (!this.player) return;
    this.barrels = this.barrels.filter((barrel) => {
      if (!barrel.active) return false;
      barrel.rotation += 0.14;
      if (barrel.x < -12 || barrel.x > 268 || barrel.y < 73 || barrel.y > 220) {
        barrel.destroy();
        return false;
      }
      if (
        time >= this.invulnerableUntil &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          this.player!.getBounds(),
          barrel.getBounds(),
        )
      ) {
        barrel.destroy();
        this.damagePlayer(time);
        return false;
      }
      return true;
    });
  }

  private damagePlayer(time: number): void {
    if (!this.player || !this.save) return;
    this.invulnerableUntil = time + 900;
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
    this.player.setTintFill(0xff6655);
    this.cameras.main.shake(100, 0.006);
    this.time.delayedCall(180, () => this.player?.clearTint());
    if (result.defeated) {
      const knockout = resolveKnockout(this.save, new Date().toISOString());
      this.save = knockout.save;
      this.repository.save(this.save);
      this.encounterOver = true;
      this.knockedOut = true;
      this.gameOver = knockout.gameOver;
      this.message?.setText(
        knockout.gameOver
          ? 'GAME OVER • ATTACK / A: RECOVER HOME (-25% EXP)'
          : `KNOCKED OUT • ${this.save.resources.lives} LIVES LEFT • ATTACK / A: RETRY`,
      );
    } else
      this.message?.setText(`BARREL HIT • ${result.health.current} HP REMAINS`);
    this.refreshHud();
  }

  private completeVictory(): void {
    if (!this.save || !this.boss) return;
    const rewardX = this.boss.x;
    const rewardY = this.boss.y;
    this.boss.destroy();
    this.barrels.forEach((barrel) => barrel.destroy());
    this.barrels = [];
    this.save = awardLodgeRelic(this.save, new Date().toISOString());
    this.repository.save(this.save);
    this.encounterOver = true;
    this.add
      .rectangle(rewardX, rewardY, 14, 12, 0xd58c2e)
      .setStrokeStyle(2, 0xffe2a1);
    this.message?.setText(
      'AMBER STEIN RECOVERED • +90 EXP\nATTACK / A: RETURN HOME',
    );
    this.refreshHud();
  }

  private createHud(): void {
    this.hud = this.add.text(7, 7, '', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '7px',
    });
    this.message = this.add
      .text(128, 53, '', {
        align: 'center',
        backgroundColor: '#17100ddd',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '6px',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5);
    this.refreshHud();
  }

  private refreshHud(): void {
    if (!this.save) return;
    this.hud?.setText(
      `CAMP 18 • HP ${this.save.resources.life}/${this.save.resources.maxLife} • LIVES ${this.save.resources.lives}/${this.save.resources.maxLives} • GOLEM ${this.bossHealth.current}/${this.bossHealth.maximum}`,
    );
  }

  private drawLodge(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x2d1d18).fillRect(0, 0, 256, 240);
    graphics.fillStyle(0x6f4229).fillRect(0, 73, 256, 137);
    graphics.lineStyle(2, 0x3c251a);
    for (let y = 79; y < 210; y += 15) graphics.lineBetween(0, y, 256, y);
    graphics.fillStyle(0x261613).fillRect(176, 84, 64, 86);
    graphics.fillStyle(0xe89631).fillCircle(208, 125, 28);
    graphics.fillStyle(0x151110).fillCircle(208, 125, 20);
    graphics.fillStyle(0x4a2a1c).fillRect(0, 210, 256, 30);
    graphics.lineStyle(1, 0x7d5132);
    for (let x = 0; x < 256; x += 32) graphics.lineBetween(x, 210, x, 240);
    this.add.text(7, 25, 'MOVE: D-PAD • WRENCH: A / X • B / ESC: LEAVE', {
      color: '#f2d8b0',
      fontFamily: 'monospace',
      fontSize: '6px',
    });
  }

  private createTextures(): void {
    if (!this.textures.exists('rolling-barrel')) {
      const barrel = this.add.graphics();
      barrel.fillStyle(0x8b542f).fillCircle(7, 7, 7);
      barrel
        .lineStyle(2, 0x2b211b)
        .strokeCircle(7, 7, 6)
        .lineBetween(1, 7, 13, 7);
      barrel.generateTexture('rolling-barrel', 14, 14).destroy();
    }
    if (!this.textures.exists('keg-golem')) {
      const golem = this.add.graphics();
      golem.fillStyle(0x9b6134).fillRoundedRect(3, 2, 31, 39, 8);
      golem.lineStyle(3, 0x3b2920).strokeRoundedRect(3, 2, 31, 39, 8);
      golem.fillStyle(0xffcf58).fillCircle(12, 15, 3).fillCircle(25, 15, 3);
      golem.fillStyle(0x3b2920).fillRect(0, 16, 5, 18).fillRect(32, 16, 5, 18);
      golem.generateTexture('keg-golem', 37, 43).destroy();
    }
  }
}
