/**
 * GameConfig.ts - All game constants, enemy stats, upgrade costs, and scaling formulas
 */

// ============================================================================
// GAME DIMENSIONS
// ============================================================================
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const PLAYER_Y = GAME_HEIGHT - 60;

// ============================================================================
// PLAYER DEFAULTS
// ============================================================================
export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_DAMAGE = 10;
export const PLAYER_BASE_FIRE_RATE = 200; // ms between shots (when auto-fire enabled)
export const PLAYER_MANUAL_FIRE_COOLDOWN = 125; // ~8 shots/sec max manual click rate
export const PLAYER_BASE_BULLET_SPEED = 400;
export const PLAYER_BASE_MOVE_SPEED = 150;

// ============================================================================
// ENEMY BASE STATS
// ============================================================================
export interface EnemyStats {
    baseHP: number;
    baseScrap: number;
    speed: number;
    color: number;
    width: number;
    height: number;
    canShoot: boolean;
    shootInterval?: number;
}

export const ENEMY_TYPES: Record<string, EnemyStats> = {
    grunt: {
        baseHP: 25,
        baseScrap: 2.0,
        speed: 30,
        color: 0x44aa44,
        width: 32,
        height: 24,
        canShoot: true,
        shootInterval: 3000,
    },
    swarmer: {
        baseHP: 12,
        baseScrap: 1.2,
        speed: 50,
        color: 0xaaaa44,
        width: 20,
        height: 16,
        canShoot: false,
    },
    tank: {
        baseHP: 90,
        baseScrap: 6.0,
        speed: 15,
        color: 0x666666,
        width: 40,
        height: 32,
        canShoot: true,
        shootInterval: 2500,
    },
    shielded: {
        baseHP: 55,
        baseScrap: 4.0,
        speed: 25,
        color: 0x4488ff,
        width: 34,
        height: 26,
        canShoot: true,
        shootInterval: 3500,
    },
    bomber: {
        baseHP: 45,
        baseScrap: 3.5,
        speed: 20,
        color: 0xff6644,
        width: 36,
        height: 28,
        canShoot: true,
        shootInterval: 2000,
    },
    jammer: {
        baseHP: 40,
        baseScrap: 3.5,
        speed: 25,
        color: 0xaa44aa,
        width: 30,
        height: 24,
        canShoot: false,
    },
    splitter: {
        baseHP: 35,
        baseScrap: 2.5,
        speed: 28,
        color: 0x66ffaa,
        width: 28,
        height: 22,
        canShoot: false,
    },
    splitter_mini: {
        baseHP: 14, // 40% of 35
        baseScrap: 1.0,
        speed: 45,
        color: 0x66ffaa,
        width: 16,
        height: 12,
        canShoot: false,
    },
    diver: {
        baseHP: 28,
        baseScrap: 2.5,
        speed: 80,
        color: 0xff4488,
        width: 24,
        height: 20,
        canShoot: false,
    },
    collector: {
        baseHP: 30,
        baseScrap: 2.0,
        speed: 35,
        color: 0xffaa00,
        width: 26,
        height: 22,
        canShoot: false,
    },
};

// ============================================================================
// SECTOR CONFIGURATION
// ============================================================================
export const SECTOR_COUNT = 6;
export const WAVES_PER_SECTOR = 12;
export const TOTAL_WAVES = SECTOR_COUNT * WAVES_PER_SECTOR;

export const SECTOR_HP_BOOST = [1.00, 1.15, 1.35, 1.60, 1.90, 2.30];

export const SECTOR_NAMES = [
    "Boot Sequence",
    "Scrapfield Lanes",
    "Signal Noise",
    "Armor Doctrine",
    "Rowfall Pattern",
    "Final Descent",
];

// Enemy types unlocked per sector
export const SECTOR_ENEMY_UNLOCKS: Record<number, string[]> = {
    0: ["grunt"],
    1: ["swarmer"],
    2: ["jammer"],
    3: ["tank", "shielded", "splitter"],
    4: ["diver", "bomber", "collector"],
    5: [], // No new types, just harder versions
};

// ============================================================================
// DIFFICULTY SCALING FORMULAS
// ============================================================================

/**
 * Global difficulty multiplier: D(g) = 1.13^(g-1)
 * @param globalWave - Global wave index (1 to 72)
 */
