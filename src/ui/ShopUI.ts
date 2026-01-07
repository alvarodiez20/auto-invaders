/**
 * ShopUI - DOM-based shop overlay
 */
import {
    UPGRADES,
    UpgradeDefinition,
    BEHAVIOR_SCRIPTS,
    WEAPON_MODS,
    ENEMY_TYPES,
    SECTOR_ENEMY_UNLOCKS,
    getEnemyHP,
    getScrapDrop,
    getEnemyFireMultiplier,
    getEnemyBulletSpeedMultiplier,
    WAVES_PER_SECTOR,
    GAME_WIDTH,
    REPEATABLE_MAX_LEVEL,
} from '../config/GameConfig';
import { SaveManager } from '../systems/SaveManager';

type CategoryKey = 'core' | 'weapons' | 'autopilot' | 'drones' | 'economy' | 'survival' | 'mods' | 'behavior';
type ViewMode = 'upgrades' | 'info';

// Forward reference to avoid circular import
interface GameSceneInterface {
    upgradeManager: {
        getRecommended(): string | null;
        getLevel(id: string): number;
        getCost(id: string): { scrap: number; cores: number };
        isAvailable(id: string): { available: boolean; reason: string };
        canAfford(id: string): boolean;
        getDamage(): number;
        getFireRate(): number;
        getBulletSpeed(): number;
    };
    purchaseUpgrade(id: string): void;
    spawnDrones?(): void;
}

export class ShopUI {
    private scene: GameSceneInterface;
    private container: HTMLElement;
    private isShopOpen: boolean = false;
    private currentTab: CategoryKey = 'core';
    private viewMode: ViewMode = 'upgrades';

    private readonly TAB_LABELS: Record<CategoryKey, string> = {
        core: 'Core',
        weapons: 'Weapons',
        economy: 'Economy',
        survival: 'Survival',
        drones: 'Drones',
        autopilot: 'Autopilot',
        mods: 'Mods',
        behavior: 'AI Scripts',
    };

    constructor(scene: GameSceneInterface) {
        this.scene = scene;
        this.container = document.getElementById('shop-container')!;
        this.buildShop();

        // Default to open
        this.open();
    }

