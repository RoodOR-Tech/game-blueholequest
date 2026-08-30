import Phaser from 'phaser';
import {
  resolveWilsonRiverChoice,
  WILSON_RIVER_CHOICES,
} from '../game/calamities/wilsonRiver';
import { PhaserInput } from '../game/input/PhaserInput';
import {
  BOSS_LOCATIONS,
  isLocationUnlocked,
} from '../game/progression/bossLocations';
import { recoverFromGameOver } from '../game/progression/lives';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const ROUTE = [
  { x: 25, y: 190, label: 'ROCKAWAY', locationId: null },
  { x: 65, y: 165, label: 'HILLSBORO W', locationId: 'hillsboro_west' },
  { x: 105, y: 140, label: 'HILLSBORO E', locationId: 'hillsboro_east' },
  { x: 145, y: 119, label: 'MILWAUKIE', locationId: 'milwaukie' },
  { x: 186, y: 94, label: 'WALLA WALLA', locationId: 'walla_walla' },
  { x: 228, y: 70, label: 'BEND', locationId: 'bend' },
] as const;

export class Highway26Scene extends Phaser.Scene {
  private controls?: PhaserInput;
  private marker?: Phaser.GameObjects.Arc;
  private locationText?: Phaser.GameObjects.Text;
  private routeIndex = 0;
  private save?: SaveData;
  private calamity?: Phaser.GameObjects.Container;
  private calamityChoiceIndex = 0;
  private calamityChoiceTexts: Phaser.GameObjects.Text[] = [];
  private calamityGameOver = false;
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
    this.drawMap();
    this.marker = this.add
      .circle(ROUTE[0].x, ROUTE[0].y, 5, 0xf6d77a)
      .setStrokeStyle(2, 0x08111d);
    this.locationText = this.add
      .text(128, 218, '', {
        align: 'center',
        backgroundColor: '#08111ddd',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5);
    this.refreshLocation();
  }

  update(): void {
    if (!this.controls || !this.save) return;
    this.controls.update(this.input.gamepad?.getPad(0));

    if (this.calamityGameOver) {
      if (this.controls.actions.get('confirm').pressed) {
        this.save = recoverFromGameOver(this.save, new Date().toISOString());
        this.repository.save(this.save);
        this.scene.start('blue-hole-hub');
      }
      return;
    }

    if (this.calamity) {
      if (this.controls.actions.get('up').pressed) {
        this.calamityChoiceIndex =
          (this.calamityChoiceIndex + WILSON_RIVER_CHOICES.length - 1) %
          WILSON_RIVER_CHOICES.length;
        this.refreshCalamityChoices();
      }
      if (this.controls.actions.get('down').pressed) {
        this.calamityChoiceIndex =
          (this.calamityChoiceIndex + 1) % WILSON_RIVER_CHOICES.length;
        this.refreshCalamityChoices();
      }
      if (this.controls.actions.get('confirm').pressed) this.resolveCalamity();
      return;
    }

    const selectedLocation = ROUTE[this.routeIndex]?.locationId;
    if (selectedLocation && this.controls.actions.get('confirm').pressed) {
      this.scene.start('location-boss', { locationId: selectedLocation });
      return;
    }

    const advancing =
      (this.controls.actions.get('right').pressed ||
        this.controls.actions.get('up').pressed ||
        this.controls.actions.get('confirm').pressed) &&
      this.routeIndex < ROUTE.length - 1;
    if (advancing) {
      const targetIndex = this.routeIndex + 1;
      const locationIndex = targetIndex - 1;
      if (!isLocationUnlocked(locationIndex, this.save.relics)) {
        const previous = BOSS_LOCATIONS[locationIndex - 1];
        this.locationText?.setText(
          `RECOVER THE ${previous?.crystalName ?? 'PREVIOUS CRYSTAL'} FIRST`,
        );
        this.cameras.main.shake(100, 0.003);
      } else {
        this.routeIndex = targetIndex;
        this.moveMarker();
      }
    }

    if (
      (this.controls.actions.get('left').pressed ||
        this.controls.actions.get('down').pressed) &&
      this.routeIndex > 0
    ) {
      this.routeIndex -= 1;
      this.moveMarker();
    }

    if (this.controls.actions.get('cancel').pressed) {
      this.scene.start('blue-hole-hub');
    }
  }

  private drawMap(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x2772a5).fillRect(0, 0, 256, 240);
    graphics.fillStyle(0xd7b46a).fillRect(13, 48, 230, 153);
    graphics.fillStyle(0x22583a);
    for (let x = 35; x < 210; x += 24) {
      graphics.fillTriangle(
        x,
        164 - x / 3,
        x + 9,
        143 - x / 3,
        x + 18,
        164 - x / 3,
      );
    }
    graphics.lineStyle(6, 0x6a4b2f);
    graphics.beginPath();
    graphics.moveTo(ROUTE[0].x, ROUTE[0].y);
    ROUTE.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.strokePath();
    graphics.lineStyle(2, 0xf0d492).strokePath();
    ROUTE.forEach((point, index) => {
      const location = index > 0 ? BOSS_LOCATIONS[index - 1] : undefined;
      const completed =
        location !== undefined &&
        this.save?.relics.includes(location.crystalId);
      graphics
        .fillStyle(completed ? 0xf6d77a : 0x102b3f)
        .fillCircle(point.x, point.y, completed ? 5 : 4);
    });

