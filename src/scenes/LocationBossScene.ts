import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { configurePlayerBody, playerVisual } from '../actors/familyAnimations';
import { BOSS_RIG_SCALE, BossRig } from '../art/bossRigs';
import { addPainted, addParticles } from '../art/painter';
import { ensureTrophy, trophyScale } from '../art/trophies';
import {
  ATTACK_SCALE,
  paintAttackTextures,
  strikeBolt,
} from '../art/bossAttacks';
import { paintRegionBackdrop } from '../art/regionScenes';
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
import { addScore, SCORE_VALUES } from '../game/progression/scoring';
import { requestPauseMenu, setPauseLeaveOption } from '../ui/PauseMenu';
import { BossBar, StatusHud } from '../ui/StatusHud';
import { TouchControls } from '../ui/TouchControls';

const MOVE_SPEED = 68;
// Slow enough to step out from under a marked impact at MOVE_SPEED.
const METEOR_FALL_SPEED = 80;
const ATTACK_COOLDOWN = 270;
const INVULNERABLE_MS = 850;

export class LocationBossScene extends Phaser.Scene {
  private locationId?: string;
  private location!: BossLocation;
  private save?: SaveData;
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  /** Invisible hitbox; the painted rig follows it. */
  private boss?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private rig?: BossRig;
  private artifact?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private projectiles: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody[] = [];
  private bossHealth: HealthState = { current: 1, maximum: 1 };
  private hud?: StatusHud;
  private bossBar?: BossBar;
  private shadow?: Phaser.GameObjects.Ellipse;
  private message?: Phaser.GameObjects.Text;
  private facing = new Phaser.Math.Vector2(1, 0);
  private nextAttackAt = 0;
  private attackingUntil = 0;
  private nextBossAttackAt = 800;
  private invulnerableUntil = 0;
  private encounterOver = false;
  private bossDefeated = false;
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
      secondary: 'attack',
    });
    setPauseLeaveOption({
      label: 'RETREAT TO THE MAP',
      run: () => this.scene.start('highway-26'),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      setPauseLeaveOption(undefined),
    );
    this.shadow = this.add.ellipse(45, 177 + 38, 26, 7, 0x000000, 0.3);
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
    this.boss.setImmovable(true).setVisible(false);
    this.boss.setScale(bossScale);
    this.rig = new BossRig(
      this,
      this.location.id,
      205,
      145,
      BOSS_RIG_SCALE[this.location.id],
    );
    this.rig.entrance();
    // Hold the first attack until the boss has finished rising.
    this.nextBossAttackAt = this.time.now + 1700;
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
    this.showBossTitle();
  }

  update(time: number): void {
    if (!this.controls || !this.player || !this.save) return;
    if (this.boss?.active) this.rig?.update(time, this.boss.x, this.boss.y);
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
    this.shadow?.setPosition(this.player.x, this.player.y + 38);
    // A steady fade shows the brief safety window after a hit.
    this.player.setAlpha(time < this.invulnerableUntil ? 0.55 : 1);
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
    // Leaving mid-fight is a deliberate choice made from the pause menu.
    if (this.controls.actions.get('pause').pressed) requestPauseMenu();
  }

  private resetEncounter(): void {
    this.projectiles = [];
    this.facing.set(1, 0);
    this.nextAttackAt = 0;
    this.attackingUntil = 0;
    this.nextBossAttackAt = 800;
    this.invulnerableUntil = 0;
    this.encounterOver = false;
    this.bossDefeated = false;
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
    this.rig?.hurt();
    if (result.defeated) this.defeatBoss();
    else
      this.message?.setText(
        `${this.location.bossName} • ${result.health.current}/${result.health.maximum}`,
      );
    this.refreshHud();
  }

  private bossAttack(time: number): void {
    if (!this.boss || !this.player) return;
    this.nextBossAttackAt = time + this.location.attackInterval;
    this.rig?.cast();
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
      Phaser.Math.Clamp(
        this.player.x + (Math.random() < 0.5 ? -52 : 52),
        28,
        228,
      ),
    ];
    targets.forEach((x) => {
      const warning = this.add
        .rectangle(x, 145, 15, 142, 0xffe36a, 0.18)
        .setStrokeStyle(2, 0xfff5b0);
      this.time.delayedCall(520, () => {
        warning.setFillStyle(0xe9f8ff, 0.3).setScale(1.35, 1);
        strikeBolt(this, x, 74, 216);
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
        this.spawnBossProjectile(
          'boss-wave',
          this.boss.x - 22,
          y,
          -92,
          0,
          'wave',
        );
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
      const warning = this.add
        .circle(x, 205, 10, 0xf0c86a, 0.3)
        .setStrokeStyle(2, 0xffe8a0);
      this.time.delayedCall(460 + index * 90, () => {
        warning.destroy();
        const root = this.add
          .image(x, 210, 'boss-root')
          .setOrigin(0.5, 1)
          .setScale(ATTACK_SCALE, 0);
        this.tweens.add({
          targets: root,
          scaleY: ATTACK_SCALE,
          duration: 90,
          ease: 'Back.easeOut',
        });
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
      const warning = this.add
        .circle(x, 205, 9, 0xffc05c, 0.28)
        .setStrokeStyle(2, 0xff6a3d);
      this.time.delayedCall(320 + index * 130, () => {
        warning.destroy();
        this.spawnBossProjectile(
          'boss-meteor',
          x,
          76,
          0,
          METEOR_FALL_SPEED,
          'meteor',
        );
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
    const shot = this.physics.add.sprite(x, y, texture).setScale(ATTACK_SCALE);
    shot.body.setAllowGravity(false);
    if (kind === 'meteor') {
      const trail = addParticles(this, 0, 0, 'fx-soft', {
        speedY: { min: -30, max: -10 },
        lifespan: 320,
        scale: { start: 0.6, end: 0 },
        tint: [0xffe08a, 0xff8a3d, 0xff4a1c],
        blendMode: 'ADD',
        frequency: 25,
      });
      trail.startFollow(shot);
      shot.once(Phaser.GameObjects.Events.DESTROY, () => {
        trail.stop();
        this.time.delayedCall(350, () => trail.destroy());
      });
    }
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
    this.bossDefeated = true;
    const x = this.boss.x;
    const y = this.boss.y;
    this.boss.destroy();
    this.rig?.defeat(this.location.color);
    this.projectiles.forEach((shot) => shot.destroy());
    this.projectiles = [];
    // The artifact appears from the burst once the boss breaks apart.
    this.time.delayedCall(600, () => this.revealArtifact(x, y));
    this.message?.setText(
      `${this.location.bossName} DEFEATED • CLAIM THE ARTIFACT!`,
    );
    this.refreshHud();
  }

  private revealArtifact(x: number, y: number): void {
    this.artifact = this.physics.add
      .sprite(x, y, ensureTrophy(this, this.location.artifactId))
      .setScale(trophyScale(28));
    this.artifact.body.setAllowGravity(false);
    this.artifact.setDepth(20);
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
  }

  /** Name card that slides in while the boss rises. */
  private showBossTitle(): void {
    const color = `#${this.location.color.toString(16).padStart(6, '0')}`;
    const band = this.add
      .rectangle(128, 128, 256, 34, 0x05080e, 0.82)
      .setStrokeStyle(1, this.location.color, 0.8);
    const name = this.add
      .text(128, 122, this.location.bossName, {
        color,
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        stroke: '#05080e',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const epithet = this.add
      .text(128, 137, this.location.bossEpithet, {
        color: '#e8eef2',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(0.5);
    const card = this.add
      .container(-256, 0, [band, name, epithet])
      .setDepth(400);
    this.tweens.add({
      targets: card,
      x: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () =>
        this.tweens.add({
          targets: card,
          alpha: 0,
          delay: 1300,
          duration: 400,
          onComplete: () => card.destroy(true),
        }),
    });
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
    const bossIndex = BOSS_LOCATIONS.findIndex(
      (location) => location.id === this.location.id,
    );
    this.save = addScore(
      this.save,
      SCORE_VALUES.bossBase + Math.max(0, bossIndex) * SCORE_VALUES.bossStep,
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
        ? `${this.location.artifactName} RECOVERED • +100 XP\nRETURN TO THE BLUE HOLE • A: GO HOME`
        : `${this.location.artifactName} RECOVERED • +100 XP\nFINAL HOMECOMING • A: GO HOME`,
    );
    this.refreshHud();
  }

  private advanceToNextRoute(): void {
    this.scene.start('blue-hole-hub');
  }

  private createHud(): void {
    this.hud = new StatusHud(this, 7, 6);
    this.bossBar = new BossBar(
      this,
      150,
      20,
      98,
      this.location.bossName,
      this.location.color,
    );
    this.message = this.add
      .text(128, 55, '', {
        align: 'center',
        backgroundColor: '#08111ddd',
        color: '#ffe08a',
        fontFamily: 'monospace',
        fontSize: '6px',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(300);
    this.refreshHud();
  }

  private refreshHud(): void {
    if (!this.save) return;
    this.hud?.update({
      title: this.location.label,
      life: this.save.resources.life,
      maxLife: this.save.resources.maxLife,
      lives: this.save.resources.lives,
      maxLives: this.save.resources.maxLives,
    });
    this.bossBar?.update(
      this.bossDefeated ? 0 : this.bossHealth.current,
      this.bossHealth.maximum,
    );
  }

  private drawArena(): void {
    addPainted(this, 0, 0, paintRegionBackdrop(this, this.location.id), 0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x05080e, 0.86).fillRect(0, 0, 256, 70);
    g.fillStyle(0x05080e, 0.3).fillRect(0, 70, 256, 170);
    g.fillGradientStyle(
      0x05080e,
      0x05080e,
      0x05080e,
      0x05080e,
      0.9,
      0.9,
      0,
      0,
    ).fillRect(0, 70, 256, 14);
    const floor = (top: number, color: number, alpha: number) =>
      g
        .fillGradientStyle(color, color, color, color, 0, 0, alpha, alpha)
        .fillRect(0, top - 12, 256, 12)
        .fillStyle(color, alpha)
        .fillRect(0, top, 256, 240 - top);
    if (this.location.id === 'hillsboro_west') {
      floor(174, 0x1e252c, 0.92);
      for (let x = 8; x < 256; x += 32)
        g.fillStyle(0xe8c450, 0.6).fillRect(x, 205, 18, 2);
      g.lineStyle(1, 0x5a646c, 0.6).lineBetween(0, 176, 256, 176);
    } else if (this.location.id === 'hillsboro_east') {
      floor(170, 0x0c1022, 0.85);
      for (let x = 10; x < 256; x += 22)
        g.fillStyle(0x8ae6ff, 0.12).fillRect(x, 176, 2, 60);
    } else if (this.location.id === 'milwaukie') {
      floor(166, 0x163848, 0.85);
      g.lineStyle(1, 0xa8f1f3, 0.3)
        .lineBetween(0, 182, 256, 178)
        .lineBetween(0, 207, 256, 201)
        .lineBetween(0, 228, 256, 224);
    } else if (this.location.id === 'walla_walla') {
      floor(170, 0x5a3e1c, 0.85);
      for (let x = 5; x < 256; x += 13)
        g.lineStyle(1, 0xe3c45c, 0.4).lineBetween(x, 238, x + 9, 176);
    } else {
      floor(180, 0x1a1012, 0.9);
      g.lineStyle(1.5, 0xff6037, 0.7)
        .lineBetween(0, 221, 88, 202)
        .lineBetween(88, 202, 166, 225)
        .lineBetween(166, 225, 256, 199);
    }
    g.lineStyle(1, this.location.color, 0.1);
    for (let x = 0; x < 256; x += 24) g.lineBetween(x, 166, x, 240);
    for (let y = 168; y < 240; y += 24) g.lineBetween(0, y, 256, y);
    const legend = this.add.text(
      7,
      34,
      'MOVE: D-PAD • ATTACK: A / B / X • PAUSE: P',
      {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '6px',
      },
    );
    // The legend is a reminder, not a permanent fixture.
    this.tweens.add({
      targets: legend,
      alpha: 0,
      delay: 5000,
      duration: 600,
      onComplete: () => legend.destroy(),
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
    ].forEach((key) => {
      if (this.textures.exists(key)) this.textures.remove(key);
    });
    if (!this.textures.exists('location-boss-sprite')) {
      // The hitbox keeps the original footprint; the rig does the drawing.
      this.add
        .graphics()
        .generateTexture('location-boss-sprite', 55, 61)
        .destroy();
    }
    paintAttackTextures(this, this.location.color);
  }
}
