/**
 * HUD - In-game heads-up display
 */
import { SaveManager } from '../systems/SaveManager';
import { OVERLOAD_COOLDOWN, MARK_TARGET_COOLDOWN, OVERDRIVE_COOLDOWN } from '../config/GameConfig';

// Forward reference to avoid circular import
interface GameSceneInterface {
  waveManager: {
    getCurrentWaveInfo(): { sector: number; wave: number; sectorName: string };
    isBossActive(): boolean;
  };
  player: {
    currentHP: number;
    maxHP: number;
  };
  getDPS(): number;
  getSPS(): number;
  toggleShop?(): void;
}

export class HUD {
  private scene: GameSceneInterface;
  private container: HTMLElement;
  private abilityBar: HTMLElement | null = null;
  private shopToggleFn?: () => void;

  constructor(scene: GameSceneInterface, shopToggleFn?: () => void) {
    this.scene = scene;
    this.shopToggleFn = shopToggleFn;
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
          <span class="hud-label">Scrap/s</span>
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
        <button id="hud-shop-btn" style="
          background: var(--gradient-primary);
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        ">[E] Shop</button>
      </div>
    `;

    // Build ability bar
    this.buildAbilityBar();

    // Shop button
    document.getElementById('hud-shop-btn')?.addEventListener('click', () => {
      if (this.shopToggleFn) {
        this.shopToggleFn();
      }
    });
  }

  private buildAbilityBar(): void {
    this.abilityBar = document.createElement('div');
    this.abilityBar.className = 'ability-bar';
    this.abilityBar.innerHTML = `
      <div class="ability-btn" id="ability-fire" title="Click to shoot (or hold)">
        <span class="ability-icon">🔫</span>
        <span class="ability-key">CLICK</span>
      </div>
      <div class="ability-btn locked" id="ability-overload" title="Overload: Rapid fire burst">
        <span class="ability-icon">⚡</span>
        <span class="ability-key">SPACE</span>
        <div class="ability-cooldown" id="ability-overload-cd"></div>
      </div>
      <div class="ability-btn locked" id="ability-mark" title="Mark Target: Click enemy for bonus scrap">
        <span class="ability-icon">🎯</span>
        <span class="ability-key">CLICK</span>
        <div class="ability-cooldown" id="ability-mark-cd"></div>
      </div>
      <div class="ability-btn locked" id="ability-overdrive" title="Overdrive: Boost all systems">
        <span class="ability-icon">🚀</span>
        <span class="ability-key">Q</span>
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
    document.getElementById('hud-sps')!.textContent = this.scene.getSPS().toFixed(1);

    // Wave info
    const waveText = this.scene.waveManager.isBossActive()
      ? 'BOSS'
      : `Wave ${waveInfo.wave}/12`;
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
  }

  private updateAbilityStates(): void {
    const save = SaveManager.getCurrent();

    // Fire button changes based on auto-fire
    const fireBtn = document.getElementById('ability-fire')!;
    if (SaveManager.hasUpgrade('autoFire')) {
      fireBtn.querySelector('.ability-icon')!.textContent = '✓';
      fireBtn.title = 'Auto-fire enabled';
    }

    // Overload (after auto-fire)
    const overloadBtn = document.getElementById('ability-overload')!;
    if (SaveManager.hasUpgrade('autoFire')) {
      overloadBtn.classList.remove('locked');
    }

    // Mark (after sector 2)
    const markBtn = document.getElementById('ability-mark')!;
    if (save.highestSector >= 2) {
      markBtn.classList.remove('locked');
    }

    // Overdrive (after sector 5)
    const overdriveBtn = document.getElementById('ability-overdrive')!;
    if (save.highestSector >= 5) {
      overdriveBtn.classList.remove('locked');
    }
  }

  public updateAbilityCooldowns(overloadRemaining: number, markRemaining: number, overdriveRemaining: number): void {
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

    // Mark cooldown bar
    const markCd = document.getElementById('ability-mark-cd')!;
    const markBtn = document.getElementById('ability-mark')!;
    if (markRemaining > 0) {
      const progress = 1 - (markRemaining / MARK_TARGET_COOLDOWN);
      markCd.style.transform = `scaleX(${progress})`;
      markBtn.classList.add('on-cooldown');
    } else {
      markCd.style.transform = 'scaleX(1)';
      markBtn.classList.remove('on-cooldown');
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
