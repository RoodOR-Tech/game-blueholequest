import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  BOSS_LOCATIONS,
  bossLocationById,
  isLocationUnlocked,
} from '../game/progression/bossLocations';
import {
  LOCATION_ROUTES,
  resolveRouteChoice,
  routeEventFlag,
  type RouteEvent,
} from '../game/progression/locationRoutes';
import { recoverFromGameOver } from '../game/progression/lives';
import { locationArrivalFlag } from '../game/progression/locationArrivals';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { addScore, SCORE_VALUES } from '../game/progression/scoring';
import { TouchControls } from '../ui/TouchControls';
import { playerVisual } from '../actors/familyAnimations';
import {
  journeyTrail,
  paintJourneyMap,
  type JourneyTrail,
} from '../art/journeyMaps';
import { addPainted } from '../art/painter';
import { hexColor, lurkingEyes } from '../art/regionScenes';
import { JOURNEY_FRAME, stopProgress } from '../game/progression/journeyPaths';

const WORLD_POINTS = [
  { x: 42, y: 105, label: 'ROCKAWAY', labelX: 42, labelY: 119 },
  { x: 78, y: 91, label: 'HILLSBORO W', labelX: 75, labelY: 77 },
  { x: 98, y: 91, label: 'HILLSBORO E', labelX: 100, labelY: 104 },
  { x: 111, y: 108, label: 'MILWAUKIE', labelX: 113, labelY: 121 },
  { x: 196, y: 55, label: 'WALLA WALLA', labelX: 196, labelY: 42 },
  { x: 158, y: 158, label: 'BEND', labelX: 158, labelY: 172 },
] as const;

export class Highway26Scene extends Phaser.Scene {
  private controls?: PhaserInput;
  private save?: SaveData;
  private routeIndex = 0;
  private nodeIndex = 0;
  private traveling = false;
  private marker?: Phaser.GameObjects.Arc;
  private graphics?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private trail?: JourneyTrail;
  private traveler?: Phaser.GameObjects.Sprite;
  private travelerShadow?: Phaser.GameObjects.Ellipse;
  private progressDots?: Phaser.GameObjects.Graphics;
  private journeyObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly trailProgress = { t: 0 };
  private moving = false;
  private heading?: Phaser.GameObjects.Text;
  private message?: Phaser.GameObjects.Text;
  private departButton?: Phaser.GameObjects.Text;
  private eventPanel?: Phaser.GameObjects.Container;
  private outcomePanel?: Phaser.GameObjects.Container;
  private activeEvent?: RouteEvent;
  private choiceIndex = 0;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private gameOver = false;
  private readonly repository = new SaveRepository(window.localStorage);
  private requestedRouteIndex?: number;
  private requestedNodeIndex?: number;
  private requestedTraveling = false;

  constructor() {
    super('highway-26');
  }

  init(data: {
    routeIndex?: number;
    nodeIndex?: number;
    traveling?: boolean;
  }): void {
    this.requestedRouteIndex = data.routeIndex;
    this.requestedNodeIndex = data.nodeIndex;
    this.requestedTraveling = data.traveling === true;
  }

