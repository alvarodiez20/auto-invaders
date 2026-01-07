/**
 * MenuScene - Main menu with Start/Continue, Settings, Export/Import
 */
import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';

export class MenuScene extends Phaser.Scene {
  private menuOverlay!: HTMLElement;
  private settingsOverlay!: HTMLElement;
  private hasSave: boolean = false;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Refresh save check each time scene is created
    this.hasSave = SaveManager.hasSave();

    // Create starfield background
    this.createStarfield();

    // Set up DOM UI (will rebuild HTML each time)
    this.setupMenuUI();

    this.applyMenuLayout();
  }

  private createStarfield(): void {
    const graphics = this.add.graphics();

    // Draw random stars
    for (let i = 0; i < 150; i++) {
      const x = Phaser.Math.Between(0, 800);
      const y = Phaser.Math.Between(0, 600);
      const size = Phaser.Math.FloatBetween(0.5, 2);
      const alpha = Phaser.Math.FloatBetween(0.3, 1);

      graphics.fillStyle(0xffffff, alpha);
      graphics.fillCircle(x, y, size);
    }
  }

  private setupMenuUI(): void {
    this.menuOverlay = document.getElementById('menu-overlay')!;
    this.settingsOverlay = document.getElementById('settings-overlay')!;

    // Clear previous content to avoid duplication
    this.menuOverlay.innerHTML = '';
    this.settingsOverlay.innerHTML = '';

    // Build menu HTML
    this.menuOverlay.innerHTML = `
      <h1 class="menu-title">AUTO INVADERS</h1>
      <p class="menu-subtitle">Space Defense Automation System</p>
      <div class="menu-buttons">
        <button id="btn-start" class="menu-btn">New Game</button>
        <button id="btn-continue" class="menu-btn" ${!this.hasSave ? 'disabled' : ''}>Continue</button>
        <button id="btn-settings" class="menu-btn secondary">Settings</button>
      </div>
    `;
    this.menuOverlay.classList.remove('hidden');
    this.settingsOverlay.classList.add('hidden'); // Ensure hidden by default

    // Hide shop on menu
    document.getElementById('shop-container')?.classList.add('hidden');

    // Build settings HTML
    this.settingsOverlay.innerHTML = `
      <h2 class="settings-title">Settings</h2>
      <div class="settings-group">
        <label class="settings-label">
          <span>Sound</span>
          <div class="toggle-switch">
            <input type="checkbox" id="setting-sound" checked>
            <span class="toggle-slider"></span>
          </div>
        </label>
      </div>
      <div class="settings-group">
        <label class="settings-label">
          <span>Reduced Motion</span>
          <div class="toggle-switch">
            <input type="checkbox" id="setting-motion">
            <span class="toggle-slider"></span>
          </div>
        </label>
      </div>
      <div class="settings-group">
        <label class="settings-label">
          <span>UI Scale</span>
        </label>
        <input type="range" id="setting-scale" class="range-slider" min="0.8" max="1.2" step="0.1" value="1">
      </div>
      <div class="settings-buttons">
        <button id="btn-settings-close" class="settings-btn primary">Close</button>
      </div>
    `;

    // Bind events fresh (elements were just created)
    this.bindMenuEvents();
  }

  private applyMenuLayout(): void {
    document.getElementById('game-container')?.classList.add('full-width');
    document.getElementById('ui-overlay')?.classList.add('full-width');
    document.getElementById('shop-container')?.classList.add('hidden');
  }

  private bindMenuEvents(): void {
    // Start new game
    document.getElementById('btn-start')?.addEventListener('click', () => {
      SaveManager.reset();
      this.startGame();
    });

    // Continue
    document.getElementById('btn-continue')?.addEventListener('click', () => {
      if (this.hasSave) {
        SaveManager.load(); // Ensure we load the save
        this.startGame();
      }
    });

    // Settings
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.loadSettings();
      this.settingsOverlay.classList.remove('hidden');
    });

    document.getElementById('btn-settings-close')?.addEventListener('click', () => {
      try {
        this.saveSettings();
      } catch (e) {
        console.error('Error saving settings:', e);
      }
      this.settingsOverlay.classList.add('hidden');
    });

    // UI Scale slider real-time preview
    document.getElementById('setting-scale')?.addEventListener('input', (e) => {
      const scale = (e.target as HTMLInputElement).value;
      document.documentElement.style.setProperty('--ui-scale', scale);
    });
  }

  private loadSettings(): void {
    const settings = SaveManager.getSettings();
    const soundEl = document.getElementById('setting-sound') as HTMLInputElement;
    const motionEl = document.getElementById('setting-motion') as HTMLInputElement;
    const scaleEl = document.getElementById('setting-scale') as HTMLInputElement;

    if (soundEl) soundEl.checked = settings.sound;
    if (motionEl) motionEl.checked = settings.reducedMotion;
    if (scaleEl) scaleEl.value = settings.uiScale.toString();

    document.documentElement.style.setProperty('--ui-scale', settings.uiScale.toString());
  }

  private saveSettings(): void {
    const soundEl = document.getElementById('setting-sound') as HTMLInputElement;
    const motionEl = document.getElementById('setting-motion') as HTMLInputElement;
    const scaleEl = document.getElementById('setting-scale') as HTMLInputElement;

    const sound = soundEl?.checked ?? true;
    const reducedMotion = motionEl?.checked ?? false;
    const uiScale = scaleEl ? parseFloat(scaleEl.value) : 1;

    SaveManager.saveSettings({ sound, reducedMotion, uiScale });
  }



  private startGame(): void {
    // Calculate offline progress if applicable
    const offlineScrap = SaveManager.calculateOfflineProgress();

    this.menuOverlay.classList.add('hidden');
    this.settingsOverlay.classList.add('hidden');

    // Show shop when game starts
    document.getElementById('shop-container')?.classList.remove('hidden');

    this.scene.start('GameScene', { offlineScrap });
  }

  shutdown(): void {
    this.menuOverlay?.classList.add('hidden');
    this.settingsOverlay?.classList.add('hidden');
  }
}