    private buildShop(): void {
        this.container.innerHTML = `
      <div class="shop-header">
        <span class="shop-title" id="shop-title">UPGRADES</span>
        <div class="shop-view-toggle" role="tablist" aria-label="Shop view">
          <button class="shop-view-btn active" data-view="upgrades" type="button">Upgrades</button>
          <button class="shop-view-btn" data-view="info" type="button">Info</button>
        </div>
      </div>
      <div class="shop-tabs" id="shop-tabs"></div>
      <div class="shop-content" id="shop-content"></div>
    `;

        // Build tabs
        const tabsContainer = document.getElementById('shop-tabs')!;
        Object.entries(this.TAB_LABELS).forEach(([key, label]) => {
            const tab = document.createElement('button');
            tab.className = `shop-tab ${key === this.currentTab ? 'active' : ''}`;
            tab.dataset.tab = key;
            tab.innerHTML = `
                <span class="shop-tab-icon" aria-hidden="true">${this.getCategoryIcon(key as CategoryKey)}</span>
                <span class="shop-tab-label">${label}</span>
            `;
            tab.addEventListener('click', () => this.switchTab(key as CategoryKey));
            tabsContainer.appendChild(tab);
        });

        // Build view toggle
        this.container.querySelectorAll('.shop-view-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const view = (btn as HTMLButtonElement).dataset.view as ViewMode | undefined;
                if (view) {
                    this.switchView(view);
                }
            });
        });

        // Initial content
        this.renderContent();
    }

    private switchTab(tab: CategoryKey): void {
        this.currentTab = tab;

        // Update tab styles
        document.querySelectorAll('.shop-tab').forEach((el) => {
            el.classList.toggle('active', (el as HTMLElement).dataset.tab === tab);
        });

        this.renderContent();
    }

    private renderContent(): void {
        const content = document.getElementById('shop-content')!;
        content.innerHTML = '';

        if (this.viewMode === 'info') {
            this.renderInfo(content);
            return;
        }

        // Special tabs for selectors
        if (this.currentTab === 'mods') {
            this.renderWeaponMods(content);
            return;
        }
        if (this.currentTab === 'behavior') {
            this.renderBehaviorScripts(content);
            return;
        }

        const recommended = this.scene.upgradeManager.getRecommended();
        const upgrades = UPGRADES.filter(u => u.category === this.currentTab);

        upgrades.forEach(upgrade => {
            const item = this.createUpgradeItem(upgrade, recommended);
            content.appendChild(item);
        });

        if (upgrades.length === 0) {
            content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No upgrades available in this category yet.</p>';
        }
    }

    private renderWeaponMods(content: HTMLElement): void {
        const save = SaveManager.getCurrent();
        const hasModSlot = SaveManager.hasUpgrade('weaponModSlot');

        if (!hasModSlot) {
            content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Unlock "Weapon Mod Slot" (1 Core, Sector 3) to access weapon mods.</p>';
            return;
        }

        WEAPON_MODS.forEach(mod => {
            const isActive = save.activeWeaponMod === mod.id;
            const item = document.createElement('div');
            item.className = `upgrade-item ${isActive ? 'active recommended' : 'affordable'}`;
            const iconHtml = this.getModIconHtml(mod.id);
            item.innerHTML = `
                <div class="upgrade-header">
                    <span class="upgrade-name">${iconHtml}${mod.name}</span>
                    <span class="upgrade-level ${isActive ? 'max' : ''}">${isActive ? 'ACTIVE' : 'SELECT'}</span>
                </div>
                <p class="upgrade-description">${mod.description}</p>
                <p class="upgrade-effect">Damage: ${Math.round(mod.damageMultiplier * 100)}%</p>
            `;
            item.addEventListener('click', () => {
                SaveManager.update({ activeWeaponMod: mod.id });
                this.renderContent();
            });
            content.appendChild(item);
        });
    }

    private renderBehaviorScripts(content: HTMLElement): void {
        const save = SaveManager.getCurrent();
        const hasScripts = SaveManager.hasUpgrade('behaviorScripts');

        if (!hasScripts) {
            content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Unlock "Behavior Scripts" (1 Core, Sector 4) to access AI behaviors.</p>';
            return;
        }

        BEHAVIOR_SCRIPTS.forEach(script => {
            const isActive = save.activeBehaviorScript === script.id;
            const item = document.createElement('div');
            item.className = `upgrade-item ${isActive ? 'active recommended' : 'affordable'}`;
            const iconHtml = this.getBehaviorIconHtml(script.id);
            item.innerHTML = `
                <div class="upgrade-header">
                    <span class="upgrade-name">${iconHtml}${script.name}</span>
                    <span class="upgrade-level ${isActive ? 'max' : ''}">${isActive ? 'ACTIVE' : 'SELECT'}</span>
                </div>
                <p class="upgrade-description">${script.description}</p>
                <p class="upgrade-effect">DMG: ${Math.round(script.damageModifier * 100)}% | Salvage: ${Math.round(script.salvageModifier * 100)}% | Evasion: ${Math.round(script.evasionModifier * 100)}%</p>
            `;
            item.addEventListener('click', () => {
                SaveManager.update({ activeBehaviorScript: script.id });
                this.renderContent();
            });
            content.appendChild(item);
        });
    }

    private createUpgradeItem(upgrade: UpgradeDefinition, recommended: string | null): HTMLElement {
        const level = this.scene.upgradeManager.getLevel(upgrade.id);
        const cost = this.scene.upgradeManager.getCost(upgrade.id);
        const availability = this.scene.upgradeManager.isAvailable(upgrade.id);
        const canAfford = this.scene.upgradeManager.canAfford(upgrade.id);
        const isMaxed = level >= upgrade.maxLevel;
        const isRecommended = upgrade.id === recommended;

        const item = document.createElement('div');
        item.className = 'upgrade-item';

        if (!availability.available) {
            item.classList.add('locked');
        } else if (isMaxed) {
            item.classList.add('maxed');
        } else if (canAfford) {
            item.classList.add('affordable');
        }

        if (isRecommended && availability.available && !isMaxed) {
            item.classList.add('recommended');
        }

        // Build HTML
        const levelText = upgrade.isUnlock
            ? (level > 0 ? 'UNLOCKED' : 'LOCKED')
            : (upgrade.maxLevel >= REPEATABLE_MAX_LEVEL ? `Lv ${level}` : `Lv ${level}/${upgrade.maxLevel}`);

        let costHtml = '';
        if (!isMaxed) {
            if (cost.scrap > 0) {
                costHtml += `<span class="cost-scrap">${Math.floor(cost.scrap).toLocaleString()} Scrap</span>`;
            }
            if (cost.cores > 0) {
                if (cost.scrap > 0) costHtml += ' + ';
                costHtml += `<span class="cost-cores">${cost.cores} Core${cost.cores > 1 ? 's' : ''}</span>`;
            }
        }

        const metaLines = this.getUpgradeMetaLines(upgrade, level);
        const metaHtml = metaLines.map(line => `<p class="upgrade-meta">${line}</p>`).join('');
        const iconHtml = this.getUpgradeIconHtml(upgrade);

        item.innerHTML = `
      <div class="upgrade-header">
        <span class="upgrade-name">${iconHtml}${upgrade.name}</span>
        <span class="upgrade-level ${isMaxed ? 'max' : ''}">${levelText}</span>
      </div>
      <p class="upgrade-description">${upgrade.description}</p>
      <p class="upgrade-effect">${upgrade.effectDescription}</p>
      ${metaHtml}
      ${!isMaxed ? `<div class="upgrade-cost">${costHtml}</div>` : ''}
      ${!availability.available ? `<p class="upgrade-lock-reason">${availability.reason}</p>` : ''}
    `;

        // Click to purchase
        if (availability.available && !isMaxed) {
            item.addEventListener('click', () => {
                this.scene.purchaseUpgrade(upgrade.id);
            });
        }

        return item;
    }

    private renderInfo(content: HTMLElement): void {
        const save = SaveManager.getCurrent();
        const hasWeaponMods = SaveManager.hasUpgrade('weaponModSlot');
        const weaponMod = save.activeWeaponMod || 'standard';
        const scriptId = save.activeBehaviorScript || 'balanced';
        const script = BEHAVIOR_SCRIPTS.find(s => s.id === scriptId) || BEHAVIOR_SCRIPTS[0];

        let modLabel = 'Standard';
        let modMultiplier = 1;
        let bulletsPerShot = 1;

        if (hasWeaponMods && weaponMod === 'pierce') {
            modLabel = 'Pierce';
            modMultiplier = 0.9;
        } else if (hasWeaponMods && weaponMod === 'scatter') {
            modLabel = 'Scatter';
            modMultiplier = 0.6;
            bulletsPerShot = 3;
        }

        const weaponDamage = this.scene.upgradeManager.getDamage() * script.damageModifier * modMultiplier;
        const weaponFireRate = this.scene.upgradeManager.getFireRate();
        const weaponDps = weaponDamage * bulletsPerShot * weaponFireRate;
        const bulletSpeed = this.scene.upgradeManager.getBulletSpeed();

        const droneSlots = (SaveManager.hasUpgrade('droneSlot1') ? 1 : 0) + (SaveManager.hasUpgrade('droneSlot2') ? 1 : 0);
        const droneDamageLevel = SaveManager.getUpgradeLevel('droneDamage');
        const droneFireRateLevel = SaveManager.getUpgradeLevel('droneFireRate');
        const droneDamage = 5 * Math.pow(1.08, droneDamageLevel);
        const droneInterval = 800 / Math.pow(1.06, droneFireRateLevel);
        const droneShotsPerSec = 1000 / droneInterval;
        const droneDpsPer = droneDamage * droneShotsPerSec;
        const droneDpsTotal = droneDpsPer * droneSlots;

        const globalWave = save.currentSector * WAVES_PER_SECTOR + save.currentWave;
        const unlockedTypes = this.getUnlockedEnemyTypes(save.currentSector);

        const enemyCards = unlockedTypes.map((id) => {
            const stats = ENEMY_TYPES[id];
            if (!stats) return '';

            const hp = Math.round(getEnemyHP(id, save.currentSector, globalWave));
            const scrap = getScrapDrop(id, globalWave);
            const fireInterval = stats.canShoot
                ? Math.round((stats.shootInterval || 3000) / getEnemyFireMultiplier(globalWave))
                : null;
            const bulletSpeedValue = stats.canShoot
                ? Math.round(150 * getEnemyBulletSpeedMultiplier(globalWave))
                : null;
            const name = id.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
            const scrapText = scrap >= 1 ? scrap.toFixed(1) : scrap.toFixed(2);
            const preview = this.getEnemyPreviewSvg(id, stats.color);

            const shotDamageValue = stats.canShoot ? '10' : 'None';
            const fireIntervalValue = stats.canShoot ? `${fireInterval}ms` : 'None';
            const bulletSpeedText = stats.canShoot ? `${bulletSpeedValue}px/s` : 'None';

            return `
        <div class="info-card enemy-card">
          <div class="info-card-header">
            <div class="info-card-leading">
              <span class="enemy-preview info-card-icon" aria-hidden="true">${preview}</span>
              <div class="info-card-heading">
                <div class="info-card-title">${name}</div>
                <div class="info-card-subtitle">HP ${hp} | Speed ${stats.speed}</div>
              </div>
            </div>
            <span class="info-card-badge">Scrap ${scrapText}</span>
          </div>
          <div class="info-stat-grid compact">
            <div class="info-stat">
              <span class="info-stat-label">Shot dmg</span>
              <span class="info-stat-value">${shotDamageValue}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Fire rate</span>
              <span class="info-stat-value">${fireIntervalValue}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Bullet speed</span>
              <span class="info-stat-value">${bulletSpeedText}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Collision</span>
              <span class="info-stat-value">15</span>
            </div>
          </div>
        </div>
      `;
        }).join('');

        content.innerHTML = `
      <div class="info-section">
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-leading">
              <span class="info-card-icon" aria-hidden="true">${this.getInfoIconSvg('weapons')}</span>
              <div class="info-card-heading">
                <div class="info-card-title">Weapon Systems</div>
                <div class="info-card-subtitle">Mod: ${hasWeaponMods ? modLabel : 'None'} | Script: ${script.name}</div>
              </div>
            </div>
            <span class="info-card-badge">DPS ${weaponDps.toFixed(1)}</span>
          </div>
          <div class="info-stat-grid">
            <div class="info-stat">
              <span class="info-stat-label">Damage/shot</span>
              <span class="info-stat-value">${weaponDamage.toFixed(1)}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Shots/sec</span>
              <span class="info-stat-value">${weaponFireRate.toFixed(2)}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Bullets/shot</span>
              <span class="info-stat-value">${bulletsPerShot}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Bullet speed</span>
              <span class="info-stat-value">${Math.round(bulletSpeed)}</span>
            </div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-leading">
              <span class="info-card-icon" aria-hidden="true">${this.getInfoIconSvg('drones')}</span>
              <div class="info-card-heading">
                <div class="info-card-title">Drone Systems</div>
                <div class="info-card-subtitle">Active drones: ${droneSlots}</div>
              </div>
            </div>
            <span class="info-card-badge">DPS ${droneDpsTotal.toFixed(1)}</span>
          </div>
          <div class="info-stat-grid">
            <div class="info-stat">
              <span class="info-stat-label">Damage/shot</span>
              <span class="info-stat-value">${droneDamage.toFixed(1)}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Shots/sec</span>
              <span class="info-stat-value">${droneShotsPerSec.toFixed(2)}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">DPS/drone</span>
              <span class="info-stat-value">${droneDpsPer.toFixed(1)}</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Total DPS</span>
              <span class="info-stat-value">${droneDpsTotal.toFixed(1)}</span>
            </div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-leading">
              <span class="info-card-icon" aria-hidden="true">${this.getInfoIconSvg('enemies')}</span>
              <div class="info-card-heading">
                <div class="info-card-title">Enemy Rules</div>
                <div class="info-card-subtitle">Sector ${save.currentSector} | Wave ${save.currentWave} | Global ${globalWave}</div>
              </div>
            </div>
            <span class="info-card-badge">Types ${unlockedTypes.length}</span>
          </div>
          <div class="info-stat-grid">
            <div class="info-stat">
              <span class="info-stat-label">Bullet dmg</span>
              <span class="info-stat-value">10</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Collision</span>
              <span class="info-stat-value">15</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Leak dmg</span>
              <span class="info-stat-value">20</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-label">Boss cycle</span>
              <span class="info-stat-value">${WAVES_PER_SECTOR} waves</span>
            </div>
          </div>
        </div>
      </div>
      <div class="info-section">
        <div class="info-section-title">Unlocked Enemies</div>
        <div class="info-card-grid">
          ${enemyCards}
        </div>
      </div>
    `;
    }

    private getUpgradeIconHtml(upgrade: UpgradeDefinition): string {
        const svg = this.getUpgradeIconSvg(upgrade.id);
        if (!svg) return '';
        return `<span class="upgrade-icon category-${upgrade.category}" aria-hidden="true">${svg}</span>`;
    }

    private getUpgradeIconSvg(id: string): string {
        switch (id) {
            case 'autoFire':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="5" y1="19" x2="19" y2="5"></line>
            <line x1="7" y1="17" x2="9" y2="15"></line>
            <line x1="15" y1="9" x2="17" y2="7"></line>
            <circle cx="19" cy="5" r="2"></circle>
          </svg>
        `;
            case 'autopilot':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M4 12c2.5-3.5 5-5 8-5s5.5 1.5 8 5"></path>
            <path d="M4 12c2.5 3.5 5 5 8 5s5.5-1.5 8-5"></path>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        `;
            case 'autoContinue':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M6 12a6 6 0 1 0 3-5.2"></path>
            <polyline points="6 4 6 9 11 9"></polyline>
          </svg>
        `;
            case 'weaponModSlot':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <rect x="5" y="5" width="14" height="14" rx="2"></rect>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="12" x2="15" y2="12"></line>
            <line x1="9" y1="15" x2="13" y2="15"></line>
          </svg>
        `;
            case 'behaviorScripts':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M8 9a4 4 0 1 1 6.8 2.8"></path>
            <path d="M6 15c1.5-1.5 4-1.5 5.5 0"></path>
            <circle cx="9" cy="9" r="1"></circle>
            <circle cx="13" cy="9" r="1"></circle>
          </svg>
        `;
            case 'damage':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="7"></circle>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        `;
            case 'fireRate':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M6 16c2-3 4-5 6-8"></path>
            <path d="M12 16c1-2 2-3.5 4-6"></path>
            <path d="M16 18c0-2 1-3 2-5"></path>
          </svg>
        `;
            case 'projectileSpeed':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="4" y1="12" x2="18" y2="12"></line>
            <polyline points="13 7 18 12 13 17"></polyline>
          </svg>
        `;
            case 'critChance':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <polygon points="12,4 14,9 19,9 15,12 17,18 12,14 7,18 9,12 5,9 10,9"></polygon>
          </svg>
        `;
            case 'critMultiplier':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <polygon points="10,5 12,9 16,9 13,12 15,17 10,14 6,17 8,12 5,9 9,9"></polygon>
            <line x1="17" y1="6" x2="21" y2="10"></line>
          </svg>
        `;
            case 'thrusterSpeed':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 4l4 6-4 10-4-10 4-6z"></path>
            <path d="M12 14c-1 2-2 3-3 5"></path>
          </svg>
        `;
            case 'autopilotRange':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M4 14c3-4 6-6 8-6s5 2 8 6"></path>
            <circle cx="12" cy="14" r="2"></circle>
          </svg>
        `;
            case 'autopilotV2':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="7"></circle>
            <polygon points="12,7 15,12 12,17 9,12"></polygon>
          </svg>
        `;
            case 'autopilotV3':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M6 12c2-3 4-4 6-4"></path>
            <path d="M18 12c-2 3-4 4-6 4"></path>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        `;
            case 'droneSlot1':
            case 'droneSlot2':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="3"></circle>
            <circle cx="6" cy="8" r="2"></circle>
            <circle cx="18" cy="8" r="2"></circle>
          </svg>
        `;
            case 'droneDamage':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="6" y1="18" x2="12" y2="6"></line>
          </svg>
        `;
            case 'droneFireRate':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M16 8c2 2 3 4 3 6"></path>
          </svg>
        `;
            case 'salvageYield':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="7"></circle>
            <path d="M9 12h6"></path>
            <path d="M12 8v8"></path>
          </svg>
        `;
            case 'scrapMagnet':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M8 6v6a4 4 0 0 0 8 0V6"></path>
            <line x1="8" y1="6" x2="11" y2="6"></line>
            <line x1="13" y1="6" x2="16" y2="6"></line>
          </svg>
        `;
            case 'hull':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 4l7 4v5c0 4-3 6-7 7-4-1-7-3-7-7V8l7-4z"></path>
          </svg>
        `;
            case 'repairNanites':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="7"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        `;
            case 'stability':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M6 16l6-8 6 8"></path>
            <line x1="6" y1="16" x2="18" y2="16"></line>
          </svg>
        `;
            case 'heatCapacity':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <rect x="10" y="4" width="4" height="12" rx="2"></rect>
            <circle cx="12" cy="18" r="4"></circle>
          </svg>
        `;
            case 'coolingRate':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 4v16"></path>
            <path d="M6 8l12 8"></path>
            <path d="M18 8L6 16"></path>
          </svg>
        `;
            default:
                return '';
        }
    }

    private getInfoIconSvg(type: 'weapons' | 'drones' | 'enemies'): string {
        switch (type) {
            case 'weapons':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="6" y1="18" x2="18" y2="6"></line>
            <line x1="14" y1="6" x2="18" y2="10"></line>
          </svg>
        `;
            case 'drones':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="3"></circle>
            <circle cx="6" cy="8" r="2"></circle>
            <circle cx="18" cy="8" r="2"></circle>
            <circle cx="6" cy="16" r="2"></circle>
            <circle cx="18" cy="16" r="2"></circle>
          </svg>
        `;
            case 'enemies':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            <circle cx="10" cy="11" r="1"></circle>
            <circle cx="14" cy="11" r="1"></circle>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
        `;
            default:
                return '';
        }
    }

    private getModIconHtml(id: string): string {
        const svg = this.getModIconSvg(id);
        if (!svg) return '';
        return `<span class="upgrade-icon category-mods" aria-hidden="true">${svg}</span>`;
    }

    private getModIconSvg(id: string): string {
        switch (id) {
            case 'standard':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="12" y1="5" x2="12" y2="19"></line>
          </svg>
        `;
            case 'pierce':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="12" y1="4" x2="12" y2="20"></line>
            <line x1="8" y1="8" x2="16" y2="8"></line>
          </svg>
        `;
            case 'scatter':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="12" y1="6" x2="7" y2="18"></line>
            <line x1="12" y1="6" x2="12" y2="18"></line>
            <line x1="12" y1="6" x2="17" y2="18"></line>
          </svg>
        `;
            default:
                return '';
        }
    }

    private getBehaviorIconHtml(id: string): string {
        const svg = this.getBehaviorIconSvg(id);
        if (!svg) return '';
        return `<span class="upgrade-icon category-behavior" aria-hidden="true">${svg}</span>`;
    }

    private getBehaviorIconSvg(id: string): string {
        switch (id) {
            case 'balanced':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M6 10h12"></path>
            <path d="M9 14h6"></path>
          </svg>
        `;
            case 'guardian':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 4l7 4v5c0 4-3 6-7 7-4-1-7-3-7-7V8l7-4z"></path>
          </svg>
        `;
            case 'assassin':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="6" y1="18" x2="18" y2="6"></line>
            <line x1="14" y1="6" x2="18" y2="10"></line>
          </svg>
        `;
            case 'farmer':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="7"></circle>
            <path d="M9 12h6"></path>
            <path d="M12 8v8"></path>
          </svg>
        `;
            case 'chaos':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M6 6l12 12"></path>
            <path d="M18 6l-12 12"></path>
          </svg>
        `;
            default:
                return '';
        }
    }

    private getCategoryIcon(category: CategoryKey): string {
        switch (category) {
            case 'core':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="7"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        `;
            case 'weapons':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <line x1="5" y1="19" x2="19" y2="5"></line>
            <line x1="15" y1="5" x2="19" y2="9"></line>
          </svg>
        `;
            case 'economy':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="7"></circle>
            <path d="M9 12h6"></path>
            <path d="M12 8v8"></path>
          </svg>
        `;
            case 'survival':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M12 4l7 4v5c0 4-3 6-7 7-4-1-7-3-7-7V8l7-4z"></path>
          </svg>
        `;
            case 'drones':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <circle cx="12" cy="12" r="3"></circle>
            <circle cx="6" cy="8" r="2"></circle>
            <circle cx="18" cy="8" r="2"></circle>
            <circle cx="6" cy="16" r="2"></circle>
            <circle cx="18" cy="16" r="2"></circle>
          </svg>
        `;
            case 'autopilot':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M4 12c2.5-3.5 5-5 8-5s5.5 1.5 8 5"></path>
            <path d="M4 12c2.5 3.5 5 5 8 5s5.5-1.5 8-5"></path>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        `;
            case 'mods':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <rect x="5" y="5" width="14" height="14" rx="2"></rect>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="12" x2="15" y2="12"></line>
            <line x1="9" y1="15" x2="13" y2="15"></line>
          </svg>
        `;
            case 'behavior':
                return `
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M8 9a4 4 0 1 1 6.8 2.8"></path>
            <path d="M6 15c1.5-1.5 4-1.5 5.5 0"></path>
            <circle cx="9" cy="9" r="1"></circle>
            <circle cx="13" cy="9" r="1"></circle>
          </svg>
        `;
            default:
                return '';
        }
    }

    private getUpgradeMetaLines(upgrade: UpgradeDefinition, level: number): string[] {
        const lines: string[] = [];

        if (upgrade.coresCost && upgrade.coresCost > 0) {
            lines.push('Cores are earned from boss fights.');
        }

        if (upgrade.id === 'weaponModSlot') {
            lines.push('Unlocks the Mods tab.');
        }

        if (upgrade.id === 'behaviorScripts') {
            lines.push('Unlocks the AI Scripts tab.');
        }

        if (upgrade.id === 'autopilotRange') {
            const range = this.getAutopilotRange(level);
            lines.push(`Current sweep: ±${Math.round(range)}px.`);
        }

        if (upgrade.id === 'thrusterSpeed') {
            const bonus = Math.round(level * 5);
            lines.push(`Current bonus: +${bonus}% move speed.`);
        }

        if (upgrade.id === 'autoContinue') {
            const delay = this.getAutoContinueDelay(level);
            if (delay > 0) {
                lines.push(`Auto-continue delay: ${delay}s.`);
            }
        }

        if (upgrade.id === 'repairNanites') {
            const save = SaveManager.getCurrent();
            const heal = save.playerMaxHP * (0.005 * level);
            lines.push(`Heal per kill: ${heal.toFixed(1)} HP.`);
        }

        if (upgrade.id === 'droneDamage' || upgrade.id === 'droneFireRate') {
            const droneStats = this.getDroneDpsStats();
            if (droneStats.slots > 0) {
                lines.push(`Per-drone DPS: ${droneStats.perDrone.toFixed(1)}.`);
            }
        }

        if (upgrade.id === 'droneSlot1' || upgrade.id === 'droneSlot2') {
            const droneStats = this.getDroneDpsStats();
            lines.push(`Active drones: ${droneStats.slots}.`);
        }

        return lines;
    }

    private getAutopilotRange(level: number): number {
        const maxRange = GAME_WIDTH / 2 - 30;
        const baseRange = 90;
        return Math.min(maxRange, baseRange + level * 24);
    }

    private getAutoContinueDelay(level: number): number {
        if (level <= 0) return 0;
        const baseDelay = 8;
        const minDelay = 2;
        return Math.max(minDelay, baseDelay - level);
    }

    private getDroneDpsStats(): { perDrone: number; total: number; slots: number } {
        const slots = (SaveManager.hasUpgrade('droneSlot1') ? 1 : 0) + (SaveManager.hasUpgrade('droneSlot2') ? 1 : 0);
        const damageLevel = SaveManager.getUpgradeLevel('droneDamage');
        const fireRateLevel = SaveManager.getUpgradeLevel('droneFireRate');
        const damage = 5 * Math.pow(1.08, damageLevel);
        const interval = 800 / Math.pow(1.06, fireRateLevel);
        const shotsPerSec = 1000 / interval;
        const perDrone = damage * shotsPerSec;
        return { perDrone, total: perDrone * slots, slots };
    }

    private switchView(view: ViewMode): void {
        if (this.viewMode === view) return;
        this.viewMode = view;
        this.container.classList.toggle('view-info', view === 'info');

        const title = this.container.querySelector('#shop-title');
        if (title) {
            title.textContent = view === 'info' ? 'INFO' : 'UPGRADES';
        }

        this.container.querySelectorAll('.shop-view-btn').forEach((btn) => {
            const isActive = (btn as HTMLButtonElement).dataset.view === view;
            btn.classList.toggle('active', isActive);
        });

        this.renderContent();
    }

    private getUnlockedEnemyTypes(sector: number): string[] {
        const types: string[] = [];
        const seen = new Set<string>();

        for (let s = 0; s <= sector; s++) {
            const unlocks = SECTOR_ENEMY_UNLOCKS[s] || [];
            unlocks.forEach((type) => {
                if (!seen.has(type) && ENEMY_TYPES[type]) {
                    seen.add(type);
                    types.push(type);
                }
            });
        }

        if (types.length === 0) {
            types.push('grunt');
        }

        return types;
    }

    private getEnemyPreviewSvg(type: string, color: number): string {
        const base = this.colorToHex(color);
        const accent = this.colorToHex(this.adjustColor(color, 50));

        switch (type) {
            case 'grunt':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <rect x="10" y="8" width="28" height="20" rx="2" fill="${base}"></rect>
            <rect x="16" y="12" width="5" height="6" fill="#000000" opacity="0.5"></rect>
            <rect x="27" y="12" width="5" height="6" fill="#000000" opacity="0.5"></rect>
          </svg>
        `;
            case 'swarmer':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <polygon points="24,6 8,18 24,30 40,18" fill="${base}"></polygon>
            <circle cx="24" cy="18" r="3" fill="${accent}"></circle>
          </svg>
        `;
            case 'tank':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <rect x="8" y="7" width="32" height="22" rx="2" fill="${base}"></rect>
            <rect x="8" y="7" width="6" height="22" fill="${accent}"></rect>
            <rect x="34" y="7" width="6" height="22" fill="${accent}"></rect>
          </svg>
        `;
            case 'shielded':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <rect x="12" y="10" width="24" height="16" rx="2" fill="${base}"></rect>
            <rect x="8" y="6" width="32" height="24" rx="6" fill="none" stroke="${accent}" stroke-width="2"></rect>
          </svg>
        `;
            case 'bomber':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <circle cx="24" cy="18" r="12" fill="${base}"></circle>
            <circle cx="24" cy="18" r="6" fill="${accent}"></circle>
          </svg>
        `;
            case 'jammer':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <rect x="10" y="10" width="28" height="16" rx="2" fill="${base}"></rect>
            <rect x="22" y="4" width="4" height="10" fill="${accent}"></rect>
            <line x1="10" y1="10" x2="6" y2="6" stroke="${accent}" stroke-width="2"></line>
            <line x1="38" y1="10" x2="42" y2="6" stroke="${accent}" stroke-width="2"></line>
          </svg>
        `;
            case 'splitter':
            case 'splitter_mini':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <polygon points="8,28 24,6 40,28" fill="${base}"></polygon>
            <line x1="14" y1="18" x2="34" y2="18" stroke="${accent}" stroke-width="2"></line>
          </svg>
        `;
            case 'diver':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <polygon points="24,6 8,24 40,24" fill="${base}"></polygon>
            <rect x="16" y="24" width="16" height="6" fill="${accent}"></rect>
          </svg>
        `;
            case 'collector':
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <rect x="10" y="8" width="28" height="16" rx="2" fill="${base}"></rect>
            <rect x="10" y="22" width="6" height="8" fill="${accent}"></rect>
            <rect x="32" y="22" width="6" height="8" fill="${accent}"></rect>
          </svg>
        `;
            default:
                return `
          <svg viewBox="0 0 48 36" width="36" height="28">
            <rect x="12" y="8" width="24" height="20" rx="2" fill="${base}"></rect>
          </svg>
        `;
        }
    }

    private colorToHex(color: number): string {
        return `#${color.toString(16).padStart(6, '0')}`;
    }

    private adjustColor(color: number, delta: number): number {
        const r = Math.min(255, ((color >> 16) & 0xff) + delta);
        const g = Math.min(255, ((color >> 8) & 0xff) + delta);
        const b = Math.min(255, (color & 0xff) + delta);
        return (r << 16) | (g << 8) | b;
    }

    public toggle(): void {
        if (this.isShopOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    public open(): void {
        this.isShopOpen = true;
        this.container.classList.remove('hidden');

        // Adjust game layout
        document.getElementById('game-container')?.classList.remove('full-width');
        document.getElementById('ui-overlay')?.classList.remove('full-width');

        // Trigger resize after transition
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);

        this.refresh();
    }

    public close(): void {
        this.isShopOpen = false;
        this.container.classList.add('hidden');

        // Adjust game layout
        document.getElementById('game-container')?.classList.add('full-width');
        document.getElementById('ui-overlay')?.classList.add('full-width');

        // Trigger resize after transition
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    }

    public isOpen(): boolean {
        return this.isShopOpen;
    }

    public refresh(): void {
        if (this.isShopOpen) {
            this.renderContent();
        }
    }

    public destroy(): void {
        this.container.innerHTML = '';
        this.container.classList.add('hidden');
    }
}