  create(): void {
    gameAudio.bind(this, 'route');
    // Phaser reuses this scene object, so state from the last visit must not
    // carry over: a stale game-over flag would swallow every button press.
    this.gameOver = false;
    this.eventPanel = undefined;
    this.outcomePanel = undefined;
    this.activeEvent = undefined;
    this.choiceIndex = 0;
    this.choiceTexts = [];
    this.labels = [];
    this.journeyObjects = [];
    this.traveler = undefined;
    this.travelerShadow = undefined;
    this.progressDots = undefined;
    this.moving = false;
    this.graphics = undefined;
    this.departButton = undefined;
    this.save = this.repository.load() ?? undefined;
    if (!this.save) {
      this.scene.start('team-select');
      return;
    }
    this.controls = new PhaserInput(this);
    new TouchControls(this, this.controls);
    this.heading = this.add.text(9, 8, '', {
      color: '#f6d77a',
      fontFamily: 'monospace',
      fontSize: '9px',
      fontStyle: 'bold',
    });
    this.message = this.add
      .text(128, 220, '', {
        align: 'center',
        backgroundColor: '#08111ddd',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '6px',
        padding: { x: 5, y: 4 },
      })
      .setOrigin(0.5);
    const firstIncomplete = BOSS_LOCATIONS.findIndex(
      (location) => !this.save?.relics.includes(location.artifactId),
    );
    this.routeIndex =
      this.requestedRouteIndex ??
      (firstIncomplete === -1 ? LOCATION_ROUTES.length - 1 : firstIncomplete);
    this.nodeIndex = this.requestedNodeIndex ?? 0;
    this.traveling = this.requestedTraveling;
    const requestedRoute = LOCATION_ROUTES[this.routeIndex];
    if (
      this.traveling &&
      this.nodeIndex === 0 &&
      requestedRoute &&
      !this.save.flags[locationArrivalFlag(requestedRoute.locationId)]
    ) {
      this.scene.start('location-arrival', { routeIndex: this.routeIndex });
      return;
    }
    if (this.traveling) this.drawJourney();
    else this.drawRouteMenu();
  }

