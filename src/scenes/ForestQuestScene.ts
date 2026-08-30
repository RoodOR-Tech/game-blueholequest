import Phaser from 'phaser';
import { DAD_SPRITE_SCALE, DAD_TEXTURE_KEY } from '../actors/dadAnimations';
import { applyDamage, type HealthState } from '../game/combat/damage';
import { PhaserInput } from '../game/input/PhaserInput';
import { awardForestRelic } from '../game/progression/forestReward';
import { LANTERN_ITEM_ID } from '../game/progression/routeRules';
import {
  prepareCheckpointRetry,
  recoverFromGameOver,
  resolveKnockout,
} from '../game/progression/lives';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const WORLD_WIDTH = 512;
const FLOOR_Y = 218;
const MOVE_SPEED = 82;
const JUMP_SPEED = 162;
const ATTACK_REACH = 20;

interface ForestEnemy {
  readonly kind: 'beetle' | 'owl' | 'warden';
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  health: HealthState;
  readonly originX: number;
}

export class ForestQuestScene extends Phaser.Scene {
  private controls?: PhaserInput;
  private player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private save?: SaveData;
  private message?: Phaser.GameObjects.Text;
  private status?: Phaser.GameObjects.Text;
  private lanternGlow?: Phaser.GameObjects.Arc;
  private enemies: ForestEnemy[] = [];
  private brambles: Phaser.GameObjects.Rectangle[] = [];
  private facing: -1 | 1 = 1;
  private lastGroundedAt = 0;
  private jumpBufferedUntil = 0;
  private nextAttackAt = 0;
  private attackingUntil = 0;
  private invulnerableUntil = 0;
  private questComplete = false;
  private retreating = false;
  private knockedOut = false;
  private gameOver = false;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('forest-quest');
  }

  create(): void {
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, 240);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 240);
    this.drawForest();
    this.createTextures();
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls, {
      primary: 'jump',
      secondary: 'attack',
    });

    const floor = this.add.rectangle(WORLD_WIDTH / 2, 229, WORLD_WIDTH, 22);
    this.physics.add.existing(floor, true);
    this.player = this.physics.add.sprite(
      34,
      180,
      DAD_TEXTURE_KEY,
      'dad-idle-0',
    );
    this.player
      .setScale(DAD_SPRITE_SCALE)
      .setGravityY(430)
      .setCollideWorldBounds(true)
      .play('dad-idle');
    this.player.body.setSize(210, 500).setOffset(30, 150);
    this.physics.add.collider(this.player, floor);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.spawnEnemy('beetle', 188, 202, 2);
    this.spawnEnemy('owl', 310, 147, 2);
    this.spawnEnemy('warden', 452, 190, 5);
    this.createHud();

    const hasLantern = this.save.inventory.includes(LANTERN_ITEM_ID);
    this.lanternGlow = this.add
      .circle(this.player.x, this.player.y, 58, 0xffd86b, 0.11)
      .setStrokeStyle(1, 0xffe59a, 0.22)
      .setDepth(5);
    this.add
      .rectangle(WORLD_WIDTH / 2, 120, WORLD_WIDTH, 240, 0x061019, 0.24)
      .setDepth(4);
    this.message?.setText(
      hasLantern
        ? 'THE COLEMAN LANTERN CUTS THROUGH THE FOG'
        : 'THE FOREST FOG IS TOO DENSE • FIND THE LANTERN',
    );
    if (!hasLantern) {
      this.questComplete = true;
      this.retreating = true;
    }
  }

  update(time: number): void {
    if (!this.controls || !this.player || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    this.lanternGlow?.setPosition(this.player.x, this.player.y);

    if (this.questComplete) {
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
        } else
          this.scene.start(this.retreating ? 'highway-26' : 'blue-hole-hub');
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
      this.jumpBufferedUntil = time + 120;
    if (
      this.jumpBufferedUntil >= time &&
      time - this.lastGroundedAt <= 100 &&
      this.player.body.velocity.y >= 0
    ) {
      this.player.setVelocityY(-JUMP_SPEED);
      this.jumpBufferedUntil = 0;
    }

    if (
      this.controls.actions.get('attack').pressed &&
      time >= this.nextAttackAt
    )
      this.attack(time);
    if (time >= this.attackingUntil) {
      if (!this.player.body.blocked.down) this.player.setFrame('dad-jump');
      else this.player.play(horizontal === 0 ? 'dad-idle' : 'dad-walk', true);
    }

    this.updateEnemies(time);
    this.checkHazards(time);
    if (this.controls.actions.get('cancel').pressed)
      this.scene.start('highway-26');
  }

  private attack(time: number): void {
    if (!this.player) return;
    this.nextAttackAt = time + 280;
    this.attackingUntil = time + 210;
    this.player.play('dad-attack', true);
    const attackX = this.player.x + this.facing * ATTACK_REACH;
    const slash = this.add.rectangle(
      attackX,
      this.player.y,
      27,
      15,
      0xffd86b,
      0.7,
    );
    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 110,
      onComplete: () => slash.destroy(),
    });
    const bounds = new Phaser.Geom.Rectangle(
      attackX - 14,
      this.player.y - 9,
      28,
      18,
    );
    const target = this.enemies.find(
      (enemy) =>
        enemy.sprite.active &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          bounds,
          enemy.sprite.getBounds(),
        ),
    );
    if (!target) return;
    const result = applyDamage(target.health, 1);
    target.health = result.health;
    target.sprite.setTintFill(0xffffff).setVelocityX(this.facing * 45);
    this.time.delayedCall(80, () => target.sprite?.clearTint());
    if (result.defeated) this.defeatEnemy(target);
    else
      this.message?.setText(
        target.kind === 'warden'
          ? `FOG WARDEN • ${target.health.current}/${target.health.maximum}`
          : `${target.kind.toUpperCase()} STAGGERS`,
      );
  }

  private updateEnemies(time: number): void {
    if (!this.player) return;
    this.enemies.forEach((enemy) => {
      if (!enemy.sprite.active) return;
      const distance = this.player!.x - enemy.sprite.x;
      if (enemy.kind === 'beetle') {
        const direction = Math.sin(time / 800) >= 0 ? 1 : -1;
        enemy.sprite.setVelocityX(direction * 24).setFlipX(direction < 0);
      } else if (enemy.kind === 'owl') {
        enemy.sprite.y =
          enemy.originX === 310
            ? 150 + Math.sin(time / 280) * 17
            : enemy.sprite.y;
        if (Math.abs(distance) < 78)
          enemy.sprite.setVelocityX(Math.sign(distance) * 36);
      } else {
        enemy.sprite.setVelocityX(
          Math.abs(distance) < 105 ? Math.sign(distance) * 18 : 0,
        );
      }
      if (
        Math.abs(distance) < (enemy.kind === 'warden' ? 25 : 18) &&
        Math.abs(this.player!.y - enemy.sprite.y) < 25 &&
        time >= this.invulnerableUntil
      )
        this.damagePlayer(time, Math.sign(distance) || 1);
    });
  }

  private checkHazards(time: number): void {
    if (!this.player || time < this.invulnerableUntil) return;
    if (
      this.brambles.some((bramble) =>
        Phaser.Geom.Intersects.RectangleToRectangle(
          this.player!.getBounds(),
          bramble.getBounds(),
        ),
      )
    )
      this.damagePlayer(time, this.player.x < 276 ? -1 : 1);
  }

  private damagePlayer(time: number, direction: number): void {
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
    this.player.setVelocity(direction * 88, -95).setTintFill(0xff6655);
    this.cameras.main.shake(100, 0.005);
    this.time.delayedCall(180, () => {
      if (!this.knockedOut) this.player?.clearTint();
    });
    this.refreshStatus();
    if (result.defeated) {
      const knockout = resolveKnockout(this.save, new Date().toISOString());
      this.save = knockout.save;
      this.repository.save(this.save);
      this.questComplete = true;
      this.knockedOut = true;
      this.gameOver = knockout.gameOver;
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
      this.refreshStatus();
    } else
      this.message?.setText(`OUCH • ${result.health.current} LIFE REMAINS`);
  }

  private defeatEnemy(enemy: ForestEnemy): void {
    enemy.sprite.destroy();
    if (enemy.kind !== 'warden') {
      this.message?.setText(`${enemy.kind.toUpperCase()} CLEARED`);
      return;
    }
    if (!this.save) return;
    this.save = awardForestRelic(this.save, new Date().toISOString());
    this.repository.save(this.save);
    this.questComplete = true;
    this.add
      .circle(enemy.sprite.x, 181, 8, 0xf7c84a)
      .setStrokeStyle(2, 0xffffff);
    this.message?.setText(
      `FOG WARDEN DEFEATED • GOLDEN THUMB RECOVERED\n+75 EXP • ENTER / A: RETURN HOME`,
    );
    this.refreshStatus();
  }

  private spawnEnemy(
    kind: ForestEnemy['kind'],
    x: number,
    y: number,
    health: number,
  ): void {
    const sprite = this.physics.add.sprite(x, y, `forest-${kind}`);
    sprite.setCollideWorldBounds(true).setImmovable(true);
    sprite.body.setAllowGravity(false);
    this.enemies.push({
      kind,
      sprite,
      health: { current: health, maximum: health },
      originX: x,
    });
  }

  private createHud(): void {
    this.status = this.add
      .text(7, 8, '', {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
      })
      .setScrollFactor(0)
      .setDepth(310);
    this.message = this.add
      .text(128, 38, '', {
        align: 'center',
        backgroundColor: '#07131ddd',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '6px',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(310);
    this.refreshStatus();
  }

  private refreshStatus(): void {
    if (!this.save) return;
    this.status?.setText(
      `FOREST • HP ${this.save.resources.life}/${this.save.resources.maxLife} • LIVES ${this.save.resources.lives}/${this.save.resources.maxLives} • RELICS ${this.save.relics.length}/5`,
    );
  }

  private drawForest(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x10283a).fillRect(0, 0, WORLD_WIDTH, 240);
    graphics.fillStyle(0x355647).fillRect(0, 75, WORLD_WIDTH, 143);
    for (let x = 8; x < WORLD_WIDTH; x += 31) {
      graphics.fillStyle(x % 62 === 8 ? 0x173b30 : 0x22513a);
      graphics.fillTriangle(x - 14, 177, x, 66, x + 18, 177);
      graphics.fillStyle(0x4a3427).fillRect(x - 3, 143, 7, 75);
    }
    graphics.fillStyle(0x31472f).fillRect(0, FLOOR_Y, WORLD_WIDTH, 22);
    graphics.fillStyle(0x6b5133).fillRoundedRect(111, 193, 48, 11, 4);
    graphics.fillStyle(0x204d42).fillCircle(405, 189, 22);
    this.brambles = [
      this.add.rectangle(276, 209, 35, 15, 0x5c382b),
      this.add.rectangle(370, 211, 24, 11, 0x5c382b),
    ];
    this.brambles.forEach((bramble) => bramble.setStrokeStyle(2, 0xb17a42));
    this.add.text(18, 57, 'LANTERN TRAIL', {
      color: '#ffe59a',
      fontFamily: 'monospace',
      fontSize: '6px',
    });
    this.add.text(424, 57, 'WARDEN GROVE', {
      color: '#c9e9d5',
      fontFamily: 'monospace',
      fontSize: '6px',
    });
  }

  private createTextures(): void {
    if (!this.textures.exists('forest-beetle')) {
      const beetle = this.add.graphics();
      beetle.fillStyle(0x18211c).fillEllipse(8, 7, 15, 10);
      beetle.fillStyle(0xe08a3d).fillRect(6, 4, 4, 6);
      beetle.lineStyle(1, 0xc8d6c8).lineBetween(1, 11, 15, 11);
      beetle.generateTexture('forest-beetle', 16, 13).destroy();
    }
    if (!this.textures.exists('forest-owl')) {
      const owl = this.add.graphics();
      owl.fillStyle(0xa57a4b).fillTriangle(0, 8, 10, 1, 8, 14);
      owl.fillTriangle(20, 8, 10, 1, 12, 14);
      owl.fillStyle(0xf0d18b).fillCircle(10, 8, 6);
      owl.fillStyle(0x11181b).fillCircle(8, 7, 1).fillCircle(12, 7, 1);
      owl.generateTexture('forest-owl', 20, 15).destroy();
    }
    if (!this.textures.exists('forest-warden')) {
      const warden = this.add.graphics();
      warden.fillStyle(0x6c8d7c).fillRoundedRect(2, 5, 25, 28, 7);
      warden.fillStyle(0xb6e0d0).fillCircle(9, 14, 3).fillCircle(20, 14, 3);
      warden.fillStyle(0x1a302a).fillCircle(9, 14, 1).fillCircle(20, 14, 1);
      warden.fillStyle(0x805d3b).fillRect(6, 31, 6, 6).fillRect(18, 31, 6, 6);
      warden.generateTexture('forest-warden', 29, 37).destroy();
    }
  }
}
