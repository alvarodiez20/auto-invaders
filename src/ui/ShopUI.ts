/**
 * ShopUI - DOM-based shop overlay
 */
import { UPGRADES, UpgradeDefinition, BEHAVIOR_SCRIPTS, WEAPON_MODS } from '../config/GameConfig';
import { SaveManager } from '../systems/SaveManager';

type CategoryKey = 'core' | 'weapons' | 'autopilot' | 'targeting' | 'drones' | 'economy' | 'survival' | 'coreUnlock' | 'mods' | 'behavior';

// Forward reference to avoid circular import
interface GameSceneInterface {
    upgradeManager: {
        getRecommended(): string | null;
        getLevel(id: string): number;
        getCost(id: string): { scrap: number; cores: number };
        isAvailable(id: string): { available: boolean; reason: string };
        canAfford(id: string): boolean;
    };
    purchaseUpgrade(id: string): void;
    spawnDrones?(): void;
}

export class ShopUI {
    private scene: GameSceneInterface;
    private container: HTMLElement;
    private isShopOpen: boolean = false;
    private currentTab: CategoryKey = 'core';

    private readonly TAB_LABELS: Record<CategoryKey, string> = {
        core: 'Core',
        weapons: 'Weapons',
        mods: 'Mods',
        autopilot: 'Autopilot',
        targeting: 'Targeting',
        behavior: 'AI Scripts',
        drones: 'Drones',
        economy: 'Economy',
        survival: 'Survival',
        coreUnlock: 'Cores',
    };

    constructor(scene: GameSceneInterface) {
        this.scene = scene;
        this.container = document.getElementById('shop-container')!;
        this.buildShop();
    }

    private buildShop(): void {
        this.container.innerHTML = `
      <div class="shop-header">
        <span class="shop-title">UPGRADES</span>
        <button class="shop-close" id="shop-close">&times;</button>
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
            tab.textContent = label;
            tab.addEventListener('click', () => this.switchTab(key as CategoryKey));
            tabsContainer.appendChild(tab);
        });

        // Close button
        document.getElementById('shop-close')?.addEventListener('click', () => this.close());

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
            item.innerHTML = `
                <div class="upgrade-header">
                    <span class="upgrade-name">${mod.name}</span>
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
            item.innerHTML = `
                <div class="upgrade-header">
                    <span class="upgrade-name">${script.name}</span>
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
            : `Lv ${level}/${upgrade.maxLevel}`;

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

        item.innerHTML = `
      <div class="upgrade-header">
        <span class="upgrade-name">${upgrade.name}</span>
        <span class="upgrade-level ${isMaxed ? 'max' : ''}">${levelText}</span>
      </div>
      <p class="upgrade-description">${upgrade.description}</p>
      <p class="upgrade-effect">${upgrade.effectDescription}</p>
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
        this.refresh();
    }

    public close(): void {
        this.isShopOpen = false;
        this.container.classList.add('hidden');
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
