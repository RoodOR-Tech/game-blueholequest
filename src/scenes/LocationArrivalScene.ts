import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  BOSS_LOCATIONS,
  bossLocationById,
} from '../game/progression/bossLocations';
import {
  LOCATION_ARRIVALS,
  locationArrivalFlag,
} from '../game/progression/locationArrivals';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

export class LocationArrivalScene extends Phaser.Scene {
  private routeIndex = 0;
  private save?: SaveData;
  private controls?: PhaserInput;
  private leaving = false;
  private inputReady = false;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('location-arrival');
  }

  init(data: { routeIndex?: number }): void {
    this.routeIndex = Phaser.Math.Clamp(
      data.routeIndex ?? 0,
      0,
      BOSS_LOCATIONS.length - 1,
    );
    this.leaving = false;
    this.inputReady = false;
  }

  create(): void {
    gameAudio.bind(this, 'route');
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    const location =
      BOSS_LOCATIONS[this.routeIndex] ?? bossLocationById('hillsboro_west');
    const arrival = LOCATION_ARRIVALS[location.id];
    this.drawBackdrop(location.id);
    this.add
      .rectangle(128, 43, 236, 57, 0x07111c, 0.88)
      .setStrokeStyle(2, location.color);
    this.add
      .text(128, 27, arrival.progress, {
        color: '#9ec5d8',
        fontFamily: 'monospace',
        fontSize: '6px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(128, 45, arrival.title, {
        align: 'center',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(128, 64, arrival.subtitle, {
        align: 'center',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '6px',
        wordWrap: { width: 218 },
      })
      .setOrigin(0.5);
    const button = this.add
      .text(128, 211, 'A / ENTER / TAP • BEGIN THIS ROUTE', {
        backgroundColor: '#122f43ee',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: 'bold',
        padding: { x: 9, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => this.continueJourney());
    this.input.once('pointerdown', () => {
      if (this.inputReady) this.continueJourney();
    });
    this.tweens.add({
      targets: button,
      alpha: 0.65,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls);
    this.time.delayedCall(250, () => {
      this.inputReady = true;
    });
    this.save = {
      ...this.save,
      flags: { ...this.save.flags, [locationArrivalFlag(location.id)]: true },
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  update(): void {
    if (!this.controls || this.leaving || !this.inputReady) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (
      this.controls.actions.get('confirm').pressed ||
      this.controls.actions.get('jump').pressed
    )
      this.continueJourney();
  }

  private continueJourney(): void {
    if (this.leaving) return;
    this.leaving = true;
    gameAudio.play('confirm');
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () =>
      this.scene.start('highway-26', {
        routeIndex: this.routeIndex,
        nodeIndex: 0,
        traveling: true,
      }),
    );
  }

  private drawBackdrop(locationId: keyof typeof LOCATION_ARRIVALS): void {
    const g = this.add.graphics();
    if (locationId === 'hillsboro_west') {
      g.fillGradientStyle(0x09101d, 0x09101d, 0x263549, 0x263549).fillRect(
        0,
        0,
        256,
        240,
      );
      g.fillStyle(0xd8e5cf, 0.75).fillCircle(202, 103, 25);
      for (let x = -4; x < 270; x += 25)
        g.fillStyle(x % 50 ? 0x14291f : 0x0c1c18).fillTriangle(
          x,
          203,
          x + 14,
          91 + (x % 3) * 9,
          x + 29,
          203,
        );
      g.fillStyle(0xb8cbd0, 0.18)
        .fillEllipse(128, 177, 290, 42)
        .fillEllipse(80, 197, 210, 30);
      g.fillStyle(0x090d10).fillCircle(167, 165, 5).fillRect(164, 169, 6, 20);
      this.add.text(172, 157, '?', {
        color: '#ff8c68',
        fontFamily: 'monospace',
        fontSize: '8px',
      });
    } else if (locationId === 'hillsboro_east') {
      g.fillGradientStyle(0x183252, 0x183252, 0xe18b5b, 0xe18b5b).fillRect(
        0,
        0,
        256,
        240,
      );
      for (let x = 0; x < 256; x += 34)
        g.fillStyle(0x172331).fillRect(x, 132 - (x % 4) * 8, 28, 75);
      g.lineStyle(3, 0x171b24)
        .lineBetween(26, 103, 26, 210)
        .lineBetween(224, 91, 224, 210)
        .lineBetween(26, 111, 224, 99);
      g.lineStyle(1, 0x6ee6ff).lineBetween(27, 115, 223, 103);
    } else if (locationId === 'milwaukie') {
      g.fillGradientStyle(0x274358, 0x274358, 0x95b7b0, 0x95b7b0).fillRect(
        0,
        0,
        256,
        240,
      );
      g.fillStyle(0x296d86).fillRect(0, 150, 256, 90);
      g.fillStyle(0x253943).fillRect(0, 121, 256, 12);
      for (let x = 10; x < 256; x += 35) g.fillRect(x, 125, 7, 48);
      g.lineStyle(2, 0xb9efff, 0.35)
        .lineBetween(0, 178, 256, 170)
        .lineBetween(0, 201, 256, 190);
    } else if (locationId === 'walla_walla') {
      g.fillGradientStyle(0x5e8ac2, 0x5e8ac2, 0xf0ba6d, 0xf0ba6d).fillRect(
        0,
        0,
        256,
        240,
      );
      g.fillStyle(0xc89c43).fillRect(0, 134, 256, 106);
      g.lineStyle(2, 0x7d632f);
      for (let x = -20; x < 280; x += 18) g.lineBetween(128, 137, x, 240);
      g.lineStyle(2, 0xf2d477);
      for (let x = 5; x < 256; x += 12) g.lineBetween(x, 151, x + 5, 132);
    } else {
      g.fillGradientStyle(0x321e35, 0x321e35, 0xf0784c, 0xf0784c).fillRect(
        0,
        0,
        256,
        240,
      );
      g.fillStyle(0x343840)
        .fillTriangle(42, 194, 111, 79, 174, 194)
        .fillTriangle(111, 194, 181, 101, 237, 194);
      g.fillStyle(0xe9eff2).fillTriangle(83, 126, 111, 79, 137, 128);
      g.fillStyle(0xff6838, 0.8).fillTriangle(105, 194, 119, 115, 127, 194);
      g.fillStyle(0x18251f).fillRect(0, 194, 256, 46);
    }
  }
}