export function getDifficultyMultiplier(globalWave: number): number {
    return Math.pow(1.13, globalWave - 1);
}

/**
 * Calculate enemy HP for a given type and wave
 */
export function getEnemyHP(type: string, sector: number, globalWave: number): number {
    const baseHP = ENEMY_TYPES[type]?.baseHP || 25;
    const D = getDifficultyMultiplier(globalWave);
    const sectorBoost = SECTOR_HP_BOOST[sector] || 1.0;
    return Math.round(baseHP * D * sectorBoost);
}

/**
 * Calculate scrap drop for a given type and wave
 */
export function getScrapDrop(type: string, globalWave: number): number {
    const baseScrap = ENEMY_TYPES[type]?.baseScrap || 2.0;
    const D = getDifficultyMultiplier(globalWave);
    return baseScrap * Math.pow(D, 0.75);
}

/**
 * Calculate spawn count for a wave
 * count = baseCount + floor((g-1)/2), baseCount=10, cap at 45
 */
export function getSpawnCount(globalWave: number): number {
    const baseCount = 10;
    const count = baseCount + Math.floor((globalWave - 1) / 2);
    return Math.min(count, 45);
}

/**
 * Calculate boss HP
 * bossHP = 35 * baseHP[Grunt] * D(g) * sectorHPBoost[s]
 */
export function getBossHP(sector: number, globalWave: number): number {
    const gruntHP = ENEMY_TYPES.grunt.baseHP;
    const D = getDifficultyMultiplier(globalWave);
    const sectorBoost = SECTOR_HP_BOOST[sector] || 1.0;
    return Math.round(35 * gruntHP * D * sectorBoost);
}

/**
 * Calculate boss scrap reward
 * bossScrap = 120 * D(g)^0.65
 */
export function getBossScrap(globalWave: number): number {
    const D = getDifficultyMultiplier(globalWave);
    return 120 * Math.pow(D, 0.65);
}

/**
 * Enemy fire rate multiplier
 * enemyFireMult = 1 + 0.012*(g-1)
 */
export function getEnemyFireMultiplier(globalWave: number): number {
    return 1 + 0.012 * (globalWave - 1);
}

/**
 * Enemy bullet speed multiplier
 * bulletSpeedMult = 1 + 0.006*(g-1)
 */
export function getEnemyBulletSpeedMultiplier(globalWave: number): number {
    return 1 + 0.006 * (globalWave - 1);
}

// ============================================================================
// UPGRADE SYSTEM
// ============================================================================

export interface UpgradeDefinition {
    id: string;
    name: string;
    description: string;
    category: 'core' | 'weapons' | 'autopilot' | 'targeting' | 'drones' | 'economy' | 'survival' | 'coreUnlock';
    baseCost: number;
    maxLevel: number;
    isUnlock: boolean; // One-time purchase vs repeatable
    coresCost?: number; // If requires cores instead of/in addition to scrap
    sectorRequired?: number; // Sector that must be reached to unlock
    prerequisite?: string; // Another upgrade that must be owned
    effectPerLevel?: number; // Percentage increase per level (e.g., 0.08 for 8%)
    effectDescription: string;
}

/**
 * Tier jump multipliers for upgrade costs
 */
function getTierJump(level: number): number {
    if (level <= 5) return 1.0;
    if (level <= 10) return 1.6;
    if (level <= 15) return 2.7;
    if (level <= 20) return 4.3;
    return 6.0;
}

/**
 * Calculate upgrade cost: cost(L) = C0 * 1.18^(L-1) * tierJump(L)
 */
export function getUpgradeCost(baseCost: number, level: number): number {
    return Math.round(baseCost * Math.pow(1.18, level - 1) * getTierJump(level));
}

