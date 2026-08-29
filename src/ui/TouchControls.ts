import Phaser from 'phaser';
import type { GameAction } from '../game/input/actions';
import { PhaserInput } from '../game/input/PhaserInput';

interface TouchButtonDefinition {
  readonly action: GameAction;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

const BUTTONS: readonly TouchButtonDefinition[] = [
  { action: 'up', label: '▲', x: 34, y: 174, radius: 10 },
  { action: 'left', label: '◀', x: 21, y: 187, radius: 10 },
  { action: 'right', label: '▶', x: 47, y: 187, radius: 10 },
  { action: 'down', label: '▼', x: 34, y: 200, radius: 10 },
  { action: 'confirm', label: 'A', x: 226, y: 187, radius: 14 },
  { action: 'cancel', label: 'B', x: 196, y: 198, radius: 10 },
];

export class TouchControls {
  constructor(scene: Phaser.Scene, input: PhaserInput) {
    BUTTONS.forEach((definition) => {
      const button = scene.add
        .circle(definition.x, definition.y, definition.radius, 0x08111d, 0.48)
        .setStrokeStyle(1, 0xcfe9f4, 0.75)
        .setInteractive({ useHandCursor: true })
        .setDepth(300);
      const label = scene.add
        .text(definition.x, definition.y, definition.label, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: `${definition.radius}px`,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setAlpha(0.8)
        .setDepth(301);

      const release = (): void => {
        input.setVirtualAction(definition.action, false);
        button.setFillStyle(0x08111d, 0.48);
      };
      button.on('pointerdown', () => {
        input.setVirtualAction(definition.action, true);
        button.setFillStyle(0x2d789b, 0.8);
      });
      button.on('pointerup', release);
      button.on('pointerout', release);
      button.on('pointercancel', release);
      label.disableInteractive();
    });
  }
}

