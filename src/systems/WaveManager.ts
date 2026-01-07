/**
 * WaveManager - Handles wave spawning, progression, and boss fights
 */
import Phaser from 'phaser';
import {
    WAVES_PER_SECTOR,
    SECTOR_ENEMY_UNLOCKS,
    getSpawnCount,
    getBossHP,
    getBossScrap,
    GAME_WIDTH,
    MAX_ENEMIES,
} from '../config/GameConfig';
import { Enemy } from '../entities/Enemy';
import { SaveManager } from './SaveManager';

// Forward reference to avoid circular import
interface GameSceneInterface {
    enemies: Phaser.GameObjects.Group;
    enemyBullets: Phaser.GameObjects.Group;
    playerBullets: Phaser.GameObjects.Group;
    onBossDefeated(): void;
    onWaveComplete(): void;
    getEstimatedDps(): number;
    time: Phaser.Time.Clock;
    add: Phaser.GameObjects.GameObjectFactory;
    physics: Phaser.Physics.Arcade.ArcadePhysics;
}

export class WaveManager {
    private scene: GameSceneInterface;
    private waveInProgress: boolean = false;
    private spawningComplete: boolean = false;
    private spawnTimer: number = 0;
    private spawnedCount: number = 0;
    private totalToSpawn: number = 0;
    private killedThisWave: number = 0;
    private isBossWave: boolean = false;

    // Available enemy types for current sector
    private availableTypes: string[] = ['grunt'];

    constructor(scene: GameSceneInterface) {
        this.scene = scene;
    }

    public startNextWave(): void {
        const save = SaveManager.getCurrent();
        const sector = save.currentSector;
        const wave = save.currentWave;

        // Check if this is a boss wave
        this.isBossWave = wave > WAVES_PER_SECTOR;

        // Update available enemy types
        this.updateAvailableTypes(sector);

        // Reset wave state
        this.waveInProgress = true;
        this.spawningComplete = false;
        this.spawnTimer = 0;
        this.spawnedCount = 0;
        this.killedThisWave = 0;

        if (this.isBossWave) {
            // Spawn boss
            this.totalToSpawn = 1;
            this.spawnBoss(sector);
        } else {
            // Calculate spawn count
            const globalWave = sector * WAVES_PER_SECTOR + wave;
            this.totalToSpawn = getSpawnCount(globalWave);
        }
    }

    private updateAvailableTypes(sector: number): void {
        this.availableTypes = ['grunt'];

        for (let s = 0; s <= sector; s++) {
            const unlocks = SECTOR_ENEMY_UNLOCKS[s] || [];
            this.availableTypes.push(...unlocks);
        }
    }

    public update(_time: number, delta: number): void {
        if (!this.waveInProgress) return;

        // Check if all enemies are gone (killed or escaped) - fixes stuck wave bug
        if (this.spawningComplete && !this.isBossWave && this.scene.enemies.countActive(true) === 0) {
            this.waveInProgress = false;
            const save = SaveManager.getCurrent();
            if (save.currentWave >= WAVES_PER_SECTOR) {
                // Boss wave next
                save.currentWave = WAVES_PER_SECTOR + 1;
                SaveManager.update(save);
                this.scene.time.delayedCall(2000, () => {
                    this.startNextWave();
                });
            } else {
                this.scene.onWaveComplete();
            }
            return;
        }

        // Don't spawn more if we hit the cap
        if (this.scene.enemies.countActive(true) >= MAX_ENEMIES) return;

        // Spawn enemies over time
        if (!this.spawningComplete && !this.isBossWave) {
            this.spawnTimer -= delta;

            if (this.spawnTimer <= 0 && this.spawnedCount < this.totalToSpawn) {
                this.spawnEnemy();
                this.spawnTimer = this.getSpawnInterval();
            }

            if (this.spawnedCount >= this.totalToSpawn) {
                this.spawningComplete = true;
            }
        }
    }

    private getSpawnInterval(): number {
        // Faster spawning in later waves
        const save = SaveManager.getCurrent();
        const globalWave = save.currentSector * WAVES_PER_SECTOR + save.currentWave;
        const baseInterval = 800;
        const minInterval = 200;

        return Math.max(minInterval, baseInterval - globalWave * 8);
    }

    private spawnEnemy(): void {
        const save = SaveManager.getCurrent();
        const sector = save.currentSector;
        const wave = save.currentWave;
        const globalWave = sector * WAVES_PER_SECTOR + wave;

        // Pick random enemy type from available
        const type = this.pickEnemyType();

        // Spawn position
        const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
        const y = Phaser.Math.Between(-80, -30);

        const enemy = this.scene.enemies.get(x, y) as Enemy;
        if (enemy) {
            enemy.spawn(
                x,
                y,
                type,
                sector,
                globalWave,
                this.scene.enemyBullets
            );
            this.spawnedCount++;
        }
    }

