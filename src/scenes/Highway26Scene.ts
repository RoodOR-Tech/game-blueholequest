import Phaser from 'phaser';
import { PhaserInput } from '../game/input/PhaserInput';

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

  constructor() {
    super('highway-26');
  }

  create(): void {
    this.controls = new PhaserInput(this);
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
    if (!this.controls) return;
    this.controls.update(this.input.gamepad?.getPad(0));

    if (
      (this.controls.actions.get('right').pressed ||
        this.controls.actions.get('up').pressed ||
        this.controls.actions.get('confirm').pressed) &&
      this.routeIndex < ROUTE.length - 1
    ) {
      this.routeIndex += 1;
      this.moveMarker();
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
  }

  private refreshLocation(): void {
    const point = ROUTE[this.routeIndex];
    if (!point || !this.locationText) return;
    if (this.routeIndex === 0) {
      this.locationText.setText('ROCKAWAY BEACH • ESC TO RETURN HOME');
    } else if (this.routeIndex === ROUTE.length - 1) {
      this.locationText.setText('HILLSBORO WEST REACHED • PALACE COMING NEXT');
    } else {
      this.locationText.setText(`${point.label} • KEEP TRAVELING EAST`);
    }
  }
}

