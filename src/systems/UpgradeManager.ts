/**
 * UpgradeManager - Handles upgrade calculations and purchases
 */
import {
    UPGRADES,
    UpgradeDefinition,
    getUpgradeCost,
    PLAYER_BASE_DAMAGE,
    PLAYER_BASE_FIRE_RATE,
    PLAYER_BASE_BULLET_SPEED,
} from '../config/GameConfig';
import { SaveManager } from './SaveManager';

export class UpgradeManager {
    constructor(_scene: Phaser.Scene) {
        // Scene reference kept for potential future use
    }

    /**
     * Get all upgrades, sorted by category
     */
    public getUpgradesByCategory(): Record<string, UpgradeDefinition[]> {
        const result: Record<string, UpgradeDefinition[]> = {};

        UPGRADES.forEach(upgrade => {
            if (!result[upgrade.category]) {
                result[upgrade.category] = [];
            }
            result[upgrade.category].push(upgrade);
        });

        return result;
    }

    /**
     * Get a specific upgrade definition
     */
    public getUpgrade(id: string): UpgradeDefinition | undefined {
        return UPGRADES.find(u => u.id === id);
    }

    /**
     * Get current level of an upgrade
     */
    public getLevel(id: string): number {
        return SaveManager.getUpgradeLevel(id);
    }

    /**
     * Get cost for next level of an upgrade
     */
    public getCost(id: string): { scrap: number; cores: number } {
        const upgrade = this.getUpgrade(id);
        if (!upgrade) return { scrap: 0, cores: 0 };

        const level = this.getLevel(id);
        if (level >= upgrade.maxLevel) return { scrap: 0, cores: 0 };

        const scrapCost = upgrade.baseCost > 0
            ? (upgrade.isUnlock ? upgrade.baseCost : getUpgradeCost(upgrade.baseCost, level + 1))
            : 0;

        return {
            scrap: scrapCost,
            cores: upgrade.coresCost || 0,
        };
    }

    /**
     * Check if player can afford an upgrade
     */
    public canAfford(id: string): boolean {
        const cost = this.getCost(id);
        const save = SaveManager.getCurrent();

        if (cost.scrap > 0 && save.scrap < cost.scrap) return false;
        if (cost.cores > 0 && save.cores < cost.cores) return false;

        return true;
    }

    /**
     * Check if upgrade is available (sector req, prerequisites)
     */
    public isAvailable(id: string): { available: boolean; reason: string } {
        const upgrade = this.getUpgrade(id);
        if (!upgrade) return { available: false, reason: 'Unknown upgrade' };

        const level = this.getLevel(id);
        if (level >= upgrade.maxLevel) {
            return { available: false, reason: 'Max level reached' };
        }

        const save = SaveManager.getCurrent();

        // Check sector requirement
        if (upgrade.sectorRequired !== undefined && save.highestSector < upgrade.sectorRequired) {
            return { available: false, reason: `Requires Sector ${upgrade.sectorRequired}` };
        }

        // Check prerequisite
        if (upgrade.prerequisite && !SaveManager.hasUpgrade(upgrade.prerequisite)) {
            const prereq = this.getUpgrade(upgrade.prerequisite);
            return { available: false, reason: `Requires ${prereq?.name || upgrade.prerequisite}` };
        }

        return { available: true, reason: '' };
    }

    /**
     * Purchase an upgrade
     */
    public purchase(id: string): boolean {
        const upgrade = this.getUpgrade(id);
        if (!upgrade) return false;

        const availability = this.isAvailable(id);
        if (!availability.available) return false;

        if (!this.canAfford(id)) return false;

        const cost = this.getCost(id);

        // Deduct costs
        if (cost.scrap > 0) {
            SaveManager.spendScrap(cost.scrap);
        }
        if (cost.cores > 0) {
            SaveManager.spendCores(cost.cores);
        }

        // Add upgrade level
        SaveManager.addUpgradeLevel(id);

        return true;
    }

    /**
     * Get calculated damage with all bonuses
     */
    public getDamage(): number {
        const damageLevel = this.getLevel('damage');
        const multiplier = Math.pow(1.08, damageLevel);
        return PLAYER_BASE_DAMAGE * multiplier;
    }

    /**
     * Get calculated fire rate (shots per second)
     */
    public getFireRate(): number {
        const fireRateLevel = this.getLevel('fireRate');
        const baseRate = 1000 / PLAYER_BASE_FIRE_RATE; // Convert ms interval to rate
        const multiplier = Math.pow(1.06, fireRateLevel);
        return baseRate * multiplier;
    }

    /**
     * Get calculated bullet speed
     */
    public getBulletSpeed(): number {
        const speedLevel = this.getLevel('projectileSpeed');
        const multiplier = Math.pow(1.05, speedLevel);
        return PLAYER_BASE_BULLET_SPEED * multiplier;
    }

    /**
     * Get salvage multiplier
     */
    public getSalvageMultiplier(): number {
        const salvageLevel = this.getLevel('salvageYield');
        return Math.pow(1.05, salvageLevel);
    }

    /**
     * Get recommended next upgrade (simple heuristic)
     */
    public getRecommended(): string | null {
        // Priority order for early game
        const priorities = [
            'autoFire',
            'autopilot',
            'targetingFirmware',
            'damage',
            'fireRate',
            'salvageYield',
            'hull',
        ];

        for (const id of priorities) {
            const availability = this.isAvailable(id);
            if (availability.available && this.canAfford(id)) {
                return id;
            }
        }

        // Find cheapest available upgrade
        let cheapest: string | null = null;
        let cheapestCost = Infinity;

        UPGRADES.forEach(upgrade => {
            const availability = this.isAvailable(upgrade.id);
            if (availability.available) {
                const cost = this.getCost(upgrade.id);
                if (cost.scrap < cheapestCost && cost.cores === 0) {
                    cheapestCost = cost.scrap;
                    cheapest = upgrade.id;
                }
            }
        });

        return cheapest;
    }

    /**
     * Get DPS estimate
     */
    public getEstimatedDPS(): number {
        const damage = this.getDamage();
        const fireRate = this.getFireRate();

        // Include crit
        const critChance = this.getLevel('critChance') * 0.02;
        const critMult = 1.5 + this.getLevel('critMultiplier') * 0.15;
        const critBonus = critChance * (critMult - 1);

        return damage * fireRate * (1 + critBonus);
    }
}
