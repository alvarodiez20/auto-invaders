/**
 * VictoryScene - Displayed after completing all sectors
 */
import Phaser from 'phaser';
import { SaveManager, GameSave } from '../systems/SaveManager';

export class VictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryScene' });
    }

    create(): void {
        const save = SaveManager.load();

        // Create background
        this.createBackground();

        // Display victory UI
        this.setupVictoryUI(save);
    }

    private createBackground(): void {
        const graphics = this.add.graphics();

        // Radial gradient effect using circles
        for (let i = 20; i > 0; i--) {
            const alpha = 0.02 * (20 - i);
            graphics.fillStyle(0x4488ff, alpha);
            graphics.fillCircle(400, 300, i * 30);
        }

        // Stars
        for (let i = 0; i < 200; i++) {
            const x = Phaser.Math.Between(0, 800);
            const y = Phaser.Math.Between(0, 600);
            const size = Phaser.Math.FloatBetween(0.5, 2.5);
            const alpha = Phaser.Math.FloatBetween(0.3, 1);

            graphics.fillStyle(0xffffff, alpha);
            graphics.fillCircle(x, y, size);
        }
    }

    private setupVictoryUI(save: GameSave): void {
        const overlay = document.getElementById('menu-overlay')!;

        const totalKills = save.stats?.totalKills || 0;
        const totalScrap = save.stats?.totalScrapEarned || 0;
        const playTime = this.formatTime(save.stats?.playTime || 0);
        const bossesDefeated = save.stats?.bossesDefeated || 0;

        overlay.innerHTML = `
      <div class="victory-screen">
        <h1 class="victory-title">VICTORY</h1>
        <p class="menu-subtitle">Earth's defense systems are fully operational</p>
        
        <div class="victory-stats">
          <div class="stat-item">
            <div class="stat-value">${totalKills.toLocaleString()}</div>
            <div class="stat-label">Enemies Destroyed</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${Math.floor(totalScrap).toLocaleString()}</div>
            <div class="stat-label">Total Scrap</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${bossesDefeated}</div>
            <div class="stat-label">Bosses Defeated</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${playTime}</div>
            <div class="stat-label">Play Time</div>
          </div>
        </div>
        
        <div class="menu-buttons" style="margin-top: 32px;">
          <button id="btn-menu" class="menu-btn">Return to Menu</button>
          <button id="btn-export" class="menu-btn secondary">Export Save</button>
        </div>
      </div>
    `;
        overlay.classList.remove('hidden');

        document.getElementById('btn-menu')?.addEventListener('click', () => {
            overlay.classList.add('hidden');
            this.scene.start('MenuScene');
        });

        document.getElementById('btn-export')?.addEventListener('click', () => {
            this.showExportModal();
        });
    }

    private formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    private showExportModal(): void {
        const exportData = SaveManager.exportSave();

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">Export Save</h3>
        <textarea id="export-data" readonly>${exportData}</textarea>
        <div class="modal-buttons">
          <button id="btn-export-copy" class="settings-btn primary">Copy to Clipboard</button>
          <button id="btn-export-close" class="settings-btn">Close</button>
        </div>
      </div>
    `;
        document.getElementById('ui-overlay')?.appendChild(modal);

        document.getElementById('btn-export-copy')?.addEventListener('click', () => {
            navigator.clipboard.writeText(exportData);
            const btn = document.getElementById('btn-export-copy')!;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
        });

        document.getElementById('btn-export-close')?.addEventListener('click', () => {
            modal.remove();
        });
    }

    shutdown(): void {
        document.getElementById('menu-overlay')?.classList.add('hidden');
    }
}