  update(): void {
    if (!this.controls || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
    if (this.outcomePanel) {
      this.updateOutcome();
      return;
    }
    if (this.gameOver) {
      if (this.controls.actions.get('confirm').pressed) {
        this.save = recoverFromGameOver(this.save, new Date().toISOString());
        this.repository.save(this.save);
        this.scene.start('blue-hole-hub');
      }
      return;
    }
    if (this.eventPanel) {
      this.updateEvent();
      return;
    }
    if (!this.traveling) this.updateMenu();
    else this.updateRoute();
  }

  private updateMenu(): void {
    if (!this.controls) return;
    const previous =
      this.controls.actions.get('left').pressed ||
      this.controls.actions.get('up').pressed;
    const next =
      this.controls.actions.get('right').pressed ||
      this.controls.actions.get('down').pressed;
    if (previous) this.moveRouteSelection(-1);
    if (next) this.moveRouteSelection(1);
    if (this.controls.actions.get('confirm').pressed) {
      this.beginJourney();
    }
    if (this.controls.actions.get('cancel').pressed)
      this.scene.start('blue-hole-hub');
  }

  private moveRouteSelection(direction: -1 | 1): void {
    if (!this.save) return;
    for (let step = 1; step <= LOCATION_ROUTES.length; step += 1) {
      const candidate =
        (this.routeIndex + direction * step + LOCATION_ROUTES.length) %
        LOCATION_ROUTES.length;
      if (isLocationUnlocked(candidate, this.save.relics)) {
        this.routeIndex = candidate;
        gameAudio.play('select');
        this.drawRouteMenu();
        return;
      }
    }
  }

  private updateRoute(): void {
    if (!this.controls || this.moving) return;
    const advance =
      this.controls.actions.get('right').pressed ||
      this.controls.actions.get('confirm').pressed;
    if (advance) this.advanceRouteNode();
    if (this.controls.actions.get('left').pressed && this.nodeIndex > 0) {
      this.nodeIndex -= 1;
      this.moveMarker();
    }
    if (this.controls.actions.get('cancel').pressed) {
      this.traveling = false;
      this.drawRouteMenu();
    }
  }

  private openEvent(): void {
    const route = LOCATION_ROUTES[this.routeIndex];
    const event = route?.events[this.nodeIndex - 1];
    if (!route || !event || !this.save) return;
    if (this.save.flags[routeEventFlag(route.locationId, event.id)]) {
      this.message?.setText(`${event.title} • ALREADY CLEARED`);
      return;
    }
    if (event.kind === 'environment') {
      this.scene.start('route-action', {
        locationId: route.locationId,
        eventIndex: this.nodeIndex - 1,
      });
      return;
    }
    this.activeEvent = event;
    this.choiceIndex = 0;
    const border = event.kind === 'calamity' ? 0xff8b62 : 0x7ed995;
    const shade = this.add
      .rectangle(128, 125, 238, 150, 0x08111d, 0.97)
      .setStrokeStyle(2, border);
    const title = this.add
      .text(
        128,
        68,
        `${event.kind === 'calamity' ? 'CALAMITY' : 'ENVIRONMENT'} • ${event.title}`,
        {
          color: event.kind === 'calamity' ? '#ffad84' : '#9aefad',
          fontFamily: 'monospace',
          fontSize: '8px',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5);
    const body = this.add
      .text(128, 91, event.description, {
        align: 'center',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(0.5);
    this.choiceTexts = event.choices.map((choice, index) =>
      this.add
        .text(
          128,
          118 + index * 35,
          `${choice.label}\n${
            event.kind === 'calamity'
              ? index === 0
                ? `-2 HP / LIFE RISK • +${SCORE_VALUES.calamityRisk} SCORE`
                : `-1 MAGIC • +${SCORE_VALUES.calamityCareful} SCORE`
              : `+${index === 0 ? 150 : 100} SCORE`
          }`,
          {
            align: 'center',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: '6px',
            lineSpacing: 2,
            padding: { x: 5, y: 4 },
          },
        )
        .setOrigin(0.5),
    );
    const hint = this.add
      .text(128, 190, 'UP / DOWN: CHOOSE • A / ENTER: COMMIT', {
        color: '#91b4c8',
        fontFamily: 'monospace',
        fontSize: '5px',
      })
      .setOrigin(0.5);
    this.eventPanel = this.add
      .container(0, 0, [shade, title, body, ...this.choiceTexts, hint])
      .setDepth(200);
    this.refreshChoices();
  }

  private updateEvent(): void {
    if (!this.controls) return;
    if (this.controls.actions.get('up').pressed) {
      this.choiceIndex = Phaser.Math.Wrap(this.choiceIndex - 1, 0, 2);
      this.refreshChoices();
    }
    if (this.controls.actions.get('down').pressed) {
      this.choiceIndex = Phaser.Math.Wrap(this.choiceIndex + 1, 0, 2);
      this.refreshChoices();
    }
    if (this.controls.actions.get('confirm').pressed) this.resolveEvent();
  }

  private resolveEvent(): void {
    gameAudio.play(
      this.activeEvent?.kind === 'calamity' ? 'calamity' : 'confirm',
    );
    const route = LOCATION_ROUTES[this.routeIndex];
    const event = this.activeEvent;
    const choice = event?.choices[this.choiceIndex];
    if (!route || !event || !choice || !this.save) return;
    const before = {
      life: this.save.resources.life,
      magic: this.save.resources.magic,
      lives: this.save.resources.lives,
      score: this.save.stats.score,
    };
    const outcome = resolveRouteChoice(
      {
        life: this.save.resources.life,
        magic: this.save.resources.magic,
        experience: this.save.stats.experience,
        lives: this.save.resources.lives,
      },
      choice,
      Math.random(),
    );
    this.save = {
      ...this.save,
      resources: {
        ...this.save.resources,
        life: outcome.life,
        magic: outcome.magic,
        lives: outcome.lives,
      },
      stats: { ...this.save.stats, experience: outcome.experience },
      flags: {
        ...this.save.flags,
        [routeEventFlag(route.locationId, event.id)]: true,
      },
      savedAt: new Date().toISOString(),
    };
    this.save = addScore(
      this.save,
      event.kind === 'calamity'
        ? this.choiceIndex === 0
          ? SCORE_VALUES.calamityRisk
          : SCORE_VALUES.calamityCareful
        : this.choiceIndex === 0
          ? 150
          : 100,
      new Date().toISOString(),
    );
    this.repository.save(this.save);
    this.eventPanel?.destroy(true);
    this.eventPanel = undefined;
    this.activeEvent = undefined;
    this.choiceTexts = [];
    this.gameOver = outcome.lives === 0;
    this.showOutcomePanel(event.title, choice.label, choice.summary, before, {
      life: outcome.life,
      magic: outcome.magic,
      lives: outcome.lives,
      scoreGained: this.save.stats.score - before.score,
      lostLife: outcome.lostLife,
    });
  }

  private showOutcomePanel(
    eventTitle: string,
    choiceLabel: string,
    summary: string,
    before: { life: number; magic: number; lives: number; score: number },
    after: {
      life: number;
      magic: number;
      lives: number;
      scoreGained: number;
      lostLife: boolean;
    },
  ): void {
    const shade = this.add
      .rectangle(128, 125, 240, 176, 0x07111c, 0.98)
      .setStrokeStyle(3, after.lostLife ? 0xff6655 : 0xf6d77a);
    const heading = this.add
      .text(128, 48, 'CALAMITY CONSEQUENCES', {
        color: after.lostLife ? '#ff8d79' : '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const title = this.add
      .text(128, 69, `${eventTitle}\nYOU CHOSE: ${choiceLabel}`, {
        align: 'center',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: 'bold',
        lineSpacing: 2,
      })
      .setOrigin(0.5);
    const consequences = this.add
      .text(
        128,
        122,
        [
          `HEALTH     ${before.life} → ${after.life}`,
          `MAGIC      ${before.magic} → ${after.magic}`,
          `LIVES      ${before.lives} → ${after.lives}`,
          `SCORE      +${after.scoreGained}`,
          after.lostLife ? '! A LIFE WAS LOST !' : 'NO LIFE LOST',
        ].join('\n'),
        {
          align: 'left',
          backgroundColor: '#10283a',
          color: after.lostLife ? '#ffb09f' : '#c9f2d2',
          fontFamily: 'monospace',
          fontSize: '8px',
          lineSpacing: 3,
          padding: { x: 10, y: 7 },
        },
      )
      .setOrigin(0.5);
    const result = this.add
      .text(128, 174, summary.toUpperCase(), {
        align: 'center',
        color: '#d7e6eb',
        fontFamily: 'monospace',
        fontSize: '6px',
        wordWrap: { width: 210 },
      })
      .setOrigin(0.5);
    const continueText = this.add
      .text(
        128,
        200,
        after.lives === 0 ? 'A / ENTER • RECOVER HOME' : 'A / ENTER • CONTINUE',
        {
          backgroundColor: '#17415b',
          color: '#f6d77a',
          fontFamily: 'monospace',
          fontSize: '7px',
          fontStyle: 'bold',
          padding: { x: 8, y: 5 },
        },
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    continueText.on('pointerdown', () => this.dismissOutcome());
    this.outcomePanel = this.add
      .container(0, 0, [
        shade,
        heading,
        title,
        consequences,
        result,
        continueText,
      ])
      .setDepth(250);
  }

  private updateOutcome(): void {
    if (!this.controls) return;
    if (
      this.controls.actions.get('confirm').pressed ||
      this.controls.actions.get('jump').pressed
    )
      this.dismissOutcome();
  }

  private dismissOutcome(): void {
    this.outcomePanel?.destroy(true);
    this.outcomePanel = undefined;
    this.message?.setText(
      this.gameOver
        ? 'FINAL LIFE LOST • A / ENTER: RECOVER HOME'
        : 'CONSEQUENCES RECORDED • CONTINUE WHEN READY',
    );
  }

  private refreshChoices(): void {
    this.choiceTexts.forEach((text, index) => {
      const selected = index === this.choiceIndex;
      const event = this.activeEvent;
      const choice = event?.choices[index];
      const stakes =
        event?.kind === 'calamity'
          ? index === 0
            ? `-2 HP / LIFE RISK • +${SCORE_VALUES.calamityRisk} SCORE`
            : `-1 MAGIC • +${SCORE_VALUES.calamityCareful} SCORE`
          : `+${index === 0 ? 150 : 100} SCORE`;
      text
        .setColor(selected ? '#f6d77a' : '#ffffff')
        .setBackgroundColor(selected ? '#27485d' : '')
        .setText(`${selected ? '▶ ' : ''}${choice?.label ?? ''}\n${stakes}`);
    });
  }

  private clearMap(): void {
    this.graphics?.destroy();
    this.marker?.destroy();
    this.marker = undefined;
    this.tweens.killTweensOf(this.trailProgress);
    this.moving = false;
    this.journeyObjects.forEach((item) => item.destroy());
    this.journeyObjects = [];
    this.traveler = undefined;
    this.travelerShadow = undefined;
    this.progressDots = undefined;
    this.labels.forEach((label) => label.destroy());
    this.labels = [];
    this.departButton?.destroy();
    this.departButton = undefined;
    this.graphics = this.add.graphics();
    this.graphics.fillStyle(0xd9b76d).fillRoundedRect(8, 30, 240, 174, 5);
  }

  private drawRouteMenu(): void {
    this.clearMap();
    const g = this.graphics!;
    // Pacific Ocean and a simplified Oregon / southeast Washington silhouette.
    g.fillStyle(0x2479a8).fillRect(13, 35, 230, 164);
    g.fillStyle(0x74a95a).fillPoints(
      [
        new Phaser.Geom.Point(32, 37),
        new Phaser.Geom.Point(235, 37),
        new Phaser.Geom.Point(237, 188),
        new Phaser.Geom.Point(71, 190),
        new Phaser.Geom.Point(57, 178),
        new Phaser.Geom.Point(51, 157),
        new Phaser.Geom.Point(45, 139),
        new Phaser.Geom.Point(39, 121),
        new Phaser.Geom.Point(35, 96),
        new Phaser.Geom.Point(32, 72),
      ],
      true,
    );
    g.lineStyle(2, 0xd7cc91).strokePoints(
      [
        new Phaser.Geom.Point(32, 37),
        new Phaser.Geom.Point(235, 37),
        new Phaser.Geom.Point(237, 188),
        new Phaser.Geom.Point(71, 190),
        new Phaser.Geom.Point(57, 178),
        new Phaser.Geom.Point(51, 157),
        new Phaser.Geom.Point(45, 139),
        new Phaser.Geom.Point(39, 121),
        new Phaser.Geom.Point(35, 96),
        new Phaser.Geom.Point(32, 72),
      ],
      true,
    );

    // High desert, Willamette Valley, Coast Range, and Cascade snow belt.
    g.fillStyle(0xcaa75d).fillPoints(
      [
        new Phaser.Geom.Point(150, 71),
        new Phaser.Geom.Point(235, 63),
        new Phaser.Geom.Point(237, 188),
        new Phaser.Geom.Point(142, 188),
      ],
      true,
    );
    g.fillStyle(0x4f8749).fillRoundedRect(69, 65, 64, 91, 12);
    g.fillStyle(0x356b42);
    for (let y = 54; y < 175; y += 22) {
      g.fillTriangle(47, y + 14, 55, y, 63, y + 14);
      g.fillTriangle(61, y + 17, 69, y + 3, 77, y + 17);
    }
    for (let y = 50; y < 184; y += 24) {
      g.fillStyle(0x607467).fillTriangle(132, y + 18, 142, y, 152, y + 18);
      g.fillStyle(0xe8f2eb).fillTriangle(137, y + 9, 142, y, 147, y + 9);
    }

    // Columbia and Willamette rivers.
    g.lineStyle(5, 0x2f8fc0);
    g.beginPath();
    g.moveTo(35, 48);
    g.lineTo(111, 48);
    g.lineTo(149, 54);
    g.lineTo(235, 49);
    g.strokePath();
    g.lineStyle(4, 0x2f8fc0);
    g.beginPath();
    g.moveTo(111, 48);
    g.lineTo(108, 80);
    g.lineTo(112, 112);
    g.lineTo(104, 151);
    g.strokePath();

    // Connected expedition road.
    g.lineStyle(5, 0x76583c);
    g.beginPath();
    g.moveTo(WORLD_POINTS[0].x, WORLD_POINTS[0].y);
    WORLD_POINTS.slice(1).forEach((point) => g.lineTo(point.x, point.y));
    g.strokePath();
    g.lineStyle(2, 0xf0d492).strokePath();
    WORLD_POINTS.forEach((point, index) => {
      const completed =
        index === 0 ||
        Boolean(
          BOSS_LOCATIONS[index - 1] &&
          this.save?.relics.includes(BOSS_LOCATIONS[index - 1]!.artifactId),
        );
      const current = index === this.routeIndex + 1;
      g.fillStyle(completed ? 0xf6d77a : 0x17374c).fillCircle(
        point.x,
        point.y,
        current ? 7 : 5,
      );
      const label = this.add
        .text(point.labelX, point.labelY, point.label, {
          align: 'center',
          backgroundColor: '#08111dcc',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '4px',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5);
      if (index > 0 && isLocationUnlocked(index - 1, this.save?.relics ?? []))
        label.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.routeIndex = index - 1;
          gameAudio.play('select');
          this.drawRouteMenu();
        });
      this.labels.push(label);
    });
    this.labels.push(
      this.add.text(17, 181, 'PACIFIC', {
        color: '#d8f2ff',
        fontFamily: 'monospace',
        fontSize: '4px',
      }),
      this.add.text(178, 183, 'HIGH DESERT', {
        color: '#644c2b',
        fontFamily: 'monospace',
        fontSize: '4px',
      }),
      this.add.text(137, 191, 'OREGON', {
        color: '#fff1b5',
        fontFamily: 'monospace',
        fontSize: '5px',
        fontStyle: 'bold',
      }),
    );
    const route = LOCATION_ROUTES[this.routeIndex];
    this.message?.setY(220);
    this.heading?.setText('THE CONNECTED QUEST MAP');
    this.message?.setText(
      route
        ? `${route.origin} → ${route.label.replace(' ROUTE', '')}\nARROWS: CHOOSE • A: DEPART • B: HOME`
        : 'ALL DESTINATIONS COMPLETE • B / ESC: HOME',
    );
    this.marker = this.add
      .circle(
        WORLD_POINTS[this.routeIndex + 1]?.x ?? 24,
        WORLD_POINTS[this.routeIndex + 1]?.y ?? 178,
        3,
        0xffffff,
      )
      .setStrokeStyle(1, 0x08111d);
    if (route) {
      this.departButton = this.add
        .text(128, 198, `START ${route.label.replace(' ROUTE', '')} ROUTE`, {
          align: 'center',
          backgroundColor: '#173f57ee',
          color: '#f6d77a',
          fontFamily: 'monospace',
          fontSize: '6px',
          fontStyle: 'bold',
          padding: { x: 7, y: 4 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.beginJourney());
    }
  }

  private beginJourney(): void {
    gameAudio.play('confirm');
    const route = LOCATION_ROUTES[this.routeIndex];
    if (!route || !this.save) return;
    if (!isLocationUnlocked(this.routeIndex, this.save.relics)) {
      this.message?.setText(
        'THAT ROUTE IS STILL LOCKED • COMPLETE THE PREVIOUS LOCATION',
      );
      return;
    }
    if (!this.save.flags[locationArrivalFlag(route.locationId)]) {
      this.scene.start('location-arrival', { routeIndex: this.routeIndex });
      return;
    }
    this.traveling = true;
    this.nodeIndex = 0;
    this.drawJourney();
  }

  private advanceRouteNode(): void {
    if (this.moving) return;
    if (this.nodeIndex < 4) {
      this.nodeIndex += 1;
      // Events open once the traveler has walked to the stop.
      this.moveMarker(() => {
        if (this.nodeIndex <= 3) this.openEvent();
      });
      return;
    }
    const route = LOCATION_ROUTES[this.routeIndex];
    if (route)
      this.scene.start('location-boss', { locationId: route.locationId });
  }

  private drawJourney(): void {
    const route = LOCATION_ROUTES[this.routeIndex];
    if (!route || !this.save) return;
    this.clearMap();
    this.graphics?.clear();
    const location = bossLocationById(route.locationId);
    const trail = journeyTrail(route.locationId);
    this.trail = trail;
    this.journeyObjects.push(
      addPainted(
        this,
        0,
        0,
        paintJourneyMap(this, route.locationId, trail),
        0,
        0,
      ),
    );
    this.progressDots = this.add.graphics();
    this.journeyObjects.push(this.progressDots);
    trail.layout.stops.forEach((_, index) =>
      this.drawStop(route, location, index),
    );
    const visual = playerVisual(this.save.activeTeamId);
    this.travelerShadow = this.add
      .ellipse(0, 0, 9, 3, 0x000000, 0.4)
      .setDepth(49);
    this.traveler = this.add
      .sprite(0, 0, visual.texture, visual.frame)
      .setScale(visual.scale * 0.34)
      .setOrigin(0.5, 0.92)
      .setDepth(50)
      .play(visual.idle);
    this.journeyObjects.push(this.travelerShadow, this.traveler);
    this.trailProgress.t = stopProgress(trail.layout, this.nodeIndex);
    this.placeTraveler();
    this.drawProgress();
    this.departButton = this.add
      .text(128, 206, 'ADVANCE TO NEXT STOP', {
        align: 'center',
        backgroundColor: '#173f57ee',
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '6px',
        fontStyle: 'bold',
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.advanceRouteNode());
    this.heading?.setText(route.label);
    this.message
      ?.setY(226)
      .setText(
        this.nodeIndex === 4
          ? 'LAIR REACHED • A / ENTER: BOSS BATTLE'
          : 'RIGHT / A: ADVANCE • LEFT: BACK • B / ESC: ROUTES',
      );
  }

  /** Start flag, event badges and the boss lair, each with a name plate. */
  private drawStop(
    route: (typeof LOCATION_ROUTES)[number],
    location: ReturnType<typeof bossLocationById>,
    index: number,
  ): void {
    const stops = this.trail?.layout.stops;
    const stop = stops?.[index];
    if (!stops || !stop) return;
    const g = this.add.graphics().setDepth(20);
    this.journeyObjects.push(g);
    let label: string;
    let labelColor = '#ffffff';
    if (index === 0) {
      g.lineStyle(1.2, 0x2a1c10).lineBetween(
        stop.x,
        stop.y + 2,
        stop.x,
        stop.y - 11,
      );
      g.fillStyle(location.color).fillTriangle(
        stop.x,
        stop.y - 11,
        stop.x + 8,
        stop.y - 8.5,
        stop.x,
        stop.y - 6,
      );
      g.fillStyle(0xf6d77a).fillCircle(stop.x, stop.y, 3);
      label = `FROM\n${route.origin}`;
      labelColor = '#d8e6ee';
    } else if (index === 4) {
      g.fillStyle(0x05080e, 0.85).fillCircle(stop.x, stop.y, 9);
      g.lineStyle(1.5, location.color, 0.95).strokeCircle(stop.x, stop.y, 9);
      const ring = this.add
        .circle(stop.x, stop.y, 9)
        .setStrokeStyle(1, location.color, 0.9)
        .setDepth(20);
      this.tweens.add({
        targets: ring,
        scale: 2,
        alpha: 0,
        duration: 1400,
        repeat: -1,
      });
      const eyes = lurkingEyes(
        this,
        stop.x,
        stop.y - 1,
        5.5,
        location.color,
        0.45,
        21,
      );
      this.journeyObjects.push(ring, eyes);
      label = location.bossName;
      labelColor = hexColor(location.color);
    } else {
      const event = route.events[index - 1];
      if (!event) return;
      const resolved = Boolean(
        this.save?.flags[routeEventFlag(route.locationId, event.id)],
      );
      const fill = resolved
        ? 0xf6d77a
        : event.kind === 'calamity'
          ? 0xd8553a
          : 0x3f9c5c;
      g.fillStyle(0x05080e, 0.6).fillCircle(stop.x + 0.8, stop.y + 1.2, 6.5);
      g.fillStyle(fill).fillCircle(stop.x, stop.y, 6);
      g.lineStyle(1.2, 0x05080e).strokeCircle(stop.x, stop.y, 6);
      g.lineStyle(0.6, 0xffffff, 0.5).strokeCircle(stop.x, stop.y, 4.6);
      const glyph = this.add
        .text(
          stop.x,
          stop.y,
          resolved ? '✓' : event.kind === 'calamity' ? '!' : '▲',
          {
            color: resolved ? '#3a2a08' : '#ffffff',
            fontFamily: 'monospace',
            fontSize: '6px',
            fontStyle: 'bold',
          },
        )
        .setOrigin(0.5)
        .setDepth(21);
      this.journeyObjects.push(glyph);
      if (!resolved && index === this.nodeIndex + 1) {
        const pulse = this.add
          .circle(stop.x, stop.y, 6)
          .setStrokeStyle(1, 0xffffff, 0.9)
          .setDepth(20);
        this.tweens.add({
          targets: pulse,
          scale: 1.9,
          alpha: 0,
          duration: 1000,
          repeat: -1,
        });
        this.journeyObjects.push(pulse);
      }
      const words = event.title.split(' ');
      const half = Math.ceil(words.length / 2);
      label =
        `${words.slice(0, half).join(' ')}\n${words.slice(half).join(' ')}`.trim();
      labelColor = resolved
        ? '#f6d77a'
        : event.kind === 'calamity'
          ? '#ffb09a'
          : '#b8f0c4';
    }
    // Put the plate on the side of the stop the trail does not use.
    const neighbours = [stops[index - 1], stops[index + 1]].filter(
      (point): point is (typeof stops)[number] => point !== undefined,
    );
    const isPeak = neighbours.every((point) => point.y > stop.y);
    const above = isPeak ? stop.y > 60 : stop.y >= 165;
    const plate = this.add
      // Plates above a stop clear the traveler standing on it.
      .text(stop.x, above ? stop.y - 24 : stop.y + 9, label, {
        align: 'center',
        backgroundColor: '#05080ecc',
        color: labelColor,
        fontFamily: 'monospace',
        fontSize: '5px',
        fontStyle: 'bold',
        lineSpacing: -1,
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, above ? 1 : 0)
      .setDepth(22);
    const halfWidth = plate.displayWidth / 2;
    plate.setX(
      Phaser.Math.Clamp(
        stop.x,
        JOURNEY_FRAME.x + 3 + halfWidth,
        JOURNEY_FRAME.x + JOURNEY_FRAME.width - 3 - halfWidth,
      ),
    );
    this.journeyObjects.push(plate);
  }

  private placeTraveler(): void {
    if (!this.trail || !this.traveler) return;
    const point = this.trail.curve.getPoint(this.trailProgress.t);
    if (Math.abs(point.x - this.traveler.x) > 0.05)
      this.traveler.setFlipX(point.x < this.traveler.x);
    this.traveler.setPosition(point.x, point.y);
    this.travelerShadow?.setPosition(point.x, point.y);
  }

  /** Gold footprints along the stretch of trail already walked. */
  private drawProgress(): void {
    if (!this.trail || !this.progressDots) return;
    const dots = this.progressDots.clear();
    for (let t = 0; t <= this.trailProgress.t; t += 0.011) {
      const point = this.trail.curve.getPoint(t);
      dots
        .fillStyle(0x05080e, 0.5)
        .fillCircle(point.x + 0.4, point.y + 0.5, 1.3);
      dots.fillStyle(0xf6d77a, 1).fillCircle(point.x, point.y, 1.1);
    }
  }

  private moveMarker(onArrive?: () => void): void {
    if (!this.trail || !this.traveler || !this.save) return;
    const target = stopProgress(this.trail.layout, this.nodeIndex);
    const distance = Math.abs(target - this.trailProgress.t);
    const visual = playerVisual(this.save.activeTeamId);
    this.moving = true;
    this.traveler.play(visual.walk, true);
    this.tweens.killTweensOf(this.trailProgress);
    this.tweens.add({
      targets: this.trailProgress,
      t: target,
      duration: Math.max(300, distance * 3800),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.placeTraveler();
        this.drawProgress();
      },
      onComplete: () => {
        this.moving = false;
        this.traveler?.play(visual.idle, true);
        if (this.nodeIndex === 4)
          this.message?.setText('LAIR REACHED • A / ENTER: BOSS BATTLE');
        onArrive?.();
      },
    });
  }
}
