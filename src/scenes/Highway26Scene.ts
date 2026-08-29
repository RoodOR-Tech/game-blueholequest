import Phaser from 'phaser';
import {
  resolveWilsonRiverChoice,
  WILSON_RIVER_CHOICES,
} from '../game/calamities/wilsonRiver';
import { PhaserInput } from '../game/input/PhaserInput';
import { isHighway26FogGateBlocked } from '../game/progression/routeRules';
import { SaveRepository } from '../game/saves/repository';
import type { SaveData } from '../game/saves/schema';
import { TouchControls } from '../ui/TouchControls';

const ROUTE = [
  { x: 27, y: 184, label: 'ROCKAWAY' },
  { x: 63, y: 171, label: 'COAST' },
  { x: 98, y: 145, label: 'FOREST' },
  { x: 135, y: 126, label: 'PASS' },
  { x: 174, y: 102, label: 'HWY 26' },
  { x: 217, y: 78, label: 'HILLSBORO' },
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

    if (this.routeIndex === 2 && this.controls.actions.get('confirm').pressed) {
      this.scene.start('forest-quest');
      return;
    }

    if (
      this.routeIndex === ROUTE.length - 1 &&
      this.controls.actions.get('confirm').pressed
    ) {
      this.scene.start('foundry-test');
      return;
    }

    const advancing =
      (this.controls.actions.get('right').pressed ||
        this.controls.actions.get('up').pressed ||
        this.controls.actions.get('confirm').pressed) &&
      this.routeIndex < ROUTE.length - 1;
    if (advancing) {
      const targetIndex = this.routeIndex + 1;
      if (isHighway26FogGateBlocked(targetIndex, this.save.inventory)) {
        this.locationText?.setText(
          'COASTAL FOG BLOCKS THE PASS • FIND THE COLEMAN LANTERN',
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
    ROUTE.forEach((point) =>
      graphics.fillStyle(0x102b3f).fillCircle(point.x, point.y, 4),
    );

    this.add.text(10, 10, 'HIGHWAY 26 • COAST RANGE', {
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
      'FORD TRAFFIC  (-2 LIFE, +50 EXP)',
      'FLOAT SUBARU  (-2 MAGIC, +25 EXP)',
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
      },
      choice,
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
    this.locationText?.setText(outcome.summary);
  }

  private refreshLocation(): void {
    const point = ROUTE[this.routeIndex];
    if (!point || !this.locationText) return;
    if (this.routeIndex === 0) {
      this.locationText.setText('ROCKAWAY BEACH • ESC TO RETURN HOME');
    } else if (this.routeIndex === ROUTE.length - 1) {
      this.locationText.setText('HILLSBORO WEST • ENTER / A: ENTER FOUNDRY');
    } else if (this.routeIndex === 2) {
      this.locationText.setText('COAST RANGE FOREST • ENTER / A: EXPLORE');
    } else {
      this.locationText.setText(`${point.label} • KEEP TRAVELING EAST`);
    }
  }
}

