class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  // Tactile tap feedback sound
  public playTap(isPerfect: boolean = false, comboCount: number = 0) {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // Scale pitch with combo count (escalating excitement)
      const baseFreq = isPerfect ? 587.33 : 440; // D5 vs A4
      const pitchBonus = Math.min(comboCount * 18, 400);
      osc.frequency.setValueAtTime(baseFreq + pitchBonus, now);
      osc.frequency.exponentialRampToValueAtTime((baseFreq + pitchBonus) * 1.5, now + 0.08);

      osc.type = isPerfect ? 'triangle' : 'sine';

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isPerfect ? 0.12 : 0.08));

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      // Ignore audio failure
    }
  }

  // Miss or hazard buzzer
  public playMiss() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(70, now + 0.22);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  // Power-up chord
  public playPowerUp() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.05;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
      });
    } catch (e) {}
  }

  // Victory fanfare
  public playVictory() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      melody.forEach((freq, idx) => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.start(now);
        osc.stop(now + 0.35);
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
        navigator.vibrate(12);
      } else if (type === 'heavy') {
        navigator.vibrate([25, 30, 25]);
      } else if (type === 'success') {
        navigator.vibrate([15, 40, 30]);
      } else if (type === 'error') {
        navigator.vibrate([50, 40, 60]);
      }
    } catch (e) {}
  }
}
