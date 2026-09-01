import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import {
  BUDDA_SPRITE_SCALE,
  BUDDA_TEXTURE_KEY,
  buddaFrame,
  ensureBuddaTexture,
} from '../actors/budda';
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
import { addScore, SCORE_VALUES } from '../game/progression/scoring';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

interface ActionEnemy {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  readonly flying: boolean;
  health: HealthState;
  readonly originY: number;
}

type MagicBlessing = 'full_heal' | 'buckshot' | 'super_jump';

const MAGIC_BLESSINGS: readonly {
  id: MagicBlessing;
  title: string;
  description: string;
}[] = [
  { id: 'full_heal', title: 'FULL HEAL', description: 'RESTORE ALL HP ONCE WHEN CRITICAL' },
  { id: 'buckshot', title: '3-SHOT BUCKSHOT', description: 'FIRE THREE SHORT-RANGE MAGIC BOLTS' },
  { id: 'super_jump', title: 'SUPER JUMP', description: 'JUMP HIGHER FOR THIS WHOLE MISSION' },
];

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
  private choosingMagic = false;
  private magicChoiceIndex = 0;
  private magicChoicePanel?: Phaser.GameObjects.Container;
  private magicChoiceTexts: Phaser.GameObjects.Text[] = [];
  private blessing?: MagicBlessing;
  private fullHealUsed = false;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('route-action');
  }

  init(data: { locationId?: string; eventIndex?: number }): void {
    this.locationId = bossLocationById(data.locationId).id;
    this.eventIndex = data.eventIndex === 2 ? 2 : 1;
  }

  create(): void {
    gameAudio.bind(this, 'route');
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
    this.createWeather();
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
    this.createAdvancedTraversal();
    this.definition.enemyXs.forEach((x) => this.spawnEnemy(x, 198, false));
    this.definition.flyingEnemyXs.forEach((x) =>
      this.spawnEnemy(x, 145, true),
    );
    this.createEnvironmentMechanic();
    {
      const preferredX = { hillsboro_west: 118, hillsboro_east: 202, milwaukie: 282, walla_walla: 366, bend: 444 }[this.locationId];
      const occupied = [
        ...this.definition.obstacleXs,
        ...this.definition.enemyXs,
        ...this.definition.flyingEnemyXs,
      ];
      const candidates = Array.from({ length: 40 }, (_, index) => 65 + index * 10)
        .sort((a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX));
      const x = candidates.find((candidate) =>
        occupied.every((other) => Math.abs(candidate - other) > 44),
      ) ?? 75;
      this.budda = this.add
        .sprite(x, 202, BUDDA_TEXTURE_KEY, buddaFrame(this.locationId))
        .setScale(BUDDA_SPRITE_SCALE)
        .setDepth(3);
      this.buddaPrompt = this.add
        .text(
          x,
          176,
          this.save.flags[buddaFlag(this.locationId)]
            ? 'BUDDA • A / B / ENTER: VISIT'
            : 'BUDDA • A / B / ENTER: TALK',
          {
          backgroundColor: '#08111df2',
          color: '#f6d77a',
          fontFamily: 'monospace',
          fontSize: '6px',
          padding: { x: 5, y: 3 },
          },
        )
        .setOrigin(0.5)
        .setDepth(20)
        .setVisible(false);
    }
    this.createHud();
    this.openMagicChoice();
  }

  update(time: number): void {
    if (!this.controls || !this.player || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (this.choosingMagic) {
      this.updateMagicChoice();
      return;
    }
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
      this.player.setVelocityY(this.blessing === 'super_jump' ? -220 : -168);
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
      // Phaser updates sprite frame dimensions during animation changes; restore
      // the fixed feet-aligned body so every pose lands on the same plane.
      configurePlayerBody(this.player, this.save.activeTeamId);
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
    const firstMeeting = foundBuddaCount(this.save) > before;
    if (firstMeeting) {
      this.save = addScore(this.save, SCORE_VALUES.budda, new Date().toISOString());
      this.repository.save(this.save);
    }
    const encounter = BUDDA_ENCOUNTERS[this.locationId];
    const completed = this.save.inventory.includes(BUDDA_ACHIEVEMENT);
    this.message.setText(
      firstMeeting
        ? `BUDDA THE GINGER CAT\n“${encounter.line}”\nREWARD: ${encounter.reward}  •  FOUND ${foundBuddaCount(this.save)}/6${completed ? '\nNINE BUZZED LIVES UNLOCKED!' : ''}`
        : `BUDDA THE GINGER CAT\n“${encounter.line}”\nYOUR OLD FRIEND PURRS AND CHEERS YOU ON.`,
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
    this.choosingMagic = false;
    this.magicChoiceIndex = 0;
    this.magicChoicePanel = undefined;
    this.magicChoiceTexts = [];
    this.blessing = undefined;
    this.fullHealUsed = false;
  }

  private openMagicChoice(): void {
    if (!this.save || !this.message) return;
    if (this.save.resources.magic <= 0) {
      this.message.setText('NO MAGIC REMAINS • STANDARD ABILITIES ACTIVE');
      return;
    }
    this.choosingMagic = true;
    const shade = this.add.rectangle(128, 126, 242, 172, 0x07111c, 0.97).setStrokeStyle(2, 0x75d9ff);
    const title = this.add.text(128, 53, 'CHOOSE MAGIC • COST 1 MP', {
      color: '#f6d77a', fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold',
    }).setOrigin(0.5);
    const hint = this.add.text(128, 194, 'UP / DOWN • A / B / ENTER: CHOOSE', {
      color: '#bfeaff', fontFamily: 'monospace', fontSize: '6px',
    }).setOrigin(0.5);
    this.magicChoiceTexts = MAGIC_BLESSINGS.map((_, index) =>
      this.add.text(128, 84 + index * 34, '', {
        align: 'center', fontFamily: 'monospace', fontSize: '7px', lineSpacing: 2,
        padding: { x: 7, y: 4 },
      }).setOrigin(0.5),
    );
    this.magicChoicePanel = this.add.container(0, 0, [shade, title, hint, ...this.magicChoiceTexts]).setDepth(500);
    this.refreshMagicChoice();
  }

  private updateMagicChoice(): void {
    if (!this.controls) return;
    if (this.controls.actions.get('up').pressed) {
      this.magicChoiceIndex = (this.magicChoiceIndex + MAGIC_BLESSINGS.length - 1) % MAGIC_BLESSINGS.length;
      gameAudio.play('select');
      this.refreshMagicChoice();
    }
    if (this.controls.actions.get('down').pressed) {
      this.magicChoiceIndex = (this.magicChoiceIndex + 1) % MAGIC_BLESSINGS.length;
      gameAudio.play('select');
      this.refreshMagicChoice();
    }
    const choose =
      this.controls.actions.get('confirm').pressed ||
      this.controls.actions.get('jump').pressed ||
      this.controls.actions.get('attack').pressed;
    if (!choose) return;
    this.chooseMagicBlessing();
  }

  private refreshMagicChoice(): void {
    this.magicChoiceTexts.forEach((text, index) => {
      const blessing = MAGIC_BLESSINGS[index]!;
      const selected = index === this.magicChoiceIndex;
      text
        .setText(`${selected ? '▶ ' : ''}${blessing.title}\n${blessing.description}`)
        .setColor(selected ? '#ffe58a' : '#d6e3e8')
        .setBackgroundColor(selected ? '#17415b' : '#0b202e');
    });
  }

  private chooseMagicBlessing(): void {
    if (!this.save || !this.message) return;
    const choice = MAGIC_BLESSINGS[this.magicChoiceIndex]!;
    this.blessing = choice.id;
    this.save = {
      ...this.save,
      resources: { ...this.save.resources, magic: Math.max(0, this.save.resources.magic - 1) },
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);
    this.choosingMagic = false;
    this.magicChoicePanel?.destroy(true);
    this.magicChoicePanel = undefined;
    gameAudio.play('confirm');
    this.message.setText(`${choice.title} ACTIVE • ${choice.description}`);
    this.refreshHud();
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
    if (this.locationId === 'hillsboro_west') {
      this.add.circle(x - 5, 218 - height, 7, 0x4c2548).setStrokeStyle(2, 0xb45b9c);
      this.add.line(0, 0, x - 13, 218, x + 12, 199 - height / 2, 0x6f345f, 1).setOrigin(0, 0);
    } else if (this.locationId === 'hillsboro_east') {
      this.add.rectangle(x, 212 - height, width - 5, 4, 0x485765).setStrokeStyle(1, 0xd5e1e6);
      this.add.circle(x - 7, 214 - height, 2, 0xffe36a).setDepth(2);
      this.add.circle(x + 7, 214 - height, 2, 0x71e6ff).setDepth(2);
    } else if (this.locationId === 'milwaukie') {
      this.add.ellipse(x, 216 - height, width + 5, 8, 0x315f67).setStrokeStyle(2, 0x8bd6df);
      this.add.line(0, 0, x - 10, 211 - height, x + 10, 217 - height, 0xc9f4ef, 1).setOrigin(0, 0);
    } else if (this.locationId === 'walla_walla') {
      for (let stalk = -8; stalk <= 8; stalk += 4)
        this.add.line(0, 0, x + stalk, 218, x + stalk + 2, 195 - height / 2, 0xf2d469, 1).setOrigin(0, 0);
    }
    this.physics.add.existing(obstacle, true);
    this.physics.add.collider(this.player!, obstacle);
    this.physics.add.collider(obstacle, floor);
    if (this.locationId === 'bend')
      this.add
        .triangle(x, 218 - height, 0, 9, 8, 0, 16, 9, 0xff8a45)
        .setOrigin(0.5, 1);
  }

  private createWeather(): void {
    const color = {
      hillsboro_west: 0xc98db7,
      hillsboro_east: 0xbfeaff,
      milwaukie: 0xd5f5f4,
      walla_walla: 0xf5d675,
      bend: 0xff8758,
    }[this.locationId];
    for (let index = 0; index < 28; index += 1) {
      const x = (index * 71) % 512;
      const y = 72 + ((index * 37) % 128);
      const particle = this.locationId === 'hillsboro_east'
        ? this.add.line(0, 0, x, y, x - 5, y + 12, color, 0.42).setOrigin(0, 0)
        : this.locationId === 'milwaukie'
          ? this.add.ellipse(x, y, 18, 3, color, 0.14)
          : this.locationId === 'walla_walla'
            ? this.add.rectangle(x, y, 5, 2, color, 0.5).setAngle(index * 19)
            : this.locationId === 'bend'
              ? this.add.circle(x, y, index % 3 + 1, color, 0.42)
              : this.add.ellipse(x, y, 4, 7, color, 0.35).setAngle(index * 31);
      particle.setDepth(1);
      this.tweens.add({
        targets: particle,
        x: particle.x + (this.locationId === 'walla_walla' ? -95 : this.locationId === 'hillsboro_east' ? -22 : 28),
        y: particle.y + (this.locationId === 'bend' ? -75 : 62),
        alpha: 0,
        duration: 1500 + (index % 7) * 230,
        delay: (index % 9) * 140,
        repeat: -1,
      });
    }
  }

  private createAdvancedTraversal(): void {
    if (!this.player || !this.save) return;
    const platformColor = {
      hillsboro_west: 0x6b3d61,
      hillsboro_east: 0x536a78,
      milwaukie: 0x3b7880,
      walla_walla: 0xa77c35,
      bend: 0x42353b,
    }[this.locationId];
    const platformData = this.eventIndex === 1
      ? [{ x: 185, y: 190, axis: 'y' }, { x: 365, y: 174, axis: 'x' }]
      : [{ x: 155, y: 188, axis: 'x' }, { x: 385, y: 190, axis: 'y' }];
    platformData.forEach((data, index) => {
      const platform = this.add.rectangle(data.x, data.y, 38, 7, platformColor)
        .setStrokeStyle(2, this.definition.accentColor)
        .setDepth(4);
      this.physics.add.existing(platform);
      const body = platform.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setImmovable(true);
      this.physics.add.collider(
        this.player!,
        platform,
        undefined,
        () => {
          const playerBody = this.player?.body;
          const platformBody = platform.body as Phaser.Physics.Arcade.Body;
          return Boolean(
            playerBody &&
            playerBody.velocity.y >= 0 &&
            playerBody.bottom <= platformBody.top + 11,
          );
        },
      );
      this.tweens.add({
        targets: platform,
        x: data.axis === 'x' ? data.x + (index ? -42 : 42) : data.x,
        y: data.axis === 'y' ? data.y - 25 : data.y,
        duration: 1500 + index * 320,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        onUpdate: () => {
          // Keep the Arcade body on the rendered platform. Without this sync a
          // tween can leave an invisible collision plane at an earlier position.
          body.updateFromGameObject();
        },
      });
      if (this.locationId === 'milwaukie')
        this.add.circle(data.x, data.y + 5, 4, 0x9deafa, 0.5).setDepth(3);
    });

    [112, 268, 432].forEach((x, index) => {
      const token = this.add.circle(x, 125 + (index % 2) * 25, 5, this.definition.accentColor)
        .setStrokeStyle(2, 0xffffff, 0.8)
        .setDepth(8);
      this.physics.add.existing(token);
      const body = token.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      this.tweens.add({ targets: token, y: token.y - 7, angle: 180, duration: 650, yoyo: true, repeat: -1 });
      this.physics.add.overlap(this.player!, token, () => {
        if (!token.active || !this.save) return;
        token.destroy();
        this.save = addScore(this.save, 75, new Date().toISOString());
        this.repository.save(this.save);
        gameAudio.play('select');
        this.message?.setText('ROUTE TOKEN COLLECTED • +75 SCORE');
        this.refreshHud();
      });
    });
  }

  private spawnEnemy(x: number, y: number, flying: boolean): void {
    const sprite = this.physics.add.sprite(
      x,
      y,
      `${flying ? 'route-flyer' : 'route-creature'}-${this.locationId}`,
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
        const waveSpeed = this.locationId === 'hillsboro_east' ? 125 : this.locationId === 'bend' ? 170 : 220;
        const waveHeight = this.locationId === 'walla_walla' ? 28 : 18;
        enemy.sprite.y = enemy.originY + Math.sin(time / waveSpeed + index) * waveHeight;
        const pursuit = this.locationId === 'hillsboro_east' ? 48 : this.locationId === 'bend' ? 39 : 31;
        enemy.sprite.setVelocityX(Math.abs(distance) < 110 ? Math.sign(distance) * pursuit : 0);
      } else {
        const pursuitRange = this.locationId === 'bend' ? 120 : this.locationId === 'milwaukie' ? 62 : 82;
        const chaseSpeed = this.locationId === 'bend' ? 42 : this.locationId === 'walla_walla' ? 31 : 23;
        const patrolSpeed = this.locationId === 'milwaukie' ? 22 : 15;
        enemy.sprite.setVelocityX(
          Math.abs(distance) < pursuitRange
            ? Math.sign(distance) * chaseSpeed
            : Math.sin(time / 500 + index) * patrolSpeed,
        );
        if (this.locationId === 'hillsboro_west')
          enemy.sprite.y = enemy.originY - Math.max(0, Math.sin(time / 330 + index) * 8);
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
    gameAudio.play('attack');
    if (!this.player) return;
    this.nextAttackAt = time + 280;
    this.attackingUntil = time + 210;
    if (this.save) this.player.play(playerVisual(this.save.activeTeamId).attack, true);
    const startX = this.player.x + this.facing * 14;
    const endX = this.player.x + this.facing * 58;
    const lanes = this.blessing === 'buckshot' ? [-12, 0, 12] : [0];
    const hitEnemies = new Set<ActionEnemy>();
    lanes.forEach((offsetY) => {
      const burst = this.add
        .rectangle(startX, this.player!.y - 2 + offsetY, 12, 6, 0xffe47a, 0.95)
        .setStrokeStyle(1, 0xffffff)
        .setDepth(15)
        .setAngle(this.facing * offsetY * 0.7);
      this.tweens.add({
        targets: burst,
        x: endX,
        y: this.player!.y - 2 + offsetY * 1.7,
        scaleX: 0.35,
        alpha: 0,
        duration: 145,
        ease: 'Quad.easeOut',
        onComplete: () => burst.destroy(),
      });
      const bounds = new Phaser.Geom.Rectangle(
        Math.min(startX, endX) - 7,
        this.player!.y - 11 + offsetY,
        Math.abs(endX - startX) + 14,
        18,
      );
      const enemy = this.enemies.find(
        (candidate) => candidate.sprite.active && !hitEnemies.has(candidate) &&
          Phaser.Geom.Intersects.RectangleToRectangle(bounds, candidate.sprite.getBounds()),
      );
      if (enemy) hitEnemies.add(enemy);
    });
    hitEnemies.forEach((enemy) => {
      const result = applyDamage(enemy.health, 1);
      enemy.health = result.health;
      if (result.defeated) {
        enemy.sprite.destroy();
        if (this.save) {
          this.save = addScore(this.save, SCORE_VALUES.enemy, new Date().toISOString());
          this.repository.save(this.save);
          this.refreshHud();
        }
        this.message?.setText('CREATURE CLEARED • KEEP MOVING!');
      }
    });
  }

  private damagePlayer(time: number, direction: number): void {
    gameAudio.play('hit');
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
    if (
      this.blessing === 'full_heal' &&
      !this.fullHealUsed &&
      result.health.current <= Math.ceil(result.health.maximum * 0.35)
    ) {
      this.fullHealUsed = true;
      this.save = {
        ...this.save,
        resources: { ...this.save.resources, life: this.save.resources.maxLife },
        savedAt: new Date().toISOString(),
      };
      this.repository.save(this.save);
      this.player.clearTint();
      this.cameras.main.flash(260, 120, 235, 190, false);
      gameAudio.play('artifact');
      this.message?.setText('FULL HEAL TRIGGERED • HEALTH RESTORED!');
      this.refreshHud();
      return;
    }
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
    gameAudio.play('clear');
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
    this.save = addScore(this.save, SCORE_VALUES.actionSequence, new Date().toISOString());
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
        `${this.definition.title} • SCORE ${this.save.stats.score}\nHP ${this.save.resources.life}/${this.save.resources.maxLife} • LIVES ${this.save.resources.lives}/${this.save.resources.maxLives}`,
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
    const creatureKey = `route-creature-${this.locationId}`;
    const flyerKey = `route-flyer-${this.locationId}`;
    [creatureKey, flyerKey].forEach((key) => {
      if (this.textures.exists(key)) this.textures.remove(key);
    });
    const creature = this.add.graphics();
    if (this.locationId === 'hillsboro_west') {
      creature.fillStyle(0x53284f).fillEllipse(13, 11, 24, 15);
      creature.lineStyle(2, 0xb95e9d).lineBetween(4, 8, 0, 3).lineBetween(21, 8, 26, 3);
    } else if (this.locationId === 'hillsboro_east') {
      creature.fillStyle(0xd6b52d).fillRect(3, 5, 20, 13);
      creature.lineStyle(2, 0xffff91).lineBetween(2, 11, 24, 2).lineBetween(5, 20, 21, 10);
    } else if (this.locationId === 'milwaukie') {
      creature.fillStyle(0x2c91a2).fillEllipse(13, 12, 20, 13);
      creature.lineStyle(3, 0x163f55).lineBetween(5, 12, 0, 7).lineBetween(21, 12, 26, 7).lineBetween(7, 17, 3, 21).lineBetween(19, 17, 23, 21);
    } else if (this.locationId === 'walla_walla') {
      creature.fillStyle(0xb7842d).fillEllipse(13, 11, 23, 15);
      creature.lineStyle(2, 0xf5dd73).lineBetween(6, 4, 3, 0).lineBetween(12, 4, 12, 0).lineBetween(19, 5, 22, 1);
    } else {
      creature.fillStyle(0x432d35).fillEllipse(13, 12, 24, 17);
      creature.fillStyle(0xff5d2f).fillTriangle(4, 8, 8, 0, 11, 9).fillTriangle(15, 9, 19, 0, 23, 9);
    }
    creature.fillStyle(0xffffff).fillCircle(8, 9, 3).fillCircle(18, 9, 3);
    creature.fillStyle(0x17151d).fillCircle(8, 9, 1).fillCircle(18, 9, 1);
    creature.generateTexture(creatureKey, 26, 22).destroy();
    const flyer = this.add.graphics();
    const flyerColor = {
      hillsboro_west: 0x9b4e88,
      hillsboro_east: 0xffe45c,
      milwaukie: 0x69d7dc,
      walla_walla: 0xe8c34f,
      bend: 0xff6138,
    }[this.locationId];
    flyer.fillStyle(flyerColor).fillTriangle(0, 10, 13, 2, 9, 19);
    flyer.fillTriangle(26, 10, 13, 2, 17, 19);
    flyer.fillStyle(this.locationId === 'bend' ? 0x34242b : 0xffe18a).fillCircle(13, 10, 6);
    flyer.fillStyle(0x17151d).fillCircle(11, 9, 2).fillCircle(16, 9, 2);
    if (this.locationId === 'hillsboro_east')
      flyer.lineStyle(2, 0xffffff).lineBetween(13, 3, 18, 0);
    flyer.generateTexture(flyerKey, 26, 20).destroy();
  }
}