// KEY EARLY UNLOCKS
export const UPGRADES: UpgradeDefinition[] = [
    // Core Systems (unlocks)
    {
        id: 'autoFire',
        name: 'Auto-Fire Module',
        description: 'Enables automatic shooting. Your ship will continuously fire at enemies.',
        category: 'core',
        baseCost: 120,
        maxLevel: 1,
        isUnlock: true,
        effectPerLevel: 0,
        effectDescription: 'Enables automatic shooting',
    },
    {
        id: 'autopilot',
        name: 'Autopilot Module',
        description: 'Enables automatic horizontal movement. Your ship will dodge and position itself.',
        category: 'core',
        baseCost: 250,
        maxLevel: 1,
        isUnlock: true,
        prerequisite: 'autoFire',
        effectPerLevel: 0,
        effectDescription: 'Enables automatic movement',
    },
    {
        id: 'targetingFirmware',
        name: 'Targeting Firmware',
        description: 'Enables target selection modes and reduces target switching time.',
        category: 'core',
        baseCost: 180,
        maxLevel: 1,
        isUnlock: true,
        prerequisite: 'autoFire',
        effectPerLevel: 0,
        effectDescription: 'Enables targeting AI',
    },

    // Weapons (repeatable)
    {
        id: 'damage',
        name: 'Weapon Amplifier',
        description: 'Increases bullet damage.',
        category: 'weapons',
        baseCost: 25,
        maxLevel: 20,
        isUnlock: false,
        effectPerLevel: 0.08,
        effectDescription: '+8% damage per level',
    },
    {
        id: 'fireRate',
        name: 'Rapid Cycling',
        description: 'Increases fire rate.',
        category: 'weapons',
        baseCost: 30,
        maxLevel: 20,
        isUnlock: false,
        effectPerLevel: 0.06,
        effectDescription: '+6% fire rate per level',
    },
    {
        id: 'projectileSpeed',
        name: 'Accelerator Rails',
        description: 'Increases bullet speed.',
        category: 'weapons',
        baseCost: 20,
        maxLevel: 20,
        isUnlock: false,
        effectPerLevel: 0.05,
        effectDescription: '+5% projectile speed per level',
    },
    {
        id: 'critChance',
        name: 'Precision Optics',
        description: 'Increases critical hit chance.',
        category: 'weapons',
        baseCost: 40,
        maxLevel: 15,
        isUnlock: false,
        effectPerLevel: 0.02,
        effectDescription: '+2% crit chance per level',
    },
    {
        id: 'critMultiplier',
        name: 'Overcharge Cells',
        description: 'Increases critical hit damage.',
        category: 'weapons',
        baseCost: 50,
        maxLevel: 10,
        isUnlock: false,
        effectPerLevel: 0.15,
        effectDescription: '+15% crit damage per level',
    },

    // Autopilot (repeatable, requires autopilot unlock)
    {
        id: 'thrusterSpeed',
        name: 'Thruster Boost',
        description: 'Increases movement speed.',
        category: 'autopilot',
        baseCost: 25,
        maxLevel: 20,
        isUnlock: false,
        prerequisite: 'autopilot',
        effectPerLevel: 0.05,
        effectDescription: '+5% movement speed per level',
    },
    {
        id: 'autopilotV2',
        name: 'Autopilot v2: Threat Analysis',
        description: 'Autopilot now considers enemy positions and incoming fire.',
        category: 'autopilot',
        baseCost: 500,
        maxLevel: 1,
        isUnlock: true,
        prerequisite: 'autopilot',
        sectorRequired: 3,
        effectPerLevel: 0,
        effectDescription: 'Smarter evasion AI',
    },
    {
        id: 'autopilotV3',
        name: 'Autopilot v3: Opportunist',
        description: 'Autopilot positions for optimal target acquisition.',
        category: 'autopilot',
        baseCost: 0,
        maxLevel: 1,
        isUnlock: true,
        coresCost: 2,
        prerequisite: 'autopilotV2',
        sectorRequired: 5,
        effectPerLevel: 0,
        effectDescription: 'Optimal positioning AI',
    },

    // Targeting (repeatable, requires targeting firmware)
    {
        id: 'tracking',
        name: 'Tracking Enhancement',
        description: 'Improves target tracking accuracy.',
        category: 'targeting',
        baseCost: 25,
        maxLevel: 20,
        isUnlock: false,
        prerequisite: 'targetingFirmware',
        effectPerLevel: 0.06,
        effectDescription: '+6% tracking per level',
    },
    {
        id: 'focus',
        name: 'Focus Lens',
        description: 'Reduces target switching delay.',
        category: 'targeting',
        baseCost: 30,
        maxLevel: 15,
        isUnlock: false,
        prerequisite: 'targetingFirmware',
        effectPerLevel: 0.06,
        effectDescription: '+6% focus per level',
    },
    {
        id: 'lockOn',
        name: 'Lock-On System',
        description: 'Enables lock-on to priority targets for bonus damage.',
        category: 'targeting',
        baseCost: 0,
        maxLevel: 1,
        isUnlock: true,
        coresCost: 1,
        prerequisite: 'targetingFirmware',
        sectorRequired: 2,
        effectPerLevel: 0,
        effectDescription: 'Lock-on ability',
    },
    {
        id: 'lockOnSpeed',
        name: 'Lock-On Accelerator',
        description: 'Faster lock-on acquisition.',
        category: 'targeting',
        baseCost: 35,
        maxLevel: 10,
        isUnlock: false,
        prerequisite: 'lockOn',
        effectPerLevel: 0.07,
        effectDescription: '+7% lock-on speed per level',
    },

    // Drones
    {
        id: 'droneSlot1',
        name: 'Drone Bay I',
        description: 'Deploys an autonomous combat drone.',
        category: 'drones',
        baseCost: 400,
        maxLevel: 1,
        isUnlock: true,
        sectorRequired: 1,
        effectPerLevel: 0,
        effectDescription: 'First drone slot',
    },
    {
        id: 'droneSlot2',
        name: 'Drone Bay II',
        description: 'Deploys a second combat drone.',
        category: 'drones',
        baseCost: 0,
        maxLevel: 1,
        isUnlock: true,
        coresCost: 2,
        prerequisite: 'droneSlot1',
        sectorRequired: 4,
        effectPerLevel: 0,
        effectDescription: 'Second drone slot',
    },
    {
        id: 'droneDamage',
        name: 'Drone Weapons',
        description: 'Increases drone damage.',
        category: 'drones',
        baseCost: 35,
        maxLevel: 15,
        isUnlock: false,
        prerequisite: 'droneSlot1',
        effectPerLevel: 0.08,
        effectDescription: '+8% drone damage per level',
    },
    {
        id: 'droneFireRate',
        name: 'Drone Cycling',
        description: 'Increases drone fire rate.',
        category: 'drones',
        baseCost: 40,
        maxLevel: 15,
        isUnlock: false,
        prerequisite: 'droneSlot1',
        effectPerLevel: 0.06,
        effectDescription: '+6% drone fire rate per level',
    },

    // Economy
    {
        id: 'salvageYield',
        name: 'Salvage Enhancement',
        description: 'Increases scrap gained from kills.',
        category: 'economy',
        baseCost: 35,
        maxLevel: 20,
        isUnlock: false,
        effectPerLevel: 0.05,
        effectDescription: '+5% scrap per level',
    },
    {
        id: 'scrapMagnet',
        name: 'Scrap Magnet',
        description: 'Automatically collects scrap from further away.',
        category: 'economy',
        baseCost: 150,
        maxLevel: 1,
        isUnlock: true,
        effectPerLevel: 0,
        effectDescription: 'Auto-collect scrap',
    },

    // Survival
    {
        id: 'hull',
        name: 'Hull Plating',
        description: 'Increases maximum HP.',
        category: 'survival',
        baseCost: 30,
        maxLevel: 20,
        isUnlock: false,
        effectPerLevel: 0.10,
        effectDescription: '+10% HP per level',
    },
    {
        id: 'stability',
        name: 'Stability Matrix',
        description: 'Reduces accuracy penalties from jammers.',
        category: 'survival',
        baseCost: 22,
        maxLevel: 15,
        isUnlock: false,
        sectorRequired: 2,
        effectPerLevel: 0.07,
        effectDescription: '+7% stability per level',
    },
    {
        id: 'heatCapacity',
        name: 'Heat Capacity',
        description: 'Increases heat capacity before overheat.',
        category: 'survival',
        baseCost: 60,
        maxLevel: 10,
        isUnlock: false,
        sectorRequired: 5,
        effectPerLevel: 0.10,
        effectDescription: '+10% heat capacity per level',
    },
    {
        id: 'coolingRate',
        name: 'Cooling Systems',
        description: 'Increases heat dissipation rate.',
        category: 'survival',
        baseCost: 60,
        maxLevel: 10,
        isUnlock: false,
        sectorRequired: 5,
        effectPerLevel: 0.08,
        effectDescription: '+8% cooling per level',
    },

    // Core Unlocks (special purchases with Cores)
    {
        id: 'weaponModSlot',
        name: 'Weapon Mod Slot',
        description: 'Unlocks weapon modifications: Pierce, Beam, Scatter.',
        category: 'coreUnlock',
        baseCost: 0,
        maxLevel: 1,
        isUnlock: true,
        coresCost: 1,
        sectorRequired: 3,
        effectPerLevel: 0,
        effectDescription: 'Weapon mod system',
    },
    {
        id: 'behaviorScripts',
        name: 'Behavior Scripts',
        description: 'Unlocks AI behavior modes: Guardian, Assassin, Farmer, Chaos.',
        category: 'coreUnlock',
        baseCost: 0,
        maxLevel: 1,
        isUnlock: true,
        coresCost: 1,
        sectorRequired: 4,
        effectPerLevel: 0,
        effectDescription: 'AI behavior selection',
    },
];