    this.add.text(10, 10, 'THE CRYSTAL ROUTE', {
      color: '#f6d77a',
      fontFamily: 'monospace',
      fontSize: '9px',
      fontStyle: 'bold',
    });
    this.add.text(10, 25, 'RIGHT / UP / ENTER: TRAVEL  •  ESC: HOME', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '6px',
    });
    this.add.text(10, 205, 'GOLD STOPS: CRYSTAL RECOVERED', {
      color: '#6a4b2f',
      fontFamily: 'monospace',
      fontSize: '5px',
    });
  }

  private moveMarker(): void {
    const point = ROUTE[this.routeIndex];
    if (!point || !this.marker) return;
    this.tweens.add({
      targets: this.marker,
      x: point.x,
      y: point.y,
      duration: 140,
    });
    this.refreshLocation();
    if (this.routeIndex === 1 && !this.save?.flags.calamity_wilson_river_seen) {
      this.showCalamity();
    }
  }

  private showCalamity(): void {
    const shade = this.add
      .rectangle(128, 120, 236, 152, 0x08111d, 0.96)
      .setStrokeStyle(2, 0xf6d77a);
    const title = this.add
      .text(128, 58, 'OREGON TRAIL CALAMITY!', {
        color: '#f6d77a',
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const body = this.add
      .text(128, 84, 'WILSON RIVER CROSSING\nCHOOSE YOUR RISK:', {
        align: 'center',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '7px',
        lineSpacing: 2,
      })
      .setOrigin(0.5);
    const labels = [
      'FORD (-2 HEALTH, +50 EXP, 25% LIFE RISK)',
      'FLOAT (-2 MAGIC, +25 EXP, 10% LIFE RISK)',
      'WAIT FOR ODOT  (SAFE)',
    ];
    this.calamityChoiceTexts = labels.map((label, index) =>
      this.add
        .text(128, 113 + index * 19, label, {
          align: 'center',
          fontFamily: 'monospace',
          fontSize: '7px',
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5),
    );
    const hint = this.add
      .text(128, 177, 'UP / DOWN: CHOOSE  •  A / ENTER: COMMIT', {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '6px',
      })
      .setOrigin(0.5);
    this.calamityChoiceIndex = 0;
    this.calamity = this.add
      .container(0, 0, [shade, title, body, ...this.calamityChoiceTexts, hint])
      .setDepth(200);
    this.refreshCalamityChoices();
  }

  private refreshCalamityChoices(): void {
    this.calamityChoiceTexts.forEach((text, index) => {
      const selected = index === this.calamityChoiceIndex;
      text
        .setText(`${selected ? '▶' : ' '} ${text.text.replace(/^.? /, '')}`)
        .setColor(selected ? '#f6d77a' : '#ffffff')
        .setBackgroundColor(selected ? '#31485a' : '');
    });
  }

  private resolveCalamity(): void {
    if (!this.calamity || !this.save) return;
    const choice = WILSON_RIVER_CHOICES[this.calamityChoiceIndex];
    if (!choice) return;
    const outcome = resolveWilsonRiverChoice(
      {
        life: this.save.resources.life,
        magic: this.save.resources.magic,
        experience: this.save.stats.experience,
        lives: this.save.resources.lives,
      },
      choice,
      Math.random(),
    );
    this.calamity.destroy(true);
    this.calamity = undefined;
    this.calamityChoiceTexts = [];
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
        calamity_wilson_river_seen: true,
        [outcome.flag]: true,
      },
      savedAt: new Date().toISOString(),
    };
    this.repository.save(this.save);
    if (outcome.lives === 0) {
      this.calamityGameOver = true;
      this.locationText?.setText(
        'FINAL LIFE LOST • GAME OVER • ENTER / A: RECOVER HOME (-25% EXP)',
      );
    } else this.locationText?.setText(outcome.summary);
  }

  private refreshLocation(): void {
    const point = ROUTE[this.routeIndex];
    if (!point || !this.locationText) return;
    if (this.routeIndex === 0) {
      this.locationText.setText('ROCKAWAY BEACH • ESC TO RETURN HOME');
    } else {
      const location = BOSS_LOCATIONS[this.routeIndex - 1];
      this.locationText.setText(
        `${location?.label ?? point.label} • ENTER / A: BOSS FIGHT`,
      );
    }
  }
}