    private pickEnemyType(): string {
        // Weight distribution - grunts more common early
        const weights: Record<string, number> = {};

        this.availableTypes.forEach(type => {
            switch (type) {
                case 'grunt':
                    weights[type] = 40;
                    break;
                case 'swarmer':
                    weights[type] = 25;
                    break;
                case 'tank':
                    weights[type] = 10;
                    break;
                case 'shielded':
                    weights[type] = 12;
                    break;
                case 'bomber':
                    weights[type] = 10;
                    break;
                case 'jammer':
                    weights[type] = 8;
                    break;
                case 'splitter':
                    weights[type] = 10;
                    break;
                case 'diver':
                    weights[type] = 12;
                    break;
                case 'collector':
                    weights[type] = 8;
                    break;
                default:
                    weights[type] = 10;
            }
        });

        // Weighted random selection
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (const [type, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) {
                return type;
            }
        }

        return 'grunt';
    }

    private spawnBoss(sector: number): void {
        const globalWave = (sector + 1) * WAVES_PER_SECTOR; // Boss is after wave 12

        const bossHP = this.getScaledBossHP(sector, globalWave);
        const bossScrap = getBossScrap(globalWave);

        // Crreate boss as a special enemy
        // We can reuse the pool for the boss too, just ensure we reset scale in spawn() which we did
        const boss = this.scene.enemies.get(GAME_WIDTH / 2, -50) as Enemy;

        if (boss) {
            // Using 'grunt' as base type for boss visual if not overridden, 
            // but we might want a specific boss type later. For now logic assumes grunt visuals scaled up.
            boss.spawn(
                GAME_WIDTH / 2,
                -50,
                'grunt',
                sector,
                globalWave,
                this.scene.enemyBullets
            );

            // Override stats for boss
            boss.maxHP = bossHP;
            boss.currentHP = bossHP;
            boss.scrapValue = bossScrap;
            boss.isBoss = true;

            // Scale up boss visually
            boss.setScale(2.5);

            this.spawnedCount = 1;
            this.spawningComplete = true;
        }
    }

    private getScaledBossHP(sector: number, globalWave: number): number {
        const baseBossHP = getBossHP(sector, globalWave);
        const estimatedDps = Math.max(20, this.scene.getEstimatedDps());

        // Target time-to-kill window to keep bosses tough but fair.
        const minTtk = 18 + sector * 2; // seconds
        const maxTtk = 40 + sector * 3; // seconds
        const minHp = estimatedDps * minTtk;
        const maxHp = estimatedDps * maxTtk;

        // Clamp boss HP into the DPS-driven window.
        const scaledHp = Phaser.Math.Clamp(baseBossHP, minHp, maxHp);
        return Math.round(scaledHp);
    }

    public onEnemyKilled(enemy: Enemy): void {
        this.killedThisWave++;

        // Check if wave/boss complete
        if (enemy.isBoss) {
            // Boss defeated
            this.waveInProgress = false;
            this.scene.onBossDefeated();
        } else if (this.spawningComplete && this.scene.enemies.countActive(true) === 0) {
            // All enemies killed
            this.waveInProgress = false;

            const save = SaveManager.getCurrent();
            if (save.currentWave >= WAVES_PER_SECTOR) {
                // Boss wave next
                save.currentWave = WAVES_PER_SECTOR + 1;
                SaveManager.update(save);
                this.scene.time.delayedCall(2000, () => {
                    this.startNextWave();
                });
            } else {
                this.scene.onWaveComplete();
            }
        }
    }

    public restartCurrentWave(): void {
        // Clear all enemies and bullets
        this.scene.enemies.clear(true, true);
        this.scene.enemyBullets.clear(true, true);
        this.scene.playerBullets.clear(true, true);

        // Restart wave
        this.startNextWave();
    }

    public getCurrentWaveInfo(): { sector: number; wave: number; sectorName: string } {
        const save = SaveManager.getCurrent();
        const sectorNames = [
            "Boot Sequence",
            "Scrapfield Lanes",
            "Signal Noise",
            "Armor Doctrine",
            "Rowfall Pattern",
            "Final Descent",
        ];
        return {
            sector: save.currentSector,
            wave: Math.min(save.currentWave, WAVES_PER_SECTOR),
            sectorName: sectorNames[save.currentSector] || 'Unknown',
        };
    }

    public isBossActive(): boolean {
        return this.isBossWave && this.waveInProgress;
    }
}
