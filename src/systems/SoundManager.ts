/**
 * SoundManager - Procedural audio generation using Web Audio API
 */
import { SaveManager } from './SaveManager';

export class SoundManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private initialized: boolean = false;

    constructor() {
        // Initialize on first user interaction usually, but we'll try here
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);

                // Set volume based on settings
                const settings = SaveManager.getSettings();
                this.setVolume(settings.sound ? settings.soundVolume : 0);

                this.initialized = true;
            }
        } catch (e) {
            console.warn('AudioContext not supported');
        }
    }

    public setVolume(volume: number): void {
        if (!this.masterGain) return;
        // Exponential volume curve
        this.masterGain.gain.value = volume > 0 ? Math.pow(volume, 2) : 0;
    }

    public resume(): void {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private getAudioNodes(): { ctx: AudioContext; masterGain: GainNode } | null {
        if (!this.initialized || !this.ctx || !this.masterGain) return null;

        const settings = SaveManager.getSettings();
        this.setVolume(settings.sound ? settings.soundVolume : 0);

        if (!settings.sound) return null;

        return { ctx: this.ctx, masterGain: this.masterGain };
    }

    public playShoot(pitch: number = 1.0): void {
        const nodes = this.getAudioNodes();
        if (!nodes) return;
        const { ctx, masterGain } = nodes;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(masterGain);

        osc.type = 'square';

        const now = ctx.currentTime;
        const duration = 0.1;

        // Frequency sweep
        osc.frequency.setValueAtTime(800 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(300 * pitch, now + duration);

        // Amplitude envelope
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    public playHit(): void {
        const nodes = this.getAudioNodes();
        if (!nodes) return;
        const { ctx, masterGain } = nodes;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(masterGain);

        osc.type = 'sawtooth';

        const now = ctx.currentTime;
        const duration = 0.05;

        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + duration);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    public playExplosion(size: number = 1.0): void {
        const nodes = this.getAudioNodes();
        if (!nodes) return;
        const { ctx, masterGain } = nodes;

        // Noise buffer for explosion
        const duration = 0.3 * size;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        noise.start();
    }

    public playPowerup(): void {
        const nodes = this.getAudioNodes();
        if (!nodes) return;
        const { ctx, masterGain } = nodes;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(masterGain);

        osc.type = 'sine';

        const now = ctx.currentTime;
        const duration = 0.4;

        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(1200, now + duration);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    public playPurchase(): void {
        const nodes = this.getAudioNodes();
        if (!nodes) return;
        const { ctx, masterGain } = nodes;

        const now = ctx.currentTime;

        // Two tones (coin sound)
        const tone1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        tone1.connect(gain1);
        gain1.connect(masterGain);

        tone1.type = 'sine';
        tone1.frequency.setValueAtTime(1200, now);
        gain1.gain.setValueAtTime(0.1, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        tone1.start(now);
        tone1.stop(now + 0.1);

        const tone2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        tone2.connect(gain2);
        gain2.connect(masterGain);

        tone2.type = 'sine';
        tone2.frequency.setValueAtTime(1800, now + 0.1);
        gain2.gain.setValueAtTime(0.1, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        tone2.start(now + 0.1);
        tone2.stop(now + 0.3);
    }

    public playClick(): void {
        const nodes = this.getAudioNodes();
        if (!nodes) return;
        const { ctx, masterGain } = nodes;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(masterGain);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    }
}
