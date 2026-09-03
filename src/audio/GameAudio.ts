import Phaser from 'phaser';

export type AudioTheme = 'title' | 'route' | 'boss' | 'victory';
export type SoundEffect =
  | 'select'
  | 'confirm'
  | 'jump'
  | 'attack'
  | 'hit'
  | 'calamity'
  | 'clear'
  | 'artifact'
  | 'firework';

const NOTE = (semitones: number): number => 220 * 2 ** (semitones / 12);
const THEMES: Record<
  AudioTheme,
  { notes: number[]; beat: number; wave: OscillatorType }
> = {
  title: { notes: [0, 7, 12, 7, 3, 10, 12, 10], beat: 360, wave: 'triangle' },
  route: { notes: [0, 3, 7, 10, 7, 3, 5, 7], beat: 260, wave: 'square' },
  boss: { notes: [0, 0, 1, 7, 0, 10, 8, 1], beat: 175, wave: 'sawtooth' },
  victory: { notes: [0, 4, 7, 12, 7, 11, 14, 19], beat: 190, wave: 'square' },
};

class GameAudioController {
  private context?: AudioContext;
  private master?: GainNode;
  private theme: AudioTheme = 'title';
  private timer?: number;
  private step = 0;
  private muted = window.localStorage.getItem('blue-hole-muted') === 'true';

  bind(scene: Phaser.Scene, theme: AudioTheme): void {
    this.setTheme(theme);
    const unlock = () => this.unlock();
    scene.input.once('pointerdown', unlock);
    scene.input.keyboard?.once('keydown', unlock);
    scene.input.keyboard?.on('keydown-M', this.toggleMute, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      scene.input.keyboard?.off('keydown-M', this.toggleMute, this),
    );
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(effect: SoundEffect): void {
    if (!this.context || !this.master || this.muted) return;
    const patterns: Record<
      SoundEffect,
      Array<[number, number, OscillatorType]>
    > = {
      select: [[7, 0.045, 'square']],
      confirm: [
        [12, 0.06, 'square'],
        [19, 0.09, 'square'],
      ],
      jump: [
        [0, 0.05, 'square'],
        [7, 0.08, 'square'],
      ],
      attack: [
        [12, 0.04, 'sawtooth'],
        [5, 0.07, 'square'],
      ],
      hit: [[-8, 0.12, 'sawtooth']],
      calamity: [
        [-12, 0.16, 'sawtooth'],
        [-17, 0.2, 'square'],
      ],
      clear: [
        [0, 0.06, 'square'],
        [4, 0.06, 'square'],
        [7, 0.13, 'square'],
      ],
      artifact: [
        [0, 0.07, 'triangle'],
        [7, 0.07, 'triangle'],
        [12, 0.18, 'triangle'],
      ],
      firework: [
        [19, 0.06, 'square'],
        [12, 0.16, 'sawtooth'],
      ],
    };
    let offset = 0;
    patterns[effect].forEach(([note, duration, wave]) => {
      this.tone(
        NOTE(note),
        duration,
        wave,
        this.context!.currentTime + offset,
        0.13,
      );
      offset += duration * 0.65;
    });
  }

  private unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.context.destination);
    }
    void this.context.resume();
    this.restartTheme();
  }

  private setTheme(theme: AudioTheme): void {
    if (this.theme === theme && this.timer) return;
    this.theme = theme;
    this.restartTheme();
  }

  private restartTheme(): void {
    if (this.timer) window.clearInterval(this.timer);
    if (!this.context || !this.master) return;
    this.step = 0;
    const theme = THEMES[this.theme];
    const playBeat = () => {
      if (!this.context || this.muted) return;
      const note = theme.notes[this.step % theme.notes.length]!;
      this.tone(
        NOTE(note - 12),
        theme.beat / 900,
        theme.wave,
        this.context.currentTime,
        0.045,
      );
      if (this.step % 2 === 0)
        this.tone(
          NOTE(note + 7),
          theme.beat / 1400,
          'triangle',
          this.context.currentTime,
          0.025,
        );
      this.step += 1;
    };
    playBeat();
    this.timer = window.setInterval(playBeat, theme.beat);
  }

  private tone(
    frequency: number,
    duration: number,
    wave: OscillatorType,
    start: number,
    volume: number,
  ): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    window.localStorage.setItem('blue-hole-muted', String(this.muted));
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
  }
}

export const gameAudio = new GameAudioController();
