import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './app/config';
import { installDisplay } from './app/display';
import { installPauseMenu } from './ui/PauseMenu';
import { installTouchControls } from './ui/TouchControls';

// Choose the control layout first so the picture is sized around it.
installTouchControls();
const game = new Phaser.Game(gameConfig);
game.events.once(Phaser.Core.Events.READY, () => {
  installDisplay(game);
  installPauseMenu(game);
});
