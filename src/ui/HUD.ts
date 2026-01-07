/**
 * HUD - In-game heads-up display
 */
import { SaveManager } from '../systems/SaveManager';
import { OVERLOAD_COOLDOWN, OVERDRIVE_COOLDOWN, WAVES_PER_SECTOR } from '../config/GameConfig';

// Forward reference to avoid circular import
interface GameSceneInterface {
  waveManager: {
    getCurrentWaveInfo(): { sector: number; wave: number; sectorName: string };
    isBossActive(): boolean;
  };
  player: {
    currentHP: number;
    maxHP: number;
    isAutopilotEnabled?: () => boolean;
  };
  getDPS(): number;
  getSPS(): number;
  toggleAutopilot?: () => void;
}

export class HUD {
  private scene: GameSceneInterface;
  private container: HTMLElement;
  private abilityBar: HTMLElement | null = null;

  constructor(scene: GameSceneInterface) {
    this.scene = scene;
    this.container = document.getElementById('hud')!;
    this.buildHUD();
  }

  private buildHUD(): void {
    this.container.innerHTML = `
      <div class="hud-section hud-left">
        <div>
          <span class="hud-label">Scrap</span>
          <div class="hud-value scrap" id="hud-scrap">0</div>
        </div>
        <div>
          <span class="hud-label">Cores</span>
          <div class="hud-value cores" id="hud-cores">0</div>
        </div>
        <div>
          <span class="hud-label">DPS</span>
          <div class="hud-value dps" id="hud-dps">0</div>
        </div>
        <div>
          <span class="hud-label">Scrap/min</span>
          <div class="hud-value sps" id="hud-sps">0</div>
        </div>
      </div>
      
      <div class="hud-section hud-center">
        <div class="wave-display" id="hud-wave">Wave 1</div>
        <div class="sector-display" id="hud-sector">Sector 0: Boot Sequence</div>
        <div class="hp-bar-container">
          <div class="hp-bar" id="hud-hp-bar"></div>
        </div>
        <div class="hud-label" style="margin-top: 4px;">
          <span id="hud-hp-text">100 / 100 HP</span>
        </div>
      </div>
      
      <div class="hud-section hud-right">
        <div class="hud-autopilot hidden" id="hud-autopilot">
          <span class="hud-autopilot-label">Autopilot</span>
          <button class="hud-autopilot-toggle" id="hud-autopilot-toggle" type="button">Off</button>
          <span class="hud-autopilot-key">T</span>
        </div>
        <div style="position: relative; margin-top: 8px; text-align: right;">
            <span style="color: var(--text-muted); font-size: 12px; cursor: help;" title="Move: WASD/Arrows | Shoot: Click/Space | Autopilot: T | Pause: ESC">Controls [?]</span>
        </div>
      </div>
    `;

    // Build ability bar
    this.buildAbilityBar();
    this.bindAutopilotToggle();
  }

  private buildAbilityBar(): void {
    this.abilityBar = document.createElement('div');
    this.abilityBar.className = 'ability-bar';
    this.abilityBar.innerHTML = `
      <div class="ability-btn" id="ability-fire" title="Manual fire">
        <div class="ability-info">
          <span class="ability-title">Fire</span>
          <span class="ability-desc" id="ability-fire-desc">Manual shot</span>
          <div class="ability-keys" id="ability-fire-keys">
            <span class="keycap">Click</span>
            <span class="keycap">Space</span>
          </div>
        </div>
        <span class="ability-icon" aria-hidden="true">🔫</span>
      </div>
      <div class="ability-btn locked" id="ability-overload" title="Overload: Rapid fire burst">
        <div class="ability-info">
          <span class="ability-title">Overload</span>
          <span class="ability-desc">Rapid burst</span>
          <div class="ability-keys">
            <span class="keycap">Click</span>
            <span class="keycap">Space</span>
          </div>
        </div>
        <span class="ability-icon" aria-hidden="true">⚡</span>
        <div class="ability-cooldown" id="ability-overload-cd"></div>
      </div>
      <div class="ability-btn locked" id="ability-overdrive" title="Overdrive: Boost all systems">
        <div class="ability-info">
          <span class="ability-title">Overdrive</span>
          <span class="ability-desc">System boost</span>
          <div class="ability-keys">
            <span class="keycap">Q</span>
          </div>
        </div>
        <span class="ability-icon" aria-hidden="true">🚀</span>
        <div class="ability-cooldown" id="ability-overdrive-cd"></div>
      </div>
    `;
    document.getElementById('ui-overlay')?.appendChild(this.abilityBar);
  }

