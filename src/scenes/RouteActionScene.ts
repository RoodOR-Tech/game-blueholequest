import Phaser from 'phaser';
import { BUDDA_TEXTURE_KEY, ensureBuddaTexture } from '../actors/budda';
import { configurePlayerBody, playerVisual } from '../actors/familyAnimations';
import { applyDamage, type HealthState } from '../game/combat/damage';
import { PhaserInput } from '../game/input/PhaserInput';
import { bossLocationById, type BossLocationId } from '../game/progression/bossLocations';
import { routeEventFlag, routeForLocation } from '../game/progression/locationRoutes';
import { BUDDA_ACHIEVEMENT, BUDDA_ENCOUNTERS, buddaFlag, discoverBudda, foundBuddaCount } from '../game/progression/budda';
import {
  routeActionFor,
  type RouteActionDefinition,
} from '../game/progression/routeActions';
import {
  prepareCheckpointRetry,
  recoverFromGameOver,
  resolveKnockout,
} from '../game/progression/lives';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

interface ActionEnemy {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  readonly flying: boolean;
  health: HealthState;
  readonly originY: number;
}

export class RouteActionScene extends Phaser.Scene {
  private locationId: BossLocationId = 'hillsboro_west';
  private eventIndex: 1 | 2 = 1;
  private definition!: RouteActionDefinition;
  private save?: SaveData;
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private enemies: ActionEnemy[] = [];
  private mechanicZones: Phaser.GameObjects.Arc[] = [];
  private windLines: Phaser.GameObjects.Line[] = [];
  private message?: Phaser.GameObjects.Text;
  private hud?: Phaser.GameObjects.Text;
  private facing: -1 | 1 = 1;
  private nextAttackAt = 0;
  private attackingUntil = 0;
  private invulnerableUntil = 0;
  private lastGroundedAt = 0;
  private jumpBufferedUntil = 0;
  private sequenceOver = false;
  private knockedOut = false;
  private gameOver = false;
  private budda?: Phaser.GameObjects.Sprite;
  private buddaPrompt?: Phaser.GameObjects.Text;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('route-action');
  }

  init(data: { locationId?: string; eventIndex?: number }): void {
    this.locationId = bossLocationById(data.locationId).id;
    this.eventIndex = data.eventIndex === 2 ? 2 : 1;
  }

  create(): void {
    this.resetState();
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    this.definition = routeActionFor(this.locationId, this.eventIndex);
    this.physics.world.setBounds(0, 0, 512, 240);
    this.cameras.main.setBounds(0, 0, 512, 240);
    this.drawWorld();
    this.createTextures();
    ensureBuddaTexture(this);
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls, {
      primary: 'jump',
      secondary: 'attack',
    });
    const floor = this.add.rectangle(256, 229, 512, 22);
    this.physics.add.existing(floor, true);
    const visual = playerVisual(this.save.activeTeamId);
    this.player = this.physics.add.sprite(
      34,
      180,
      visual.texture,
      visual.frame,
    );
    this.player
      .setScale(visual.scale)
      .setGravityY(430)
      .setCollideWorldBounds(true)
      .play(visual.idle);
    configurePlayerBody(this.player, this.save.activeTeamId);
    this.physics.add.collider(this.player, floor);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.definition.obstacleXs.forEach((x, index) =>
      this.createObstacle(x, index, floor),
    );
    this.definition.enemyXs.forEach((x) => this.spawnEnemy(x, 198, false));
    this.definition.flyingEnemyXs.forEach((x) =>
      this.spawnEnemy(x, 145, true),
    );
    this.createEnvironmentMechanic();
    if (!this.save.flags[buddaFlag(this.locationId)]) {
      const preferredX = { hillsboro_west: 118, hillsboro_east: 202, milwaukie: 282, walla_walla: 366, bend: 444 }[this.locationId];
      const occupied = [
        ...this.definition.obstacleXs,
        ...this.definition.enemyXs,
        ...this.definition.flyingEnemyXs,
      ];
      const x = [preferredX, preferredX - 42, preferredX + 42, preferredX - 72]
        .map((candidate) => Phaser.Math.Clamp(candidate, 65, 455))
        .find((candidate) => occupied.every((other) => Math.abs(candidate - other) > 34)) ?? preferredX;
      this.budda = this.add.sprite(x, 202, BUDDA_TEXTURE_KEY).setScale(1.15).setDepth(3);
      this.buddaPrompt = this.add
        .text(x, 176, 'BUDDA • A / B / ENTER: TALK', {
          backgroundColor: '#08111df2',
          color: '#f6d77a',
          fontFamily: 'monospace',
          fontSize: '6px',
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setVisible(false);
    }
    this.createHud();
  }

  update(time: number): void {
    if (!this.controls || !this.player || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (this.sequenceOver) {
      this.player.setVelocityX(0);
      const continuePressed =
        this.controls.actions.get('confirm').pressed ||
        this.controls.actions.get('jump').pressed ||
        this.controls.actions.get('attack').pressed;
      if (continuePressed) {
        if (this.knockedOut) this.retry();
        else this.returnToRoute();
      }
      return;
    }
    const horizontal =
      Number(this.controls.actions.get('right').down) -
      Number(this.controls.actions.get('left').down);
    this.player.setVelocityX(horizontal * 82);
    if (horizontal !== 0) {
      this.facing = horizontal < 0 ? -1 : 1;
      this.player.setFlipX(horizontal < 0);
    }
    if (this.player.body.blocked.down) this.lastGroundedAt = time;
    if (this.controls.actions.get('jump').pressed)
      this.jumpBufferedUntil = time + 120;
    if (
      this.jumpBufferedUntil >= time &&
      time - this.lastGroundedAt <= 100 &&
      this.player.body.velocity.y >= 0
    ) {
      this.player.setVelocityY(-168);
      this.jumpBufferedUntil = 0;
    }
    if (
      this.controls.actions.get('attack').pressed &&
      time >= this.nextAttackAt
    )
      this.attack(time);
    if (time >= this.attackingUntil) {
      const visual = playerVisual(this.save.activeTeamId);
      if (!this.player.body.blocked.down)
        this.player.setTexture(visual.jumpTexture, visual.jumpFrame);
      else this.player.play(horizontal ? visual.walk : visual.idle, true);
    }
    this.updateEnemies(time);
    this.updateEnvironmentMechanic(time);
    this.updateBudda();
    if (this.player.x >= 482) this.completeSequence();
    if (this.controls.actions.get('cancel').pressed) this.returnToRoute();
  }

  private updateBudda(): void {
    if (!this.budda || !this.player || !this.save || !this.message || !this.controls) return;
    const nearby =
      Math.abs(this.player.x - this.budda.x) <= 34 &&
      Math.abs(this.player.y - this.budda.y) <= 52;
    this.buddaPrompt?.setVisible(nearby);
    if (!nearby) return;
    const interactPressed =
      this.controls.actions.get('confirm').pressed ||
      this.controls.actions.get('jump').pressed ||
      this.controls.actions.get('attack').pressed;
    if (!interactPressed) return;
    const before = foundBuddaCount(this.save);
    this.save = discoverBudda(this.save, this.locationId, new Date().toISOString());
    if (foundBuddaCount(this.save) === before) return;
    this.repository.save(this.save);
    const encounter = BUDDA_ENCOUNTERS[this.locationId];
    const completed = this.save.inventory.includes(BUDDA_ACHIEVEMENT);
    this.message.setText(
      `BUDDA THE GINGER CAT\n“${encounter.line}”\nREWARD: ${encounter.reward}  •  FOUND ${foundBuddaCount(this.save)}/6${completed ? '\nNINE BUZZED LIVES UNLOCKED!' : ''}`,
    );
    this.budda.setTint(0xf6d77a);
    this.buddaPrompt?.setVisible(false);
    this.buddaPrompt?.destroy();
    this.buddaPrompt = undefined;
    this.refreshHud();
  }

  private resetState(): void {
    this.enemies = [];
    this.mechanicZones = [];
    this.windLines = [];
    this.facing = 1;
    this.nextAttackAt = 0;
    this.attackingUntil = 0;
    this.invulnerableUntil = 0;
    this.lastGroundedAt = 0;
    this.jumpBufferedUntil = 0;
    this.sequenceOver = false;
    this.knockedOut = false;
    this.gameOver = false;
    this.budda = undefined;
    this.buddaPrompt = undefined;
  }

  private createObstacle(
    x: number,
    index: number,
    floor: Phaser.GameObjects.Rectangle,
  ): void {
    const width = 22 + (index % 2) * 9;
    const height = 13 + (index % 3) * 5;
    const obstacle = this.add
      .rectangle(x, 218 - height / 2, width, height, this.definition.accentColor)
      .setStrokeStyle(2, 0x241c19);
    this.physics.add.existing(obstacle, true);
    this.physics.add.collider(this.player!, obstacle);
    this.physics.add.collider(obstacle, floor);
    if (this.locationId === 'bend')
      this.add
        .triangle(x, 218 - height, 0, 9, 8, 0, 16, 9, 0xff8a45)
        .setOrigin(0.5, 1);
  }

  private spawnEnemy(x: number, y: number, flying: boolean): void {
    const sprite = this.physics.add.sprite(
      x,
      y,
      flying ? 'route-flyer' : 'route-creature',
    );
    sprite.setImmovable(true).setCollideWorldBounds(true);
    sprite.body.setAllowGravity(false);
    this.enemies.push({
      sprite,
      flying,
      health: { current: flying ? 1 : 2, maximum: flying ? 1 : 2 },
      originY: y,
    });
  }

  private createEnvironmentMechanic(): void {
    const zoneXs =
      this.eventIndex === 1 ? [126, 286, 420] : [168, 330, 448];
    if (this.locationId === 'hillsboro_west') {
      this.mechanicZones = zoneXs.map((x) =>
        this.add
          .circle(x, 211, 14, 0x8e3f73, 0.45)
          .setStrokeStyle(2, 0xd782bd),
      );
      this.add.text(15, 64, 'PURPLE VINES SLOW YOUR MOVEMENT', {
        color: '#ffd0ee',
        fontFamily: 'monospace',
        fontSize: '5px',
      });
    } else if (this.locationId === 'hillsboro_east') {
      this.mechanicZones = zoneXs.map((x) =>
        this.add
          .circle(x, 207, 10, 0xffdd55, 0.28)
          .setStrokeStyle(2, 0xfff2a1),
      );
      zoneXs.forEach((x) =>
        this.add.rectangle(x, 190, 3, 34, 0xffdf55).setAlpha(0.75),
      );
      this.add.text(15, 64, 'POWER POSTS FLASH BEFORE THEY ARC', {
        color: '#fff2a1',
        fontFamily: 'monospace',
        fontSize: '5px',
      });
    } else if (this.locationId === 'milwaukie') {
      this.mechanicZones = zoneXs.map((x) =>
        this.add
          .circle(x, 213, 18, 0x3db6d1, 0.48)
          .setStrokeStyle(2, 0x9deafa),
      );
      this.add.text(15, 64, 'BLUE CURRENT POOLS PUSH YOU BACK', {
        color: '#b8f3ff',
        fontFamily: 'monospace',
        fontSize: '5px',
      });
    } else if (this.locationId === 'walla_walla') {
      this.windLines = [88, 116, 144, 172].map((y, index) =>
        this.add
          .line(0, 0, 120 + index * 44, y, 173 + index * 44, y, 0xffe59a, 0.75)
          .setOrigin(0, 0),
      );
      this.add.text(15, 64, 'WATCH THE GUSTS • LEAN INTO THE WIND', {
        color: '#fff1ba',
        fontFamily: 'monospace',
        fontSize: '5px',
      });
    } else {
      this.mechanicZones = zoneXs.map((x) =>
        this.add
          .circle(x, 211, 12, 0xff542f, 0.46)
          .setStrokeStyle(2, 0xffc16b),
      );
      zoneXs.forEach((x) =>
        this.add.triangle(x, 207, 0, 12, 7, 0, 14, 12, 0xff8a3d, 0.8),
      );
      this.add.text(15, 64, 'LAVA VENTS GLOW BEFORE THEY ERUPT', {
        color: '#ffd09a',
        fontFamily: 'monospace',
        fontSize: '5px',
      });
    }
  }

  private updateEnvironmentMechanic(time: number): void {
    if (!this.player || this.sequenceOver) return;
    const touchingZone = this.mechanicZones.find(
      (zone) =>
        Math.abs(this.player!.x - zone.x) < zone.radius + 8 &&
        Math.abs(this.player!.y - zone.y) < 30,
    );
    if (this.locationId === 'hillsboro_west' && touchingZone) {
      this.player.setVelocityX(this.player.body.velocity.x * 0.42);
      touchingZone.setAlpha(0.85);
    } else if (this.locationId === 'hillsboro_east') {
      const striking = time % 1600 > 1270;
      this.mechanicZones.forEach((zone) =>
        zone.setFillStyle(0xffdd55, striking ? 0.95 : 0.25),
      );
      if (striking && touchingZone && time >= this.invulnerableUntil)
        this.damagePlayer(time, this.player.x < touchingZone.x ? -1 : 1);
    } else if (this.locationId === 'milwaukie' && touchingZone) {
      this.player.setVelocityX(this.player.body.velocity.x - 34);
      touchingZone.setAlpha(0.8);
    } else if (this.locationId === 'walla_walla') {
      const gusting = time % 2300 > 1580;
      this.windLines.forEach((line, index) => {
        line.setAlpha(gusting ? 0.9 : 0.18);
        line.x = ((time / 5 + index * 91) % 560) - 40;
      });
      if (gusting) this.player.setVelocityX(this.player.body.velocity.x - 38);
    } else if (this.locationId === 'bend') {
      const erupting = time % 1900 > 1450;
      this.mechanicZones.forEach((zone) =>
        zone
          .setScale(erupting ? 1.45 : 1)
          .setFillStyle(0xff542f, erupting ? 0.95 : 0.38),
      );
      if (erupting && touchingZone && time >= this.invulnerableUntil)
        this.damagePlayer(time, this.player.x < touchingZone.x ? -1 : 1);
    }
  }

  private updateEnemies(time: number): void {
    if (!this.player || this.sequenceOver) return;
    this.enemies.forEach((enemy, index) => {
      if (!enemy.sprite.active) return;
      const distance = this.player!.x - enemy.sprite.x;
      if (enemy.flying) {
        enemy.sprite.y = enemy.originY + Math.sin(time / 220 + index) * 18;
        enemy.sprite.setVelocityX(Math.abs(distance) < 95 ? Math.sign(distance) * 31 : 0);
      } else {
        enemy.sprite.setVelocityX(Math.abs(distance) < 75 ? Math.sign(distance) * 23 : Math.sin(time / 500 + index) * 15);
        enemy.sprite.setFlipX(enemy.sprite.body.velocity.x < 0);
      }
      if (
        Math.abs(distance) < 19 &&
        Math.abs(this.player!.y - enemy.sprite.y) < 27 &&
        time >= this.invulnerableUntil
      )
        this.damagePlayer(time, Math.sign(distance) || 1);
    });
  }

  private attack(time: number): void {
    if (!this.player) return;
    this.nextAttackAt = time + 280;
    this.attackingUntil = time + 210;
    if (this.save) this.player.play(playerVisual(this.save.activeTeamId).attack, true);
    const x = this.player.x + this.facing * 24;
    const slash = this.add.rectangle(x, this.player.y, 28, 17, 0xffd86b, 0.68);
    this.tweens.add({ targets: slash, alpha: 0, duration: 100, onComplete: () => slash.destroy() });
    const bounds = new Phaser.Geom.Rectangle(x - 14, this.player.y - 10, 28, 20);
    const enemy = this.enemies.find(
      (candidate) =>
        candidate.sprite.active &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          bounds,
          candidate.sprite.getBounds(),
        ),
    );
    if (!enemy) return;
    const result = applyDamage(enemy.health, 1);
    enemy.health = result.health;
    if (result.defeated) {
      enemy.sprite.destroy();
      this.message?.setText('CREATURE CLEARED • KEEP MOVING!');
    }
  }

  private damagePlayer(time: number, direction: number): void {
    if (!this.player || !this.save || this.sequenceOver) return;
    this.invulnerableUntil = time + 900;
    const result = applyDamage(
      { current: this.save.resources.life, maximum: this.save.resources.maxLife },
      1,
    );
    this.save = {
      ...this.save,
      resources: { ...this.save.resources, life: result.health.current },
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);
    this.player.setVelocity(direction * 92, -90).setTintFill(0xff6655);
    this.time.delayedCall(180, () => this.player?.clearTint());
    if (!result.defeated) {
      this.message?.setText(`HIT • ${result.health.current} HP LEFT`);
      this.refreshHud();
      return;
    }
    const knockout = resolveKnockout(this.save, new Date().toISOString());
    this.save = knockout.save;
    this.repository.save(this.save);
    this.sequenceOver = true;
    this.knockedOut = true;
    this.gameOver = knockout.gameOver;
    this.player.setVelocity(0, 0).setAngle(90).setAlpha(0.7).setTint(0xb94b4b);
    this.message?.setText(
      knockout.gameOver
        ? 'GAME OVER • A / B / ENTER: RECOVER HOME'
        : `KNOCKED OUT • ${this.save.resources.lives} LIVES LEFT • A / B / ENTER: RETRY`,
    );
    this.refreshHud();
  }

  private retry(): void {
    if (!this.save) return;
    if (this.gameOver) {
      this.save = recoverFromGameOver(this.save, new Date().toISOString());
      this.repository.save(this.save);
      this.scene.start('blue-hole-hub');
    } else {
      this.save = prepareCheckpointRetry(this.save, new Date().toISOString());
      this.repository.save(this.save);
      this.scene.restart({
        locationId: this.locationId,
        eventIndex: this.eventIndex,
      });
    }
  }

  private completeSequence(): void {
    if (!this.save || this.sequenceOver) return;
    const route = routeForLocation(this.locationId);
    const event = route.events[this.eventIndex];
    if (!event) return;
    this.save = {
      ...this.save,
      stats: { ...this.save.stats, experience: this.save.stats.experience + 35 },
      flags: {
        ...this.save.flags,
        [routeEventFlag(this.locationId, event.id)]: true,
      },
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);
    this.sequenceOver = true;
    this.player?.setVelocity(0, 0);
    this.message?.setText('SEQUENCE CLEARED • +35 XP • A / B / ENTER: RETURN');
    this.refreshHud();
  }

  private returnToRoute(): void {
    const routeIndex = [
      'hillsboro_west',
      'hillsboro_east',
      'milwaukie',
      'walla_walla',
      'bend',
    ].indexOf(this.locationId);
    this.scene.start('highway-26', {
      routeIndex,
      nodeIndex: this.eventIndex + 1,
      traveling: true,
    });
  }

  private createHud(): void {
    this.hud = this.add.text(7, 8, '', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '7px',
    });
    this.message = this.add
      .text(128, 47, `${this.definition.terrain} • REACH THE ROUTE MARKER`, {
        align: 'center',
        backgroundColor: '#08111df2',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '7px',
        lineSpacing: 2,
        padding: { x: 8, y: 6 },
        wordWrap: { width: 220, useAdvancedWrap: true },
      })
      .setScrollFactor(0)
      .setOrigin(0.5);
    this.refreshHud();
  }

  private refreshHud(): void {
    if (!this.save) return;
    this.hud
      ?.setText(
        `${this.definition.title} • HP ${this.save.resources.life}/${this.save.resources.maxLife} • LIVES ${this.save.resources.lives}/${this.save.resources.maxLives}`,
      )
      .setScrollFactor(0);
  }

  private drawWorld(): void {
    const g = this.add.graphics();
    g.fillStyle(this.definition.skyColor).fillRect(0, 0, 512, 240);
    g.fillStyle(this.definition.groundColor).fillRect(0, 218, 512, 22);
    for (let x = 18; x < 500; x += 55) {
      g.fillStyle(this.definition.accentColor, 0.35)
        .fillCircle(x, 202, 13)
        .fillTriangle(x - 16, 218, x, 174, x + 16, 218);
    }
    this.add.text(478, 187, 'GOAL', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '6px',
      backgroundColor: '#08111dcc',
      padding: { x: 3, y: 2 },
    });
    this.add.rectangle(490, 197, 4, 42, 0xf6d77a);
  }

  private createTextures(): void {
    ['route-creature', 'route-flyer'].forEach((key) => {
      if (this.textures.exists(key)) this.textures.remove(key);
    });
    const creature = this.add.graphics();
    creature.fillStyle(this.definition.accentColor).fillEllipse(13, 10, 24, 16);
    creature.fillStyle(0xffffff).fillCircle(8, 7, 3).fillCircle(18, 7, 3);
    creature.fillStyle(0x17151d).fillCircle(8, 7, 1).fillCircle(18, 7, 1);
    creature.lineStyle(2, 0x17151d).lineBetween(5, 15, 2, 20).lineBetween(20, 15, 24, 20);
    creature.generateTexture('route-creature', 26, 22).destroy();
    const flyer = this.add.graphics();
    flyer.fillStyle(this.definition.accentColor).fillTriangle(0, 10, 13, 2, 9, 19);
    flyer.fillTriangle(26, 10, 13, 2, 17, 19);
    flyer.fillStyle(0xffe18a).fillCircle(13, 10, 6);
    flyer.fillStyle(0x17151d).fillCircle(11, 9, 2).fillCircle(16, 9, 2);
    flyer.generateTexture('route-flyer', 26, 20).destroy();
  }
}
