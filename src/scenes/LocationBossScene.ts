import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { configurePlayerBody, playerVisual } from '../actors/familyAnimations';
import { applyDamage, type HealthState } from '../game/combat/damage';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  awardLocationArtifact,
  BOSS_LOCATIONS,
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
  private artifact?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
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
    gameAudio.bind(this, 'boss');
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
    const visual = playerVisual(this.save.activeTeamId);
    this.player = this.physics.add.sprite(
      45,
      177,
      visual.texture,
      visual.frame,
    );
    this.player
      .setScale(visual.scale)
      .setCollideWorldBounds(true)
      .play(visual.idle);
    configurePlayerBody(this.player, this.save.activeTeamId);
    this.boss = this.physics.add.sprite(205, 145, 'location-boss-sprite');
    const bossScale =
      {
        hillsboro_west: 1,
        hillsboro_east: 1.1,
        milwaukie: 1.2,
        walla_walla: 1.32,
        bend: 1.48,
      }[this.location.id] ?? 1;
    this.boss.setImmovable(true);
    this.boss.setScale(bossScale);
    this.boss.body.setAllowGravity(false);
    this.boss.body.setSize(36, 44);
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
        else this.advanceToNextRoute();
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
    const visual = playerVisual(this.save.activeTeamId);
    this.player.setVelocity(movement.x * MOVE_SPEED, movement.y * MOVE_SPEED);
    this.player.y = Phaser.Math.Clamp(this.player.y, 83, 211);
    if (movement.lengthSq() > 0) {
      this.facing.copy(movement);
      if (x !== 0) this.player.setFlipX(x < 0);
    }
    this.player.play(movement.lengthSq() ? visual.walk : visual.idle, true);

    if (
      this.controls.actions.get('attack').pressed &&
      time >= this.nextAttackAt
    )
      this.attack(time);
    if (time < this.attackingUntil) this.player.play(visual.attack, true);
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
    gameAudio.play('attack');
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
    this.boss.setTint(this.location.color);
    this.time.delayedCall(130, () => this.boss?.clearTint());
    if (this.location.id === 'hillsboro_east') {
      this.castLightning();
      return;
    }
    if (this.location.id === 'milwaukie') {
      this.launchRiverWaves();
      return;
    }
    if (this.location.id === 'walla_walla') {
      this.eruptRoots();
      return;
    }
    if (this.location.id === 'bend') {
      this.summonMeteors();
      return;
    }
    const base = new Phaser.Math.Vector2(
      this.player.x - this.boss.x,
      this.player.y - this.boss.y,
    ).normalize();
    this.spawnBossProjectile(
      'boss-projectile',
      this.boss.x,
      this.boss.y,
      base.x * this.location.projectileSpeed,
      base.y * this.location.projectileSpeed,
    );
    this.message?.setText('SENTINEL SHOT • MOVE OR DEFLECT!');
  }

  private castLightning(): void {
    if (!this.player || !this.boss) return;
    const targets = [
      Phaser.Math.Clamp(this.player.x, 28, 228),
      Phaser.Math.Clamp(this.player.x + (Math.random() < 0.5 ? -52 : 52), 28, 228),
    ];
    targets.forEach((x) => {
      const warning = this.add
        .rectangle(x, 145, 15, 142, 0xffe36a, 0.18)
        .setStrokeStyle(2, 0xfff5b0);
      this.time.delayedCall(520, () => {
        warning.setFillStyle(0xe9f8ff, 0.95).setScale(1.35, 1);
        this.cameras.main.flash(70, 210, 235, 255, false);
        if (
          this.player &&
          Math.abs(this.player.x - x) < 14 &&
          !this.encounterOver
        )
          this.damagePlayer(this.time.now);
        this.time.delayedCall(110, () => warning.destroy());
      });
    });
    this.boss.y = Phaser.Math.Clamp(
      this.boss.y + (Math.random() < 0.5 ? -30 : 30),
      100,
      184,
    );
    this.message?.setText('LIGHTNING COLUMNS • LEAVE THE WARNING ZONES!');
  }

  private launchRiverWaves(): void {
    if (!this.boss) return;
    [174, 205].forEach((y, index) => {
      this.time.delayedCall(index * 260, () => {
        if (!this.boss?.active) return;
        this.spawnBossProjectile('boss-wave', this.boss.x - 22, y, -92, 0, 'wave');
      });
    });
    this.boss.x = Phaser.Math.Clamp(this.boss.x - 12, 164, 220);
    this.message?.setText('RIVER SURGE • SLIP BETWEEN THE WAVES!');
  }

  private eruptRoots(): void {
    if (!this.player) return;
    const targets = [
      Phaser.Math.Clamp(this.player.x, 28, 228),
      Phaser.Math.Clamp(this.player.x - 48, 28, 228),
      Phaser.Math.Clamp(this.player.x + 48, 28, 228),
    ];
    targets.forEach((x, index) => {
      const warning = this.add.circle(x, 205, 10, 0xf0c86a, 0.3).setStrokeStyle(2, 0xffe8a0);
      this.time.delayedCall(460 + index * 90, () => {
        warning.destroy();
        const root = this.add.rectangle(x, 186, 12, 48, 0x5e8b3e).setStrokeStyle(2, 0x283b20);
        if (
          this.player &&
          Math.abs(this.player.x - x) < 13 &&
          Math.abs(this.player.y - 186) < 42 &&
          !this.encounterOver
        )
          this.damagePlayer(this.time.now);
        this.time.delayedCall(280, () => root.destroy());
      });
    });
    this.message?.setText('ROOT ERUPTION • WATCH THE GROUND!');
  }

  private summonMeteors(): void {
    if (!this.player || !this.boss) return;
    const targets = [
      this.player.x,
      Phaser.Math.Clamp(this.player.x - 55, 24, 232),
      Phaser.Math.Clamp(this.player.x + 55, 24, 232),
      Phaser.Math.Between(35, 220),
    ];
    targets.forEach((x, index) => {
      const warning = this.add.circle(x, 205, 9, 0xffc05c, 0.28).setStrokeStyle(2, 0xff6a3d);
      this.time.delayedCall(320 + index * 130, () => {
        warning.destroy();
        this.spawnBossProjectile('boss-meteor', x, 76, 0, 112, 'meteor');
      });
    });
    this.cameras.main.shake(150, 0.005);
    this.message?.setText('METEOR RAIN • MOVE BETWEEN IMPACT MARKERS!');
  }

  private spawnBossProjectile(
    texture: string,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    kind = 'shot',
  ): void {
    const shot = this.physics.add.sprite(x, y, texture);
    shot.body.setAllowGravity(false);
    shot.setVelocity(velocityX, velocityY).setData('kind', kind);
    this.projectiles.push(shot);
  }

  private updateProjectiles(time: number): void {
    if (!this.player) return;
    this.projectiles = this.projectiles.filter((shot) => {
      if (!shot.active) return false;
      if (shot.getData('kind') !== 'wave') shot.rotation += 0.12;
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
    gameAudio.play('hit');
    if (!this.player || !this.save || this.encounterOver) return;
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
    gameAudio.play('clear');
    if (!this.boss) return;
    const x = this.boss.x;
    const y = this.boss.y;
    this.boss.destroy();
    this.projectiles.forEach((shot) => shot.destroy());
    this.projectiles = [];
    this.artifact = this.physics.add.sprite(x, y, 'location-artifact');
    this.artifact.body.setAllowGravity(false);
    this.tweens.add({
      targets: this.artifact,
      y: y - 8,
      yoyo: true,
      repeat: -1,
      duration: 520,
    });
    if (this.player)
      this.physics.add.overlap(this.player, this.artifact, () =>
        this.collectArtifact(),
      );
    this.time.delayedCall(450, () => {
      if (!this.artifact?.active || !this.player) return;
      this.tweens.killTweensOf(this.artifact);
      this.tweens.add({
        targets: this.artifact,
        x: this.player.x,
        y: this.player.y,
        duration: 650,
        ease: 'Sine.easeIn',
        onComplete: () => this.collectArtifact(),
      });
    });
    this.message?.setText(
      `${this.location.bossName} DEFEATED • CLAIM THE ARTIFACT!`,
    );
    this.refreshHud();
  }

  private collectArtifact(): void {
    gameAudio.play('artifact');
    if (!this.artifact?.active || !this.save) return;
    this.artifact.destroy();
    this.save = awardLocationArtifact(
      this.save,
      this.location,
      new Date().toISOString(),
    );
    this.repository.save(this.save);
    this.encounterOver = true;
    const currentIndex = BOSS_LOCATIONS.findIndex(
      (location) => location.id === this.location.id,
    );
    const nextLocation = BOSS_LOCATIONS[currentIndex + 1];
    this.message?.setText(
      nextLocation
        ? `${this.location.artifactName} RECOVERED • +100 XP\nNEXT: ${nextLocation.label} • A: CONTINUE`
        : `${this.location.artifactName} RECOVERED • +100 XP\nALL ARTIFACTS FOUND • A: CELEBRATE!`,
    );
    this.refreshHud();
  }

  private advanceToNextRoute(): void {
    const currentIndex = BOSS_LOCATIONS.findIndex(
      (location) => location.id === this.location.id,
    );
    const nextIndex = currentIndex + 1;
    if (nextIndex >= BOSS_LOCATIONS.length) {
      this.scene.start('victory-celebration');
      return;
    }
    this.scene.start('highway-26', {
      routeIndex: nextIndex,
      nodeIndex: 0,
      traveling: true,
    });
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
    [
      'location-boss-sprite',
      'boss-projectile',
      'boss-wave',
      'boss-meteor',
      'location-artifact',
    ].forEach((key) => {
      if (this.textures.exists(key)) this.textures.remove(key);
    });
    if (!this.textures.exists('location-boss-sprite')) {
      const boss = this.add.graphics();
      if (this.location.id === 'hillsboro_west') {
        boss.fillStyle(this.location.bossColor).fillRoundedRect(8, 8, 38, 43, 7);
        boss.lineStyle(3, 0x17151d).strokeRoundedRect(8, 8, 38, 43, 7);
        boss.fillStyle(this.location.color).fillCircle(20, 23, 4).fillCircle(34, 23, 4);
        boss.fillStyle(0x17151d).fillRect(3, 25, 7, 20).fillRect(44, 25, 7, 20);
        boss.fillStyle(0x4c382f).fillRect(14, 49, 9, 8).fillRect(32, 49, 9, 8);
      } else if (this.location.id === 'hillsboro_east') {
        boss.fillStyle(0x253a62).fillTriangle(27, 2, 48, 25, 39, 52);
        boss.fillTriangle(27, 2, 6, 25, 15, 52);
        boss.lineStyle(3, 0x10192d).strokeTriangle(27, 2, 48, 25, 39, 52);
        boss.strokeTriangle(27, 2, 6, 25, 15, 52);
        boss.fillStyle(0x72e4ff).fillCircle(20, 23, 5).fillCircle(34, 23, 5);
        boss.lineStyle(2, 0xffe369).lineBetween(27, 2, 27, 0).lineBetween(8, 40, 0, 48).lineBetween(46, 40, 54, 48);
      } else if (this.location.id === 'milwaukie') {
        boss.fillStyle(0x276f82).fillEllipse(27, 30, 50, 43);
        boss.lineStyle(3, 0x123e4b).strokeEllipse(27, 30, 50, 43);
        boss.fillStyle(0x9feaff).fillCircle(18, 24, 5).fillCircle(36, 24, 5);
        boss.fillStyle(0x164d5c).fillEllipse(27, 40, 20, 9);
        boss.lineStyle(4, 0x4bc7db).lineBetween(5, 28, 0, 15).lineBetween(49, 28, 54, 15);
        boss.fillStyle(0x5be0ee).fillTriangle(11, 50, 20, 42, 21, 57).fillTriangle(43, 50, 34, 42, 33, 57);
      } else if (this.location.id === 'walla_walla') {
        boss.fillStyle(0x5b3c2d).fillRect(19, 13, 18, 43);
        boss.lineStyle(3, 0x2d211c).strokeRect(19, 13, 18, 43);
        boss.fillStyle(0x477737).fillCircle(15, 17, 13).fillCircle(39, 17, 13).fillCircle(27, 8, 15);
        boss.fillStyle(0xf2ca55).fillCircle(21, 23, 4).fillCircle(34, 23, 4);
        boss.lineStyle(5, 0x477737).lineBetween(20, 31, 5, 44).lineBetween(35, 31, 50, 44);
        boss.lineStyle(3, 0x6e9b45).lineBetween(23, 54, 14, 60).lineBetween(33, 54, 42, 60);
      } else {
        boss.fillStyle(0x3d3034).fillTriangle(27, 1, 52, 20, 46, 55);
        boss.fillTriangle(27, 1, 2, 20, 8, 55);
        boss.lineStyle(4, 0x171315).strokeTriangle(27, 1, 52, 20, 46, 55);
        boss.strokeTriangle(27, 1, 2, 20, 8, 55);
        boss.fillStyle(0xff5b35).fillCircle(19, 24, 6).fillCircle(36, 24, 6);
        boss.lineStyle(4, 0xff713b).lineBetween(27, 8, 25, 47).lineBetween(9, 35, 20, 40).lineBetween(45, 35, 34, 40);
        boss.fillStyle(0xffa13d).fillTriangle(8, 12, 0, 0, 18, 8).fillTriangle(46, 12, 54, 0, 36, 8);
      }
      boss.generateTexture('location-boss-sprite', 55, 61).destroy();
    }
    if (!this.textures.exists('boss-projectile')) {
      const shot = this.add.graphics();
      shot.fillStyle(this.location.color).fillCircle(6, 6, 6);
      shot.lineStyle(2, 0xffffff, 0.7).strokeCircle(6, 6, 5);
      shot.generateTexture('boss-projectile', 12, 12).destroy();
    }
    if (!this.textures.exists('boss-wave')) {
      const wave = this.add.graphics();
      wave.fillStyle(0x3dc4df, 0.88)
        .fillTriangle(0, 14, 12, 1, 20, 14)
        .fillTriangle(14, 14, 28, 3, 38, 14);
      wave.lineStyle(2, 0xb9f5ff).lineBetween(0, 14, 12, 1).lineBetween(12, 1, 20, 14);
      wave.generateTexture('boss-wave', 38, 15).destroy();
    }
    if (!this.textures.exists('boss-meteor')) {
      const meteor = this.add.graphics();
      meteor.fillStyle(0x3a2b2d).fillCircle(8, 9, 8);
      meteor.fillStyle(0xff5b35).fillTriangle(3, 3, 8, 0, 13, 3);
      meteor.lineStyle(2, 0xffae54).strokeCircle(8, 9, 7);
      meteor.generateTexture('boss-meteor', 16, 18).destroy();
    }
    if (!this.textures.exists('location-artifact')) {
      const artifact = this.add.graphics();
      if (this.location.id === 'hillsboro_west') {
        artifact.fillStyle(0x7de4ff).fillTriangle(10, 1, 18, 10, 15, 21);
        artifact.fillTriangle(10, 1, 2, 10, 5, 21);
        artifact.fillStyle(0x31536a).fillRect(5, 15, 4, 7).fillRect(13, 15, 4, 7);
        artifact.fillStyle(0xffffff).fillCircle(7, 9, 2).fillCircle(13, 9, 2);
      } else if (this.location.id === 'hillsboro_east') {
        artifact.fillStyle(0xf2c84b).fillRoundedRect(7, 2, 7, 21, 3);
        artifact.fillCircle(5, 8, 4).fillCircle(16, 8, 4);
        artifact.lineStyle(2, 0xffefaa).strokeRoundedRect(7, 2, 7, 21, 3);
      } else if (this.location.id === 'milwaukie') {
        artifact.fillStyle(0xc98232).fillRoundedRect(3, 5, 14, 17, 3);
        artifact.lineStyle(3, 0xffd58a).strokeRoundedRect(3, 5, 14, 17, 3);
        artifact.strokeCircle(18, 12, 5);
        artifact.fillStyle(0xffefc2).fillRect(5, 2, 10, 5);
      } else if (this.location.id === 'walla_walla') {
        artifact.fillStyle(0x57c76d).fillEllipse(10, 11, 18, 22);
        artifact.lineStyle(2, 0xd8ffd8).lineBetween(10, 1, 10, 23);
        artifact.lineBetween(10, 10, 17, 6).lineBetween(10, 15, 3, 11);
      } else {
        artifact.fillStyle(0xe6edf2).fillTriangle(1, 22, 10, 2, 19, 22);
        artifact.fillStyle(0xb9c8d2).fillTriangle(10, 2, 19, 22, 12, 16);
        artifact.fillStyle(0xffffff).fillTriangle(6, 11, 10, 2, 14, 11);
        artifact.lineStyle(2, 0x60717c).lineBetween(1, 22, 19, 22);
      }
      artifact.generateTexture('location-artifact', 21, 24).destroy();
    }
  }
}

