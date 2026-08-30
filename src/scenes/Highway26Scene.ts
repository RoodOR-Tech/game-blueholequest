import Phaser from 'phaser';
import { PhaserInput } from '../game/input/PhaserInput';
import { BOSS_LOCATIONS } from '../game/progression/bossLocations';
import {
  LOCATION_ROUTES,
  resolveRouteChoice,
  routeEventFlag,
  type RouteEvent,
} from '../game/progression/locationRoutes';
import { recoverFromGameOver } from '../game/progression/lives';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const NODE_X = [28, 78, 128, 178, 228] as const;

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
  private eventPanel?: Phaser.GameObjects.Container;
  private activeEvent?: RouteEvent;
  private choiceIndex = 0;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private gameOver = false;
  private readonly repository = new SaveRepository(window.localStorage);

  constructor() {
    super('highway-26');
  }

  create(): void {
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
    this.drawRouteMenu();
  }

  update(): void {
    if (!this.controls || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));
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
    if (this.controls.actions.get('up').pressed) {
      this.routeIndex = Phaser.Math.Wrap(
        this.routeIndex - 1,
        0,
        LOCATION_ROUTES.length,
      );
      this.drawRouteMenu();
    }
    if (this.controls.actions.get('down').pressed) {
      this.routeIndex = Phaser.Math.Wrap(
        this.routeIndex + 1,
        0,
        LOCATION_ROUTES.length,
      );
      this.drawRouteMenu();
    }
    if (this.controls.actions.get('confirm').pressed) {
      this.traveling = true;
      this.nodeIndex = 0;
      this.drawJourney();
    }
    if (this.controls.actions.get('cancel').pressed)
      this.scene.start('blue-hole-hub');
  }

  private updateRoute(): void {
    if (!this.controls) return;
    const advance =
      this.controls.actions.get('right').pressed ||
      this.controls.actions.get('confirm').pressed;
    if (advance && this.nodeIndex < 4) {
      this.nodeIndex += 1;
      this.moveMarker();
      if (this.nodeIndex <= 3) this.openEvent();
    } else if (advance && this.nodeIndex === 4) {
      const route = LOCATION_ROUTES[this.routeIndex];
      if (route)
        this.scene.start('location-boss', { locationId: route.locationId });
    }
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
        .text(128, 120 + index * 24, choice.label, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '7px',
          padding: { x: 5, y: 4 },
        })
        .setOrigin(0.5),
    );
    const hint = this.add
      .text(128, 178, 'UP / DOWN: CHOOSE • A / ENTER: COMMIT', {
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
    const route = LOCATION_ROUTES[this.routeIndex];
    const event = this.activeEvent;
    const choice = event?.choices[this.choiceIndex];
    if (!route || !event || !choice || !this.save) return;
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
    this.repository.save(this.save);
    this.eventPanel?.destroy(true);
    this.eventPanel = undefined;
    this.activeEvent = undefined;
    this.choiceTexts = [];
    if (outcome.lives === 0) {
      this.gameOver = true;
      this.message?.setText('FINAL LIFE LOST • A / ENTER: RECOVER HOME');
    } else
      this.message?.setText(
        `${choice.summary.toUpperCase()}${outcome.lostLife ? ' • LIFE LOST!' : ''}`,
      );
  }

  private refreshChoices(): void {
    this.choiceTexts.forEach((text, index) => {
      const selected = index === this.choiceIndex;
      text
        .setColor(selected ? '#f6d77a' : '#ffffff')
        .setBackgroundColor(selected ? '#27485d' : '')
        .setText(
          `${selected ? '▶ ' : ''}${this.activeEvent?.choices[index]?.label ?? ''}`,
        );
    });
  }

  private clearMap(): void {
    this.graphics?.destroy();
    this.marker?.destroy();
    this.labels.forEach((label) => label.destroy());
    this.labels = [];
    this.graphics = this.add.graphics();
    this.graphics.fillStyle(0xd9b76d).fillRoundedRect(8, 30, 240, 174, 5);
  }

  private drawRouteMenu(): void {
    this.clearMap();
    const g = this.graphics!;
    LOCATION_ROUTES.forEach((route, index) => {
      const y = 51 + index * 31;
      const location = BOSS_LOCATIONS[index];
      const selected = index === this.routeIndex;
      const complete =
        location !== undefined && this.save?.relics.includes(location.crystalId);
      g.lineStyle(selected ? 3 : 1, selected ? 0xf6d77a : 0x76583c);
      g.lineBetween(28, 116, 186, y);
      g.fillStyle(complete ? 0xf6d77a : selected ? 0x2c7794 : 0x17374c)
        .fillCircle(194, y, selected ? 7 : 5);
      this.labels.push(
        this.add
          .text(238, y, route.label.replace(' ROUTE', ''), {
            color: selected ? '#08111d' : '#355065',
            fontFamily: 'monospace',
            fontSize: '5px',
            fontStyle: selected ? 'bold' : 'normal',
          })
          .setOrigin(1, 0.5),
      );
    });
    g.fillStyle(0x175574).fillCircle(28, 116, 8);
    this.heading?.setText('CHOOSE A DESTINATION ROUTE');
    this.message?.setText('UP / DOWN: ROUTE • A / ENTER: DEPART • B / ESC: HOME');
    this.marker = this.add
      .circle(194, 51 + this.routeIndex * 31, 3, 0xffffff)
      .setStrokeStyle(1, 0x08111d);
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
      g.fillStyle(index === 4 ? 0x8f3e38 : resolved ? 0xf6d77a : 0x17374c)
        .fillCircle(x, this.nodeY(index), index === 4 ? 7 : 5);
    });
    this.marker = this.add
      .circle(NODE_X[0], this.nodeY(0), 4, 0xffffff)
      .setStrokeStyle(2, 0x08111d);
    this.labels.push(
      this.add.text(197, 60, 'BOSS + CRYSTAL', {
        color: '#7b2929',
        fontFamily: 'monospace',
        fontSize: '5px',
      }),
    );
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
