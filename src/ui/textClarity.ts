import Phaser from 'phaser';

/** Renders small canvas text at higher internal resolution before pixel scaling. */
export function sharpenSceneText(scene: Phaser.Scene): void {
  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    child.setResolution(Math.max(2, Math.min(4, window.devicePixelRatio * 2)));
    child.setAlpha(1);
  });
}

