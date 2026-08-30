import Phaser from 'phaser';
import { DAD_SPRITE_SCALE, DAD_TEXTURE_KEY } from '../actors/dadAnimations';
import { applyDamage, type HealthState } from '../game/combat/damage';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  awardLocationCrystal,
  bossLocationById,
  bossLocationForCheckpoint,
  type BossLocation,
} from '../game/progression/bossLocations';
import { saveAtCheckpoint } from '../game/progression/checkpoints';
import {
  prepareCheckpointRetry,
  recoverFromGameOver,
  resolveKnockout,
} from '../game/progression/lives';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const MOVE_SPEED = 68;
const ATTACK_COOLDOWN = 270;
const INVULNERABLE_MS = 850;

export class LocationBossScene extends Phaser.Scene {
  private locationId?: string;
  private location!: BossLocation;
  private save?: SaveData;
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private boss?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private crystal?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private projectiles: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[] = [];
  private bossHealth: HealthState = { current: 1, maximum: 1 };
  private hud?: Phaser.GameObjects.Text;
  private message?: Phaser.GameObjects.Text;
  private facing = new Phaser.Math.Vector2(1, 0);
  private nextAttackAt = 0;
  private attackingUntil = 0;
  private nextBossAttackAt = 800;
  private invulnerableUntil = 0;
  private encounterOver = false;
  private knockedOut = false;
  private gameOver = false;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('location-boss');
  }

  init(data: { locationId?: string }): void {
    this.locationId = data.locationId;
  }

  create(): void {
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    this.location =
      (this.locationId && bossLocationById(this.locationId)) ||
      bossLocationForCheckpoint(this.save.checkpointId) ||
      bossLocationById('hillsboro_west');
    this.resetEncounter();
    this.save = saveAtCheckpoint(
      this.save,
      this.location.checkpointId,
      new Date().toISOString(),
    );
    this.repository.save(this.save);
    this.drawArena();
    this.createTextures();
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls, {
      primary: 'attack',
      secondary: 'cancel',
    });
    this.player = this.physics.add.sprite(
      45,
      177,
      DAD_TEXTURE_KEY,
      'dad-idle-0',
    );
    this.player
      .setScale(DAD_SPRITE_SCALE)
      .setCollideWorldBounds(true)
      .play('dad-idle');
    this.player.body.setSize(210, 500).setOffset(30, 150);
    this.boss = this.physics.add.sprite(205, 145, 'location-boss-sprite');
    this.boss.setImmovable(true);
    this.boss.body.setAllowGravity(false);
    this.boss.body.setSize(34, 42);
    this.bossHealth = {
      current: this.location.maximumHealth,
      maximum: this.location.maximumHealth,
    };
    this.drawSavePoint(42, 200);
    this.createHud();
    this.message?.setText(
      `CHECKPOINT SAVED • DEFEAT THE ${this.location.bossName}`,
    );
  }

  update(time: number): void {
    if (!this.controls || !this.player || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (this.encounterOver) {
      this.player.setVelocity(0, 0);
      if (
        this.controls.actions.get('confirm').pressed ||
        this.controls.actions.get('attack').pressed
      ) {
        if (this.knockedOut) this.retryAfterKnockout();
        else this.scene.start('highway-26');
      }
      return;
    }

    const x =
      Number(this.controls.actions.get('right').down) -
      Number(this.controls.actions.get('left').down);
    const y =
      Number(this.controls.actions.get('down').down) -
      Number(this.controls.actions.get('up').down);
    const movement = new Phaser.Math.Vector2(x, y).normalize();
    this.player.setVelocity(movement.x * MOVE_SPEED, movement.y * MOVE_SPEED);
    this.player.y = Phaser.Math.Clamp(this.player.y, 83, 211);
    if (movement.lengthSq() > 0) {
      this.facing.copy(movement);
      if (x !== 0) this.player.setFlipX(x < 0);
    }
    this.player.play(movement.lengthSq() ? 'dad-walk' : 'dad-idle', true);

    if (
      this.controls.actions.get('attack').pressed &&
      time >= this.nextAttackAt
    )
      this.attack(time);
    if (time < this.attackingUntil) this.player.play('dad-attack', true);
    if (time >= this.nextBossAttackAt && this.boss?.active)
      this.bossAttack(time);
    this.updateProjectiles(time);
    if (this.controls.actions.get('cancel').pressed)
      this.scene.start('highway-26');
  }

  private resetEncounter(): void {
    this.projectiles = [];
    this.facing.set(1, 0);
    this.nextAttackAt = 0;
    this.attackingUntil = 0;
    this.nextBossAttackAt = 800;
    this.invulnerableUntil = 0;
    this.encounterOver = false;
    this.knockedOut = false;
    this.gameOver = false;
  }

  private attack(time: number): void {
    if (!this.player) return;
    this.nextAttackAt = time + ATTACK_COOLDOWN;
    this.attackingUntil = time + 190;
    const hitX = this.player.x + this.facing.x * 24;
    const hitY = this.player.y + this.facing.y * 24;
    const slash = this.add.circle(hitX, hitY, 12, 0xffe08a, 0.7);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 100,
      onComplete: () => slash.destroy(),
    });
    const hit = new Phaser.Geom.Rectangle(hitX - 13, hitY - 13, 26, 26);
    const projectile = this.projectiles.find(
      (shot) =>
        shot.active &&
        Phaser.Geom.Intersects.RectangleToRectangle(hit, shot.getBounds()),
    );
    if (projectile) {
      projectile.destroy();
      this.message?.setText('PROJECTILE DEFLECTED!');
      return;
    }
    if (
      !this.boss?.active ||
      !Phaser.Geom.Intersects.RectangleToRectangle(hit, this.boss.getBounds())
    )
      return;
    const result = applyDamage(this.bossHealth, 1);
    this.bossHealth = result.health;
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(90, () => this.boss?.clearTint());
    if (result.defeated) this.defeatBoss();
    else this.message?.setText(
      `${this.location.bossName} • ${result.health.current}/${result.health.maximum}`,
    );
    this.refreshHud();
  }

  private bossAttack(time: number): void {
    if (!this.boss || !this.player) return;
    this.nextBossAttackAt = time + this.location.attackInterval;
    const base = new Phaser.Math.Vector2(
      this.player.x - this.boss.x,
      this.player.y - this.boss.y,
    ).normalize();
    const locationIndex = [
      'hillsboro_west',
      'hillsboro_east',
      'milwaukie',
      'walla_walla',
      'bend',
    ].indexOf(this.location.id);
    const spread = locationIndex >= 3 ? [-0.3, 0, 0.3] : locationIndex >= 1 ? [-0.18, 0.18] : [0];
    spread.forEach((angle) => {
      const direction = base.clone().rotate(angle);
      const shot = this.physics.add.sprite(
        this.boss!.x,
        this.boss!.y,
        'boss-projectile',
      );
      shot.body.setAllowGravity(false);
      shot.setVelocity(
        direction.x * this.location.projectileSpeed,
        direction.y * this.location.projectileSpeed,
      );
      this.projectiles.push(shot);
    });
    this.boss.setTint(this.location.color);
    this.time.delayedCall(130, () => this.boss?.clearTint());
    this.message?.setText(
      spread.length === 1 ? 'INCOMING SHOT • MOVE!' : 'SPREAD ATTACK • FIND THE GAP!',
    );
  }

  private updateProjectiles(time: number): void {
    if (!this.player) return;
    this.projectiles = this.projectiles.filter((shot) => {
      if (!shot.active) return false;
      shot.rotation += 0.12;
      if (shot.x < -10 || shot.x > 266 || shot.y < 65 || shot.y > 245) {
        shot.destroy();
        return false;
      }
      if (
        time >= this.invulnerableUntil &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          this.player!.getBounds(),
          shot.getBounds(),
        )
      ) {
        shot.destroy();
        this.damagePlayer(time);
        return false;
      }
      return true;
    });
  }

  private damagePlayer(time: number): void {
    if (!this.player || !this.save) return;
    this.invulnerableUntil = time + INVULNERABLE_MS;
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
    if (!result.defeated) {
      this.message?.setText(`HIT • ${result.health.current} HP REMAINS`);
      this.refreshHud();
      return;
    }
    const knockout = resolveKnockout(this.save, new Date().toISOString());
    this.save = knockout.save;
    this.repository.save(this.save);
    this.encounterOver = true;
    this.knockedOut = true;
    this.gameOver = knockout.gameOver;
    this.projectiles.forEach((shot) => shot.destroy());
    this.player.setVelocity(0, 0).setAngle(90).setAlpha(0.7).setTint(0xb94b4b);
    this.message?.setText(
      knockout.gameOver
        ? 'GAME OVER • A: RECOVER HOME (-25% EXP)'
        : `KNOCKED OUT • ${this.save.resources.lives} LIVES LEFT • A: RETRY`,
    );
    this.refreshHud();
  }

  private retryAfterKnockout(): void {
    if (!this.save) return;
    if (this.gameOver) {
      this.save = recoverFromGameOver(this.save, new Date().toISOString());
      this.repository.save(this.save);
      this.scene.start('blue-hole-hub');
      return;
    }
    this.save = prepareCheckpointRetry(this.save, new Date().toISOString());
    this.repository.save(this.save);
    this.scene.restart({ locationId: this.location.id });
  }

  private defeatBoss(): void {
    if (!this.boss) return;
    const x = this.boss.x;
    const y = this.boss.y;
    this.boss.destroy();
    this.projectiles.forEach((shot) => shot.destroy());
    this.projectiles = [];
    this.crystal = this.physics.add.sprite(x, y, 'location-crystal');
    this.crystal.body.setAllowGravity(false);
    this.tweens.add({
      targets: this.crystal,
      y: y - 8,
      yoyo: true,
      repeat: -1,
      duration: 520,
    });
    if (this.player)
      this.physics.add.overlap(this.player, this.crystal, () =>
        this.collectCrystal(),
      );
    this.message?.setText(
      `${this.location.bossName} DEFEATED • CLAIM THE CRYSTAL!`,
    );
    this.refreshHud();
  }

  private collectCrystal(): void {
    if (!this.crystal?.active || !this.save) return;
    this.crystal.destroy();
    this.save = awardLocationCrystal(
      this.save,
      this.location,
      new Date().toISOString(),
    );
    this.repository.save(this.save);
    this.encounterOver = true;
    this.message?.setText(
      `${this.location.crystalName} RECOVERED • +100 XP\nA: RETURN TO ROUTE`,
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
      .text(128, 55, '', {
        align: 'center',
        backgroundColor: '#08111ddd',
        color: '#ffe08a',
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
      `${this.location.label} • HP ${this.save.resources.life}/${this.save.resources.maxLife} • LIVES ${this.save.resources.lives}/${this.save.resources.maxLives} • BOSS ${this.bossHealth.current}/${this.bossHealth.maximum}`,
    );
  }

  private drawArena(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0b1724).fillRect(0, 0, 256, 240);
    g.fillStyle(this.location.bossColor, 0.72).fillRect(0, 70, 256, 170);
    g.lineStyle(1, this.location.color, 0.42);
    for (let x = 0; x < 256; x += 24) g.lineBetween(x, 70, x, 240);
    for (let y = 70; y < 240; y += 24) g.lineBetween(0, y, 256, y);
    this.add.text(7, 25, 'MOVE: D-PAD • ATTACK: A / X • B / ESC: LEAVE', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '6px',
    });
  }

  private drawSavePoint(x: number, y: number): void {
    this.add.circle(x, y, 9, 0x5fc9ee, 0.25).setStrokeStyle(1, 0xb9efff);
    this.add.circle(x, y, 3, 0xe8fbff);
    this.add
      .text(x, y - 15, 'SAVE', {
        color: '#b9efff',
        fontFamily: 'monospace',
        fontSize: '5px',
      })
      .setOrigin(0.5);
  }

  private createTextures(): void {
    ['location-boss-sprite', 'boss-projectile', 'location-crystal'].forEach(
      (key) => {
        if (this.textures.exists(key)) this.textures.remove(key);
      },
    );
    if (!this.textures.exists('location-boss-sprite')) {
      const boss = this.add.graphics();
      boss.fillStyle(this.location.bossColor).fillRoundedRect(4, 4, 34, 40, 8);
      boss.lineStyle(3, 0x17151d).strokeRoundedRect(4, 4, 34, 40, 8);
      boss.fillStyle(this.location.color).fillCircle(14, 17, 4).fillCircle(28, 17, 4);
      boss.fillStyle(0x17151d).fillRect(0, 20, 6, 18).fillRect(36, 20, 6, 18);
      boss.generateTexture('location-boss-sprite', 42, 46).destroy();
    }
    if (!this.textures.exists('boss-projectile')) {
      const shot = this.add.graphics();
      shot.fillStyle(this.location.color).fillCircle(6, 6, 6);
      shot.lineStyle(2, 0xffffff, 0.7).strokeCircle(6, 6, 5);
      shot.generateTexture('boss-projectile', 12, 12).destroy();
    }
    if (!this.textures.exists('location-crystal')) {
      const crystal = this.add.graphics();
      crystal.fillStyle(this.location.color).fillTriangle(9, 0, 17, 10, 9, 23);
      crystal.fillTriangle(9, 0, 1, 10, 9, 23);
      crystal.lineStyle(2, 0xffffff, 0.8).lineBetween(9, 1, 9, 22);
      crystal.generateTexture('location-crystal', 18, 24).destroy();
    }
  }
}
