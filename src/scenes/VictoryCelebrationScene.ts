import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import {
  BUDDA_SPRITE_SCALE,
  ensureBuddaTexture,
  BUDDA_TEXTURE_KEY,
  buddaFrame,
} from '../actors/budda';
import { playerVisual } from '../actors/familyAnimations';
import type { TeamId } from '../content/teams';
import { PhaserInput } from '../game/input/PhaserInput';
import { SaveRepository } from '../game/saves/repository';
import { HighScoreRepository } from '../game/saves/highScores';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const HEROES: readonly TeamId[] = [
  'dad_paula',
  'jen_omar',
  'joe_cia',
  'kris_lea',
  'jason_hilary',
];
const FIREWORK_COLORS = [
  0xff5e75, 0x68d8ff, 0xf6d77a, 0x7de06f, 0xd997ff,
] as const;

export class VictoryCelebrationScene extends Phaser.Scene {
  private controls?: PhaserInput;
  private save?: SaveData;
  private leaving = false;
  private readonly repository = new SaveRepository(window.localStorage);
  private readonly highScores = new HighScoreRepository(window.localStorage);

  constructor() {
    super('victory-celebration');
  }

  create(): void {
    gameAudio.bind(this, 'victory');
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    this.drawPartyGround();
    ensureBuddaTexture(this);
    this.createHeroes();
    this.createArtifactDisplay();
    this.createConfetti();
    this.add
      .text(128, 18, 'THE BLUE HOLE QUEST', {
        color: '#73ddff',
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        stroke: '#08111d',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(128, 39, 'COMPLETE!', {
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        stroke: '#7a321f',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(128, 61, 'ALL FIVE ARTIFACTS ARE HOME', {
        backgroundColor: '#08111dcc',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5);
    this.add
      .text(128, 72, `FINAL SCORE • ${this.save.stats.score}`, {
        backgroundColor: '#08111dcc',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '8px',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
    const button = this.add
      .text(128, 221, 'A / ENTER • RETURN TO THE BLUE HOLE', {
        backgroundColor: '#173f57ee',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: 'bold',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.returnHome());
    this.tweens.add({
      targets: button,
      alpha: 0.62,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls);
    const shouldRecord = !this.save.flags.high_score_recorded;
    this.save = {
      ...this.save,
      flags: {
        ...this.save.flags,
        quest_victory_celebrated: true,
        high_score_recorded: true,
      },
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);
    if (shouldRecord)
      this.highScores.record({
        teamId: this.save.activeTeamId,
        score: this.save.stats.score,
        artifacts: this.save.relics.length,
        completedAt: new Date().toISOString(),
      });
    this.time.addEvent({
      delay: 430,
      loop: true,
      callback: () => this.launchFirework(),
    });
    this.cameras.main.fadeIn(700, 0, 0, 0);
  }

  update(): void {
    if (!this.controls || this.leaving) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (
      this.controls.actions.get('confirm').pressed ||
      this.controls.actions.get('jump').pressed
    )
      this.returnHome();
  }

  private drawPartyGround(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x05091d, 0x05091d, 0x241747, 0x241747).fillRect(
      0,
      0,
      256,
      240,
    );
    g.fillStyle(0x0c2741)
      .fillTriangle(0, 185, 54, 105, 108, 185)
      .fillTriangle(65, 185, 137, 89, 199, 185)
      .fillTriangle(138, 185, 216, 111, 270, 185);
    g.fillStyle(0x173c38).fillRect(0, 178, 256, 62);
    g.fillStyle(0x0e2927).fillEllipse(128, 203, 280, 52);
    g.lineStyle(2, 0xf6d77a).beginPath().moveTo(0, 81);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, 81 + (x % 32 ? 5 : 0));
    g.strokePath();
    for (let x = 8; x < 256; x += 16)
      g.fillStyle(
        FIREWORK_COLORS[(x / 16) % FIREWORK_COLORS.length] ?? 0xffffff,
      ).fillCircle(x, 84 + (x % 32 ? 5 : 0), 2);
  }

  private createHeroes(): void {
    const positions = [25, 76, 128, 180, 231] as const;
    HEROES.forEach((teamId, index) => {
      const visual = playerVisual(teamId);
      const hero = this.add
        .sprite(positions[index]!, 178, visual.texture, visual.frame)
        .setDepth(20);
      hero.setScale(teamId === 'dad_paula' ? 0.105 : 0.13).play(visual.idle);
      this.tweens.add({
        targets: hero,
        y: 174,
        angle: index % 2 ? 3 : -3,
        duration: 330 + index * 45,
        yoyo: true,
        repeat: -1,
        delay: index * 80,
      });
    });
    const budda = this.add
      .sprite(128, 204, BUDDA_TEXTURE_KEY, buddaFrame('hillsboro_east'))
      .setScale(BUDDA_SPRITE_SCALE * 0.65)
      .setDepth(22);
    this.tweens.add({
      targets: budda,
      angle: { from: -5, to: 5 },
      duration: 280,
      yoyo: true,
      repeat: -1,
    });
    this.add
      .text(128, 214, 'BUDDA APPROVES', {
        color: '#ffd68a',
        fontFamily: 'monospace',
        fontSize: '5px',
      })
      .setOrigin(0.5);
  }

  private createArtifactDisplay(): void {
    FIREWORK_COLORS.forEach((color, index) => {
      const x = 92 + index * 18;
      const relic = this.add
        .rectangle(x, 91, 9, 13, color)
        .setStrokeStyle(2, 0xffffff, 0.65)
        .setRotation(Math.PI / 4);
      this.tweens.add({
        targets: relic,
        y: 86,
        scale: 1.15,
        duration: 500 + index * 90,
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private createConfetti(): void {
    for (let i = 0; i < 32; i += 1) {
      const piece = this.add
        .rectangle(
          Phaser.Math.Between(5, 251),
          Phaser.Math.Between(72, 174),
          2,
          4,
          FIREWORK_COLORS[i % FIREWORK_COLORS.length] ?? 0xffffff,
        )
        .setRotation(Math.random() * Math.PI);
      this.tweens.add({
        targets: piece,
        y: piece.y + Phaser.Math.Between(25, 65),
        angle: piece.angle + 220,
        alpha: 0.15,
        duration: Phaser.Math.Between(1200, 2400),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 700),
      });
    }
  }

  private launchFirework(): void {
    gameAudio.play('firework');
    const x = Phaser.Math.Between(25, 231);
    const y = Phaser.Math.Between(76, 135);
    const color = Phaser.Utils.Array.GetRandom([...FIREWORK_COLORS]);
    for (let i = 0; i < 14; i += 1) {
      const angle = (Math.PI * 2 * i) / 14;
      const spark = this.add.circle(x, y, 2, color, 0.95).setDepth(10);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * Phaser.Math.Between(18, 35),
        y: y + Math.sin(angle) * Phaser.Math.Between(18, 35),
        alpha: 0,
        scale: 0.3,
        duration: 520,
        onComplete: () => spark.destroy(),
      });
    }
    this.cameras.main.flash(45, 80, 70, 100, false);
  }

  private returnHome(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(380, () => this.scene.start('blue-hole-hub'));
  }
}