// ============================================================================
// WEAPON MODS
// ============================================================================
export interface WeaponMod {
    id: string;
    name: string;
    description: string;
    damageMultiplier: number;
}

export const WEAPON_MODS: WeaponMod[] = [
    {
        id: 'standard',
        name: 'Standard',
        description: 'Standard single-shot bullets.',
        damageMultiplier: 1.0,
    },
    {
        id: 'pierce',
        name: 'Pierce',
        description: 'Bullets pierce through enemies. -10% damage.',
        damageMultiplier: 0.9,
    },
    {
        id: 'scatter',
        name: 'Scatter',
        description: 'Fires 3 bullets in a cone. -40% damage per bullet.',
        damageMultiplier: 0.6,
    },
];

// ============================================================================
// BEHAVIOR SCRIPTS
// ============================================================================
export interface BehaviorScript {
    id: string;
    name: string;
    description: string;
    targetingBias: 'closest' | 'valuable' | 'random';
    damageModifier: number;
    salvageModifier: number;
    evasionModifier: number;
}

export const BEHAVIOR_SCRIPTS: BehaviorScript[] = [
    {
        id: 'balanced',
        name: 'Balanced',
        description: 'Standard behavior with no bonuses or penalties.',
        targetingBias: 'closest',
        damageModifier: 1.0,
        salvageModifier: 1.0,
        evasionModifier: 1.0,
    },
    {
        id: 'guardian',
        name: 'Guardian',
        description: 'Prioritizes threats closest to base. +20% evasion, -10% damage.',
        targetingBias: 'closest',
        damageModifier: 0.9,
        salvageModifier: 1.0,
        evasionModifier: 1.2,
    },
    {
        id: 'assassin',
        name: 'Assassin',
        description: 'Faster lock-on, higher single-target DPS. -10% evasion.',
        targetingBias: 'closest',
        damageModifier: 1.15,
        salvageModifier: 1.0,
        evasionModifier: 0.9,
    },
    {
        id: 'farmer',
        name: 'Farmer',
        description: 'Prioritizes valuable targets. +15% salvage, -15% damage.',
        targetingBias: 'valuable',
        damageModifier: 0.85,
        salvageModifier: 1.15,
        evasionModifier: 1.0,
    },
    {
        id: 'chaos',
        name: 'Chaos',
        description: 'Unpredictable multi-targeting. Chance for extra shots.',
        targetingBias: 'random',
        damageModifier: 1.0,
        salvageModifier: 1.0,
        evasionModifier: 1.0,
    },
];

// ============================================================================
// GAME LIMITS (Performance)
// ============================================================================
export const MAX_PLAYER_BULLETS = 100;
export const MAX_ENEMY_BULLETS = 150;
export const MAX_ENEMIES = 60;

// ============================================================================
// SAVE SYSTEM
// ============================================================================
export const SAVE_KEY = 'autoInvaders_save';
export const AUTOSAVE_INTERVAL = 15000; // 15 seconds
export const MAX_OFFLINE_HOURS = 8;

// ============================================================================
// CLICK ABILITIES
// ============================================================================
export const OVERLOAD_COOLDOWN = 5000; // 5 seconds
export const OVERLOAD_DURATION = 1500; // 1.5 seconds of rapid fire
export const OVERLOAD_FIRE_RATE_MULT = 3.0;

export const MARK_TARGET_COOLDOWN = 8000;
export const MARK_TARGET_DURATION = 5000;
export const MARK_TARGET_SCRAP_BONUS = 1.5;

export const OVERDRIVE_COOLDOWN = 30000;
export const OVERDRIVE_DURATION = 10000;
export const OVERDRIVE_DAMAGE_MULT = 1.5;
export const OVERDRIVE_FIRE_RATE_MULT = 1.5;
