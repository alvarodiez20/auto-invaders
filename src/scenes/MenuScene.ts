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
    // Check for existing save
    this.hasSave = SaveManager.hasSave();

    // Create starfield background
    this.createStarfield();

    // Set up DOM UI
    this.setupMenuUI();
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

    // Build menu HTML
    this.menuOverlay.innerHTML = `
      <h1 class="menu-title">AUTO INVADERS</h1>
      <p class="menu-subtitle">Space Defense Automation System</p>
      <div class="menu-buttons">
        <button id="btn-start" class="menu-btn">New Game</button>
        <button id="btn-continue" class="menu-btn" ${!this.hasSave ? 'disabled' : ''}>Continue</button>
        <button id="btn-settings" class="menu-btn secondary">Settings</button>
        <button id="btn-import" class="menu-btn secondary">Import Save</button>
      </div>
    `;
    this.menuOverlay.classList.remove('hidden');

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

    // Bind events
    this.bindMenuEvents();
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
        this.startGame();
      }
    });

    // Settings
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.loadSettings();
      this.settingsOverlay.classList.remove('hidden');
    });

    document.getElementById('btn-settings-close')?.addEventListener('click', () => {
      this.saveSettings();
      this.settingsOverlay.classList.add('hidden');
    });

    // Import
    document.getElementById('btn-import')?.addEventListener('click', () => {
      this.showImportModal();
    });

    // UI Scale slider real-time preview
    document.getElementById('setting-scale')?.addEventListener('input', (e) => {
      const scale = (e.target as HTMLInputElement).value;
      document.documentElement.style.setProperty('--ui-scale', scale);
    });
  }

  private loadSettings(): void {
    const settings = SaveManager.getSettings();
    (document.getElementById('setting-sound') as HTMLInputElement).checked = settings.sound;
    (document.getElementById('setting-motion') as HTMLInputElement).checked = settings.reducedMotion;
    (document.getElementById('setting-scale') as HTMLInputElement).value = settings.uiScale.toString();
    document.documentElement.style.setProperty('--ui-scale', settings.uiScale.toString());
  }

  private saveSettings(): void {
    const sound = (document.getElementById('setting-sound') as HTMLInputElement).checked;
    const reducedMotion = (document.getElementById('setting-motion') as HTMLInputElement).checked;
    const uiScale = parseFloat((document.getElementById('setting-scale') as HTMLInputElement).value);

    SaveManager.saveSettings({ sound, reducedMotion, uiScale });
  }

  private showImportModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">Import Save</h3>
        <textarea id="import-data" placeholder="Paste your save code here..."></textarea>
        <div class="modal-buttons">
          <button id="btn-import-cancel" class="settings-btn">Cancel</button>
          <button id="btn-import-confirm" class="settings-btn primary">Import</button>
        </div>
      </div>
    `;
    document.getElementById('ui-overlay')?.appendChild(modal);

    document.getElementById('btn-import-cancel')?.addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('btn-import-confirm')?.addEventListener('click', () => {
      const data = (document.getElementById('import-data') as HTMLTextAreaElement).value;
      if (SaveManager.importSave(data)) {
        this.hasSave = true;
        const continueBtn = document.getElementById('btn-continue') as HTMLButtonElement;
        if (continueBtn) continueBtn.disabled = false;
        this.showToast('Save imported successfully!', 'success');
      } else {
        this.showToast('Invalid save data', 'error');
      }
      modal.remove();
    });
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.getElementById('ui-overlay')?.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  private startGame(): void {
    // Calculate offline progress if applicable
    const offlineScrap = SaveManager.calculateOfflineProgress();

    this.menuOverlay.classList.add('hidden');
    this.settingsOverlay.classList.add('hidden');

    this.scene.start('GameScene', { offlineScrap });
  }

  shutdown(): void {
    this.menuOverlay.classList.add('hidden');
    this.settingsOverlay.classList.add('hidden');
  }
}
