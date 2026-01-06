/**
 * SaveManager - Handles localStorage saves, export/import, and offline progress
 */
import { SAVE_KEY, MAX_OFFLINE_HOURS } from '../config/GameConfig';

export interface GameSettings {
    sound: boolean;
    reducedMotion: boolean;
    uiScale: number;
}

export interface GameStats {
    totalKills: number;
    totalScrapEarned: number;
    totalDamageDealt: number;
    playTime: number; // seconds
    bossesDefeated: number;
}

export interface GameSave {
    // Progress
    scrap: number;
    cores: number;
    currentSector: number;
    currentWave: number;
    highestSector: number;

    // Player state
    playerHP: number;
    playerMaxHP: number;

    // Upgrades - stored as { upgradeId: level }
    upgrades: Record<string, number>;

    // Current selections
    activeWeaponMod: string;
    activeBehaviorScript: string;
    activeTargetMode: string;

    // Statistics
    stats: GameStats;

    // Meta
    lastSaveTime: number;
    scrapPerSecond: number; // For offline calculation
    version: number;
}

const DEFAULT_SETTINGS: GameSettings = {
    sound: true,
    reducedMotion: false,
    uiScale: 1.0,
};

const DEFAULT_SAVE: GameSave = {
    scrap: 0,
    cores: 0,
    currentSector: 0,
    currentWave: 1,
    highestSector: 0,
    playerHP: 100,
    playerMaxHP: 100,
    upgrades: {},
    activeWeaponMod: 'standard',
    activeBehaviorScript: 'balanced',
    activeTargetMode: 'closest',
    stats: {
        totalKills: 0,
        totalScrapEarned: 0,
        totalDamageDealt: 0,
        playTime: 0,
        bossesDefeated: 0,
    },
    lastSaveTime: Date.now(),
    scrapPerSecond: 0,
    version: 1,
};

const SETTINGS_KEY = 'autoInvaders_settings';

export class SaveManager {
    private static currentSave: GameSave = { ...DEFAULT_SAVE };

    /**
     * Check if a save exists
     */
    static hasSave(): boolean {
        return localStorage.getItem(SAVE_KEY) !== null;
    }

    /**
     * Load save from localStorage
     */
    static load(): GameSave {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (data) {
                const parsed = JSON.parse(data) as GameSave;
                // Merge with defaults to handle new fields
                this.currentSave = { ...DEFAULT_SAVE, ...parsed };
                return this.currentSave;
            }
        } catch (e) {
            console.error('Failed to load save:', e);
        }
        this.currentSave = { ...DEFAULT_SAVE };
        return this.currentSave;
    }

    /**
     * Save to localStorage
     */
    static save(data: Partial<GameSave>): void {
        try {
            this.currentSave = {
                ...this.currentSave,
                ...data,
                lastSaveTime: Date.now(),
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.currentSave));
        } catch (e) {
            console.error('Failed to save:', e);
        }
    }

    /**
     * Get current save (in-memory)
     */
    static getCurrent(): GameSave {
        return this.currentSave;
    }

    /**
     * Update current save in memory
     */
    static update(data: Partial<GameSave>): void {
        this.currentSave = { ...this.currentSave, ...data };
    }

    /**
     * Reset to new game
     */
    static reset(): void {
        this.currentSave = { ...DEFAULT_SAVE, lastSaveTime: Date.now() };
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.currentSave));
    }

    /**
     * Export save as base64 string
     */
    static exportSave(): string {
        try {
            const json = JSON.stringify(this.currentSave);
            return btoa(json);
        } catch (e) {
            console.error('Failed to export:', e);
            return '';
        }
    }

    /**
     * Import save from base64 string
     */
    static importSave(data: string): boolean {
        try {
            const json = atob(data);
            const parsed = JSON.parse(json) as GameSave;

            // Basic validation
            if (typeof parsed.scrap !== 'number' || typeof parsed.currentWave !== 'number') {
                return false;
            }

            this.currentSave = { ...DEFAULT_SAVE, ...parsed };
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.currentSave));
            return true;
        } catch (e) {
            console.error('Failed to import:', e);
            return false;
        }
    }

    /**
     * Calculate offline progress
     * Returns scrap earned while away (capped at MAX_OFFLINE_HOURS)
     */
    static calculateOfflineProgress(): number {
        const save = this.load();
        const now = Date.now();
        const elapsed = (now - save.lastSaveTime) / 1000; // seconds

        if (elapsed < 60 || save.scrapPerSecond <= 0) {
            return 0; // Less than 1 minute or no passive income
        }

        const cappedSeconds = Math.min(elapsed, MAX_OFFLINE_HOURS * 3600);
        const offlineScrap = save.scrapPerSecond * cappedSeconds;

        // Update save with new scrap
        this.save({ scrap: save.scrap + offlineScrap });

        return offlineScrap;
    }

    /**
     * Get settings
     */
    static getSettings(): GameSettings {
        try {
            const data = localStorage.getItem(SETTINGS_KEY);
            if (data) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
        return { ...DEFAULT_SETTINGS };
    }

    /**
     * Save settings
     */
    static saveSettings(settings: Partial<GameSettings>): void {
        try {
            const current = this.getSettings();
            const updated = { ...current, ...settings };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    /**
     * Get upgrade level
     */
    static getUpgradeLevel(upgradeId: string): number {
        return this.currentSave.upgrades[upgradeId] || 0;
    }

    /**
     * Check if upgrade is owned (level > 0)
     */
    static hasUpgrade(upgradeId: string): boolean {
        return this.getUpgradeLevel(upgradeId) > 0;
    }

    /**
     * Add upgrade level
     */
    static addUpgradeLevel(upgradeId: string): void {
        const current = this.getUpgradeLevel(upgradeId);
        this.currentSave.upgrades[upgradeId] = current + 1;
    }

    /**
     * Add scrap
     */
    static addScrap(amount: number): void {
        this.currentSave.scrap += amount;
        this.currentSave.stats.totalScrapEarned += amount;
    }

    /**
     * Spend scrap
     */
    static spendScrap(amount: number): boolean {
        if (this.currentSave.scrap >= amount) {
            this.currentSave.scrap -= amount;
            return true;
        }
        return false;
    }

    /**
     * Add cores
     */
    static addCores(amount: number): void {
        this.currentSave.cores += amount;
    }

    /**
     * Spend cores
     */
    static spendCores(amount: number): boolean {
        if (this.currentSave.cores >= amount) {
            this.currentSave.cores -= amount;
            return true;
        }
        return false;
    }

    /**
     * Record a kill
     */
    static recordKill(): void {
        this.currentSave.stats.totalKills++;
    }

    /**
     * Record boss defeat
     */
    static recordBossDefeat(): void {
        this.currentSave.stats.bossesDefeated++;
    }

    /**
     * Update play time
     */
    static addPlayTime(seconds: number): void {
        this.currentSave.stats.playTime += seconds;
    }
}
