import Phaser from 'phaser';
import { gameAudio } from '../audio/GameAudio';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  BOSS_LOCATIONS,
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

const NODE_X = [28, 78, 128, 178, 228] as const;
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
    if (this.traveling) {
      this.drawJourney();
      this.marker?.setPosition(
        NODE_X[this.nodeIndex] ?? NODE_X[0],
        this.nodeY(this.nodeIndex),
      );
    } else this.drawRouteMenu();
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
    if (!this.controls) return;
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
    if (this.nodeIndex < 4) {
      this.nodeIndex += 1;
      this.moveMarker();
      if (this.nodeIndex <= 3) this.openEvent();
      return;
    }
    const route = LOCATION_ROUTES[this.routeIndex];
    if (route)
      this.scene.start('location-boss', { locationId: route.locationId });
  }

  private drawJourney(): void {
    const route = LOCATION_ROUTES[this.routeIndex];
    if (!route) return;
    this.clearMap();
    const g = this.graphics!;
    g.fillStyle(0x285c3e);
    for (let x = 9; x < 250; x += 22)
      g.fillTriangle(x, 201, x + 10, 169, x + 20, 201);
    g.lineStyle(5, 0x785738).lineBetween(NODE_X[0], 148, NODE_X[4], 84);
    g.lineStyle(2, 0xf0d492).lineBetween(NODE_X[0], 148, NODE_X[4], 84);
    NODE_X.forEach((x, index) => {
      const event = route.events[index - 1];
      const resolved =
        event !== undefined &&
        Boolean(this.save?.flags[routeEventFlag(route.locationId, event.id)]);
      g.fillStyle(
        index === 4 ? 0x8f3e38 : resolved ? 0xf6d77a : 0x17374c,
      ).fillCircle(x, this.nodeY(index), index === 4 ? 7 : 5);
    });
    this.marker = this.add
      .circle(NODE_X[0], this.nodeY(0), 4, 0xffffff)
      .setStrokeStyle(2, 0x08111d);
    this.labels.push(
      this.add.text(197, 60, 'BOSS + ARTIFACT', {
        color: '#7b2929',
        fontFamily: 'monospace',
        fontSize: '5px',
      }),
    );
    this.departButton = this.add
      .text(128, 198, 'ADVANCE TO NEXT STOP', {
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
    this.message?.setText('RIGHT / A: ADVANCE • LEFT: BACK • B / ESC: ROUTES');
  }

  private moveMarker(): void {
    const x = NODE_X[this.nodeIndex];
    if (x === undefined || !this.marker) return;
    this.tweens.add({
      targets: this.marker,
      x,
      y: this.nodeY(this.nodeIndex),
      duration: 150,
    });
    if (this.nodeIndex === 4)
      this.message?.setText('DESTINATION REACHED • A / ENTER: BOSS BATTLE');
  }

  private nodeY(index: number): number {
    return 148 - index * 16;
  }
}
