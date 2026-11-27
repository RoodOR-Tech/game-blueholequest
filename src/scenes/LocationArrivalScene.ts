import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  BOSS_LOCATIONS,
  bossLocationById,
  type BossLocation,
} from '../game/progression/bossLocations';
import {
  LOCATION_ARRIVALS,
  locationArrivalFlag,
  type LocationArrival,
} from '../game/progression/locationArrivals';
import {
  routeForLocation,
  type LocationRoute,
} from '../game/progression/locationRoutes';
import { addRegionScene, hexColor } from '../art/regionScenes';
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
    const route = routeForLocation(location.id);
    addRegionScene(this, location.id);
    this.drawTitleSequence(location, arrival, route);
    const button = this.add
      .text(128, 225, 'A / ENTER / TAP • BEGIN THE JOURNEY', {
        backgroundColor: '#0b1a26ee',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: 'bold',
        padding: { x: 9, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => this.continueJourney());
    this.input.once('pointerdown', () => {
      if (this.inputReady) this.continueJourney();
    });
    this.tweens.add({
      targets: button,
      alpha: 1,
      delay: 2300,
      duration: 400,
      onComplete: () =>
        this.tweens.add({
          targets: button,
          alpha: 0.6,
          duration: 700,
          yoyo: true,
          repeat: -1,
        }),
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

  /** Letterbox, region name, mood line, then the quest briefing. */
  private drawTitleSequence(
    location: BossLocation,
    arrival: LocationArrival,
    route: LocationRoute,
  ): void {
    const accent = hexColor(location.color);
    const shade = this.add.graphics().setDepth(20);
    shade
      .fillGradientStyle(
        0x03060b,
        0x03060b,
        0x03060b,
        0x03060b,
        0.92,
        0.92,
        0,
        0,
      )
      .fillRect(0, 0, 256, 78);
    shade
      .fillGradientStyle(
        0x03060b,
        0x03060b,
        0x03060b,
        0x03060b,
        0,
        0,
        0.95,
        0.95,
      )
      .fillRect(0, 140, 256, 100);
    const bars = [
      this.add.rectangle(128, 0, 256, 30, 0x000000).setOrigin(0.5, 0),
      this.add.rectangle(128, 240, 256, 30, 0x000000).setOrigin(0.5, 1),
    ].map((bar) => bar.setDepth(40));
    this.tweens.add({
      targets: bars,
      scaleY: 0,
      duration: 700,
      delay: 150,
      ease: 'Cubic.easeInOut',
      onComplete: () => bars.forEach((bar) => bar.destroy()),
    });
    const text = (
      y: number,
      value: string,
      style: Phaser.Types.GameObjects.Text.TextStyle,
      delay: number,
    ) => {
      const item = this.add
        .text(128, y, value, {
          align: 'center',
          fontFamily: 'monospace',
          stroke: '#03060b',
          strokeThickness: 2,
          ...style,
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setAlpha(0);
      this.tweens.add({
        targets: item,
        alpha: 1,
        y: { from: y + 4, to: y },
        delay,
        duration: 500,
        ease: 'Cubic.easeOut',
      });
      return item;
    };
    text(
      16,
      `ENTERING  •  ${arrival.progress}`,
      { color: accent, fontSize: '6px', fontStyle: 'bold' },
      350,
    );
    const title = text(
      33,
      arrival.title,
      {
        color: '#f6d77a',
        fontSize: '17px',
        fontStyle: 'bold',
        strokeThickness: 4,
      },
      550,
    );
    title.setLetterSpacing(1);
    text(
      56,
      arrival.subtitle,
      { color: '#e4ecef', fontSize: '6px', wordWrap: { width: 224 } },
      1000,
    );
    const rule = this.add
      .rectangle(128, 160, 180, 1, location.color, 0.85)
      .setDepth(30)
      .setScale(0, 1);
    this.tweens.add({ targets: rule, scaleX: 1, delay: 1400, duration: 500 });
    text(
      172,
      `RECOVER THE ${location.artifactName}`,
      {
        color: '#f6d77a',
        fontSize: '9px',
        fontStyle: 'bold',
        strokeThickness: 3,
      },
      1500,
    );
    text(
      186,
      `GUARDED BY THE ${location.bossName}`,
      { color: accent, fontSize: '6px', fontStyle: 'bold' },
      1750,
    );
    text(
      203,
      `THE ROAD: ${route.events.map((event) => event.title).join('  ›  ')}`,
      { color: '#b8ccd6', fontSize: '6px', wordWrap: { width: 236 } },
      2000,
    );
  }
}
