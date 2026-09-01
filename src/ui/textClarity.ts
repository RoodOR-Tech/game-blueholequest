import Phaser from 'phaser';

const clarifiedText = new WeakSet<Phaser.GameObjects.Text>();

/** Uses a solid screen font that remains legible when the game canvas is scaled. */
export function sharpenSceneText(scene: Phaser.Scene): void {
  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    if (clarifiedText.has(child)) return;
    child.setResolution(1);
    child.setFontFamily('Arial Black, Arial, sans-serif');
    child.setFontStyle('bold');
    child.setAlpha(1);
    clarifiedText.add(child);
  });
}

/** Keeps every scene readable, including text created after a scene first opens. */
export function installGameTextClarity(game: Phaser.Game): void {
  game.scene.scenes.forEach((scene) => {
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, () => sharpenSceneText(scene));
  });
}
