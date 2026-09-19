class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private musicGainNode: GainNode | null = null;
  private musicTimer: number | null = null;
  private isMusicPlaying: boolean = false;
  private currentChordIndex: number = 0;

  // Soothing chord progression for ambient gentle background music
  // Frequencies in Hz: Dm9 -> Bbmaj7 -> Gm9 -> Cadd9
  private ambientChords = [
    [146.83, 220.00, 261.63, 329.63, 392.00], // D3, A3, C4, E4, G4
    [116.54, 174.61, 233.08, 293.66, 349.23], // Bb2, F3, Bb3, D4, F4
    [98.00, 146.83, 196.00, 261.63, 329.63],  // G2, D3, G3, C4, E4
    [130.81, 196.00, 246.94, 293.66, 329.63], // C3, G3, B3, D4, E4
  ];

  // Gentle pentatonic chime drop notes (D pentatonic)
  private chimeNotes = [587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.initContext();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            if (this.musicEnabled && !this.isMusicPlaying) {
              this.startMusic();
            }
          }).catch(() => {});
        } else if (this.musicEnabled && !this.isMusicPlaying) {
          this.startMusic();
        }
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('click', unlockAudio);
      };

      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
      window.addEventListener('click', unlockAudio, { once: true });
    }
  }

  public initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  public isMusicOn(): boolean {
    return this.musicEnabled;
  }

  /**
   * Start soft, gentle ambient background music using procedural Web Audio synthesis
   * Creates lush, peaceful chord pads with slow breathing envelope and occasional high chimes
   */
  public startMusic() {
    if (!this.musicEnabled || this.isMusicPlaying) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      this.isMusicPlaying = true;
      if (!this.musicGainNode) {
        this.musicGainNode = ctx.createGain();
        this.musicGainNode.connect(ctx.destination);
      }

      // Very soft, relaxing volume level (0.055)
      const now = ctx.currentTime;
      this.musicGainNode.gain.setValueAtTime(0.0001, now);
      this.musicGainNode.gain.linearRampToValueAtTime(0.055, now + 2.0);

      this.scheduleNextAmbientChord();
    } catch (e) {
      this.isMusicPlaying = false;
    }
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGainNode && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.musicGainNode.gain.linearRampToValueAtTime(0.0001, now + 1.2);
      } catch (e) {}
    }
  }

  private scheduleNextAmbientChord() {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGainNode) return;

    try {
      const chord = this.ambientChords[this.currentChordIndex];
      this.currentChordIndex = (this.currentChordIndex + 1) % this.ambientChords.length;

      const now = this.ctx.currentTime;
      const duration = 6.0; // 6 seconds per breathing chord

      // Create warm lowpass filter for silky soft tone
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(580, now);
      filter.frequency.linearRampToValueAtTime(820, now + duration * 0.5);
      filter.frequency.linearRampToValueAtTime(580, now + duration);
      filter.Q.setValueAtTime(1.2, now);
      filter.connect(this.musicGainNode);

      // Play soft pad notes
      chord.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        // Slight detune for analog warmth
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime((idx - 2) * 3, now);

        osc.connect(noteGain);
        noteGain.connect(filter);

        // Smooth gentle attack, sustain, and release
        const peak = 0.035 / (chord.length * 0.85);
        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.linearRampToValueAtTime(peak, now + 1.8);
        noteGain.gain.setValueAtTime(peak, now + duration - 2.0);
        noteGain.gain.linearRampToValueAtTime(0.0001, now + duration);

        osc.start(now);
        osc.stop(now + duration + 0.1);
      });

      // Play 1-2 soft gentle chime drops during this chord
      const chimeDelay = 1.8 + Math.random() * 2.2;
      const chimeFreq = this.chimeNotes[Math.floor(Math.random() * this.chimeNotes.length)];
      this.playGentleChime(now + chimeDelay, chimeFreq);

      // Schedule next chord slightly before current one ends for seamless crossfade
      this.musicTimer = window.setTimeout(() => {
        this.scheduleNextAmbientChord();
      }, (duration - 1.2) * 1000);
    } catch (e) {
      this.isMusicPlaying = false;
    }
  }

  private playGentleChime(startTime: number, freq: number) {
    if (!this.ctx || !this.musicGainNode) return;
    try {
      const chimeOsc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();

      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(freq, startTime);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(this.musicGainNode);

      chimeGain.gain.setValueAtTime(0.0001, startTime);
      chimeGain.gain.linearRampToValueAtTime(0.025, startTime + 0.04);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.6);

      chimeOsc.start(startTime);
      chimeOsc.stop(startTime + 1.6);
    } catch (e) {}
  }

  /**
   * Sample-accurate, zero-latency Tap feedback sound.
   * Plays harmonic chime tones tuned to the pentatonic scale with escalating pitch on combos.
   */
  public playTap(hitType: 'PERFECT' | 'GREAT' | 'GOOD' | boolean = 'GREAT', comboCount: number = 0) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Pentatonic scale progression (G4 to E6)
      const pentatonic = [392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51];
      const noteIndex = Math.min(pentatonic.length - 1, comboCount);
      const baseFreq = pentatonic[noteIndex];

      const isPerfect = hitType === 'PERFECT' || hitType === true;
      const isGood = hitType === 'GOOD';

      // Primary oscillator (crisp attack, warm body)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isPerfect ? 'triangle' : isGood ? 'sine' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      // Subtle pitch bend for acoustic punch
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.08, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Instantaneous microsecond attack to avoid click while offering instant response
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(isPerfect ? 0.22 : 0.16, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isPerfect ? 0.14 : 0.09));

      osc.start(now);
      osc.stop(now + (isPerfect ? 0.15 : 0.10));

      // Shimmering overtone sparkle for PERFECT hits
      if (isPerfect) {
        const chime = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(baseFreq * 2.0, now); // Octave higher
        chime.frequency.exponentialRampToValueAtTime(baseFreq * 2.76, now + 0.08); // Bell partial

        chime.connect(chimeGain);
        chimeGain.connect(ctx.destination);

        chimeGain.gain.setValueAtTime(0.0001, now);
        chimeGain.gain.linearRampToValueAtTime(0.09, now + 0.003);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

        chime.start(now);
        chime.stop(now + 0.17);
      }
    } catch (e) {}
  }

  /**
   * Soft empty-space touch swish (when player taps empty arena without hitting any targets)
   * Non-punitive, pleasant swoosh sound
   */
  public playEmptyTap() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {}
  }

  // Miss / timeout / life lost buzzer (tactile, soft resonant thud)
  public playMiss() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.18);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch (e) {}
  }

  // Power-up ascending harp chord
  public playPowerUp() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        if (!ctx) return;
        const now = ctx.currentTime + idx * 0.035;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        osc.start(now);
        osc.stop(now + 0.19);
      });
    } catch (e) {}
  }

  // Victory fanfare
  public playVictory() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      melody.forEach((freq, idx) => {
        if (!ctx) return;
        const now = ctx.currentTime + idx * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.32);
      });
    } catch (e) {}
  }
}

export const soundEngine = new SoundEngine();

// Tactile Haptic Vibration feedback for phones
export function triggerHaptic(type: 'tap' | 'heavy' | 'success' | 'error' = 'tap') {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'tap') {
        navigator.vibrate(10);
      } else if (type === 'heavy') {
        navigator.vibrate([20, 25, 20]);
      } else if (type === 'success') {
        navigator.vibrate([15, 30, 25]);
      } else if (type === 'error') {
        navigator.vibrate([40, 30, 40]);
      }
    } catch (e) {}
  }
}

