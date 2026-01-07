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
      <div class="menu-controls">
        <div class="menu-controls-row">
          <span class="menu-controls-label">MOVE</span>
          <div class="menu-keycaps">
            <span class="keycap">←</span>
            <span class="keycap">→</span>
            <span class="menu-controls-sep">OR</span>
            <span class="keycap">A</span>
            <span class="keycap">D</span>
          </div>
        </div>
        <div class="menu-controls-row">
          <span class="menu-controls-label">SHOOT</span>
          <div class="menu-keycaps">
            <span class="keycap">Space</span>
            <span class="menu-controls-sep">OR</span>
            <span class="keycap">Click</span>
          </div>
        </div>
      </div>
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
      if (this.hasSave) {
        // Show confirmation dialog if there's existing progress
        this.showNewGameConfirmation();
      } else {
        SaveManager.reset();
        this.startGame();
      }
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

  private showNewGameConfirmation(): void {
    const save = SaveManager.getCurrent();
    const sectorText = save.currentSector > 0
      ? `Sector ${save.currentSector}, Wave ${save.currentWave}`
      : `Wave ${save.currentWave}`;
    const scrapText = Math.floor(save.scrap).toLocaleString();

    const overlay = document.createElement('div');
    overlay.id = 'newgame-confirm-overlay';
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal" style="text-align: center; max-width: 400px;">
        <h3 class="modal-title" style="color: #ffdd44;">⚠️ Warning</h3>
        <p style="color: #e0e8ff; margin-bottom: 12px;">
          Starting a new game will <strong style="color: #ff4466;">erase all your progress</strong>:
        </p>
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; margin: 12px 0;">
          <p style="color: #44ddff; margin: 0;">Progress: ${sectorText}</p>
          <p style="color: #ffdd44; margin: 4px 0 0 0;">Scrap: ${scrapText}</p>
          <p style="color: #aa66ff; margin: 4px 0 0 0;">Cores: ${save.cores}</p>
        </div>
        <p style="color: #8899bb; font-size: 12px; margin-bottom: 20px;">
          All upgrades, scrap, and cores will be lost forever.
        </p>
        <div class="menu-buttons">
          <button id="btn-confirm-newgame" class="menu-btn" style="background: linear-gradient(135deg, #ff4466, #ff6644);">Reset & Start New</button>
          <button id="btn-cancel-newgame" class="menu-btn secondary">Cancel</button>
        </div>
      </div>
    `;
    document.getElementById('ui-overlay')?.appendChild(overlay);

    document.getElementById('btn-confirm-newgame')?.addEventListener('click', () => {
      overlay.remove();
      SaveManager.reset();
      this.startGame();
    });

    document.getElementById('btn-cancel-newgame')?.addEventListener('click', () => {
      overlay.remove();
    });
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