  public update(): void {
    const save = SaveManager.getCurrent();
    const waveInfo = this.scene.waveManager.getCurrentWaveInfo();

    // Update values
    document.getElementById('hud-scrap')!.textContent = Math.floor(save.scrap).toLocaleString();
    document.getElementById('hud-cores')!.textContent = save.cores.toString();
    document.getElementById('hud-dps')!.textContent = Math.floor(this.scene.getDPS()).toLocaleString();
    const scrapPerMinute = this.scene.getSPS() * 60;
    document.getElementById('hud-sps')!.textContent = scrapPerMinute.toFixed(0);

    // Wave info
    const waveText = this.scene.waveManager.isBossActive()
      ? 'BOSS'
      : `Wave ${waveInfo.wave}/${WAVES_PER_SECTOR}`;
    document.getElementById('hud-wave')!.textContent = waveText;
    document.getElementById('hud-sector')!.textContent = `Sector ${waveInfo.sector}: ${waveInfo.sectorName}`;

    // HP bar
    const hpBar = document.getElementById('hud-hp-bar')!;
    const hpPercent = (this.scene.player.currentHP / this.scene.player.maxHP) * 100;
    hpBar.style.width = `${hpPercent}%`;
    hpBar.className = 'hp-bar';
    if (hpPercent < 30) hpBar.classList.add('critical');
    else if (hpPercent < 60) hpBar.classList.add('low');

    document.getElementById('hud-hp-text')!.textContent =
      `${Math.ceil(this.scene.player.currentHP)} / ${this.scene.player.maxHP} HP`;

    // Update ability states
    this.updateAbilityStates();
    this.updateAutopilotToggle();
  }

  private bindAutopilotToggle(): void {
    const toggle = document.getElementById('hud-autopilot-toggle');
    toggle?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.scene.toggleAutopilot?.();
      this.updateAutopilotToggle();
    });
  }

  private updateAutopilotToggle(): void {
    const container = document.getElementById('hud-autopilot');
    const toggle = document.getElementById('hud-autopilot-toggle') as HTMLButtonElement | null;
    if (!container || !toggle) return;

    if (!SaveManager.hasUpgrade('autopilot')) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    const enabled = this.scene.player.isAutopilotEnabled?.() ?? false;
    toggle.textContent = enabled ? 'On' : 'Off';
    toggle.classList.toggle('on', enabled);
  }

  private updateAbilityStates(): void {
    const save = SaveManager.getCurrent();

    // Fire button changes based on auto-fire
    const fireBtn = document.getElementById('ability-fire')!;
    const fireDesc = document.getElementById('ability-fire-desc');
    const fireKeys = document.getElementById('ability-fire-keys');
    if (SaveManager.hasUpgrade('autoFire')) {
      fireBtn.querySelector('.ability-icon')!.textContent = '✓';
      fireBtn.title = 'Auto-fire enabled';
      if (fireDesc) fireDesc.textContent = 'Auto fire';
      if (fireKeys) {
        fireKeys.innerHTML = '<span class="keycap passive">Auto</span>';
      }
    } else {
      if (fireDesc) fireDesc.textContent = 'Manual shot';
      if (fireKeys) {
        fireKeys.innerHTML = '<span class="keycap">Click</span><span class="keycap">Space</span>';
      }
    }

    // Overload (after auto-fire)
    const overloadBtn = document.getElementById('ability-overload')!;
    if (SaveManager.hasUpgrade('autoFire')) {
      overloadBtn.classList.remove('locked');
    }

    // Overdrive (after sector 5)
    const overdriveBtn = document.getElementById('ability-overdrive')!;
    if (save.highestSector >= 5) {
      overdriveBtn.classList.remove('locked');
    }
  }

  public updateAbilityCooldowns(overloadRemaining: number, overdriveRemaining: number): void {
    // Overload cooldown bar
    const overloadCd = document.getElementById('ability-overload-cd')!;
    const overloadBtn = document.getElementById('ability-overload')!;
    if (overloadRemaining > 0) {
      const progress = 1 - (overloadRemaining / OVERLOAD_COOLDOWN);
      overloadCd.style.transform = `scaleX(${progress})`;
      overloadBtn.classList.add('on-cooldown');
    } else {
      overloadCd.style.transform = 'scaleX(1)';
      overloadBtn.classList.remove('on-cooldown');
    }

    // Overdrive cooldown bar
    const overdriveCd = document.getElementById('ability-overdrive-cd')!;
    const overdriveBtn = document.getElementById('ability-overdrive')!;
    if (overdriveRemaining > 0) {
      const progress = 1 - (overdriveRemaining / OVERDRIVE_COOLDOWN);
      overdriveCd.style.transform = `scaleX(${progress})`;
      overdriveBtn.classList.add('on-cooldown');
    } else {
      overdriveCd.style.transform = 'scaleX(1)';
      overdriveBtn.classList.remove('on-cooldown');
    }
  }

  public destroy(): void {
    this.container.innerHTML = '';
    this.abilityBar?.remove();
  }
}
