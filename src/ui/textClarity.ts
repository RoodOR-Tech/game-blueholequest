import Phaser from 'phaser';

/** Uses a solid screen font that remains legible when the game canvas is scaled. */
export function sharpenSceneText(scene: Phaser.Scene): void {
  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    child.setResolution(1);
    child.setFontFamily('Arial Black, Arial, sans-serif');
    child.setFontStyle('bold');
    child.setAlpha(1);
  });
}
