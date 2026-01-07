/**
 * GameScene - Main gameplay loop
 */
import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    PLAYER_Y,
    PLAYER_MANUAL_FIRE_COOLDOWN,
    AUTOSAVE_INTERVAL,
    MAX_PLAYER_BULLETS,
    MAX_ENEMIES,
    WAVES_PER_SECTOR,
    OVERLOAD_COOLDOWN,
    OVERLOAD_DURATION,
    OVERLOAD_FIRE_RATE_MULT,
    OVERDRIVE_COOLDOWN,
    OVERDRIVE_DURATION,
    BEHAVIOR_SCRIPTS,
    BehaviorScript,
} from '../config/GameConfig';
import { SaveManager } from '../systems/SaveManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Drone } from '../entities/Drone';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { SoundManager } from '../systems/SoundManager';
import { ShopUI } from '../ui/ShopUI';
import { HUD } from '../ui/HUD';

interface GameSceneData {
    offlineScrap?: number;
}

export class GameScene extends Phaser.Scene {
    // Entities
    public player!: Player;
    public playerBullets!: Phaser.GameObjects.Group;
    public enemyBullets!: Phaser.GameObjects.Group;
    public enemies!: Phaser.GameObjects.Group;
    private drones: Drone[] = [];

    // Managers
    public waveManager!: WaveManager;
    public upgradeManager!: UpgradeManager;
    public soundManager!: SoundManager;

    // UI
    public shopUI!: ShopUI;
    private hud!: HUD;

    // State
    private isPaused: boolean = false;
    private lastManualFireTime: number = 0;
    private lastAutoFireTime: number = 0;
    private autosaveTimer!: Phaser.Time.TimerEvent;
    private playTimeTimer!: Phaser.Time.TimerEvent;
    private autoContinueTimeoutId?: number;
    private autoContinueIntervalId?: number;

    // Abilities
    private overloadActive: boolean = false;
    private overloadCooldownEnd: number = 0;
    private overdriveCooldownEnd: number = 0;
    private overdriveActive: boolean = false;

    // Stats tracking
    private sessionDPS: number = 0;
    private sessionSPS: number = 0;
    private damageDealtThisSecond: number = 0;
    private scrapEarnedThisSecond: number = 0;

    // Settings
    private reducedMotion: boolean = false;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: GameSceneData): void {
        if (data.offlineScrap && data.offlineScrap > 0) {
            // Show offline progress notification
            this.time.delayedCall(500, () => {
                this.showToast(`Welcome back! Earned ${Math.floor(data.offlineScrap!).toLocaleString()} scrap while away.`, 'success');
            });
        }
    }

    create(): void {
        this.resetSessionState();

        // Load save
        SaveManager.load();

        // Get settings
        const settings = SaveManager.getSettings();
        this.reducedMotion = settings.reducedMotion;

        // Create background
        this.createBackground();

        // Create groups
        // Create groups
        this.playerBullets = this.add.group({
            classType: Bullet,
            runChildUpdate: true,
            maxSize: MAX_PLAYER_BULLETS
        });
        this.enemyBullets = this.add.group({
            classType: Bullet,
            runChildUpdate: true,
            maxSize: MAX_PLAYER_BULLETS * 4 // More capacity for enemies
        });
        this.enemies = this.add.group({
            classType: Enemy,
            runChildUpdate: true,
            maxSize: MAX_ENEMIES + 5 // Buffer for spawn overlap
        });

        // Create player
        this.player = new Player(this, GAME_WIDTH / 2, PLAYER_Y);

        // Create managers
        this.waveManager = new WaveManager(this);
        this.upgradeManager = new UpgradeManager(this);
        this.soundManager = new SoundManager();

        // Resume audio on interaction
        this.input.on('pointerdown', () => {
            this.soundManager.resume();
        });

        // Create drones if unlocked
        this.spawnDrones();

        // Create UI
        this.hud = new HUD(this);
        this.shopUI = new ShopUI(this);

        // Set up collisions
        this.setupCollisions();

        // Set up input
        this.setupInput();

        // Set up autosave
        this.autosaveTimer = this.time.addEvent({
            delay: AUTOSAVE_INTERVAL,
            callback: this.autoSave,
            callbackScope: this,
            loop: true,
        });

        // Track play time
        this.playTimeTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                SaveManager.addPlayTime(1);
                this.updateDPSTracking();
            },
            callbackScope: this,
            loop: true,
        });

        // Start first wave
        this.waveManager.startNextWave();
    }

    private createBackground(): void {
        const graphics = this.add.graphics();

        // Dark space gradient (drawn as rects)
        graphics.fillGradientStyle(0x0a0a12, 0x0a0a12, 0x101025, 0x101025);
        graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Grid lines (subtle)
        graphics.lineStyle(1, 0x1a1a2e, 0.3);
        for (let x = 0; x < GAME_WIDTH; x += 40) {
            graphics.lineBetween(x, 0, x, GAME_HEIGHT);
        }
        for (let y = 0; y < GAME_HEIGHT; y += 40) {
            graphics.lineBetween(0, y, GAME_WIDTH, y);
        }

        // Stars
        for (let i = 0; i < 80; i++) {
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const y = Phaser.Math.Between(0, GAME_HEIGHT - 100);
            const size = Phaser.Math.FloatBetween(0.5, 1.5);
            const alpha = Phaser.Math.FloatBetween(0.2, 0.8);

            graphics.fillStyle(0xffffff, alpha);
            graphics.fillCircle(x, y, size);
        }
    }

    public spawnDrones(): void {
        // Clear existing drones
        this.drones.forEach(d => d.destroy());
        this.drones = [];

        // Check which drone slots are unlocked
        const hasDrone1 = SaveManager.hasUpgrade('droneSlot1');
        const hasDrone2 = SaveManager.hasUpgrade('droneSlot2');

        if (hasDrone1) {
            const drone1 = new Drone(this, this, 0);
            this.drones.push(drone1);
        }

        if (hasDrone2) {
            const drone2 = new Drone(this, this, 1);
            this.drones.push(drone2);
        }
    }

    private setupCollisions(): void {
        // Player bullets hit enemies
        this.physics.add.overlap(
            this.playerBullets,
            this.enemies,
            this.handleBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );

        // Enemy bullets hit player
        this.physics.add.overlap(
            this.enemyBullets,
            this.player as unknown as Phaser.GameObjects.GameObject,
            this.handleEnemyBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );

        // Enemies reach player
        this.physics.add.overlap(
            this.enemies,
            this.player as unknown as Phaser.GameObjects.GameObject,
            this.handleEnemyHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
    }

    private setupInput(): void {
        // Click to fire / use ability
        this.input.on('pointerdown', () => {
            // Manual fire or Overload
            if (SaveManager.hasUpgrade('autoFire')) {
                // Auto-fire enabled: click triggers Overload
                this.tryOverload();
            } else {
                // No auto-fire: click to shoot
                this.tryManualFire();
            }
        });

        // Hold to rapid-fire (before auto-fire)
        this.input.on('pointermove', () => {
            if (!SaveManager.hasUpgrade('autoFire') && this.input.activePointer.isDown) {
                this.tryManualFire();
            }
        });

        // Keyboard shortcuts
        this.input.keyboard?.on('keydown-SPACE', () => {
            if (!SaveManager.hasUpgrade('autoFire')) {
                this.tryManualFire();
            } else {
                this.tryOverload();
            }
        });

        this.input.keyboard?.on('keydown-ESC', () => {
            this.showPauseMenu();
        });

        // Toggle autopilot (if unlocked)
        this.input.keyboard?.on('keydown-T', () => {
            if (!SaveManager.hasUpgrade('autopilot')) return;
            const enabled = this.player.toggleAutopilot();
            this.showToast(enabled ? 'AUTOPILOT ENGAGED' : 'AUTOPILOT DISENGAGED', 'warning');
        });

        // Overdrive (Q key, unlocked in S5)
        this.input.keyboard?.on('keydown-Q', () => {
            this.tryOverdrive();
        });
    }

    update(time: number, delta: number): void {
        if (this.isPaused) return;

        // Update player
        this.player.update(time, delta);

        // Auto-fire if enabled
        if (SaveManager.hasUpgrade('autoFire')) {
            this.handleAutoFire(time);
        }

        // Update wave manager
        this.waveManager.update(time, delta);

        // Clean up off-screen bullets
        this.cleanupBullets();

        // Update abilities
        this.updateAbilities();

        // Update HUD
        this.hud.update();
    }

    private handleAutoFire(time: number): void {
        let fireRate = this.upgradeManager.getFireRate();

        // Overload boost
        if (this.overloadActive) {
            fireRate *= OVERLOAD_FIRE_RATE_MULT;
        }

        // Overdrive boost
        if (this.overdriveActive) {
            fireRate *= 1.5;
        }

        // Heat penalty (S5+) - reduces fire rate when overheated
        const save = SaveManager.getCurrent();
        if (save.highestSector >= 5) {
            fireRate *= this.player.getHeatPenalty();
        }

        const interval = 1000 / fireRate;

        if (time - this.lastAutoFireTime >= interval) {
            this.firePlayerBullet();
            this.lastAutoFireTime = time;

            // Add heat when firing (S5+)
            if (save.highestSector >= 5) {
                this.player.addHeat(3); // 3 heat per shot
            }
        }
    }

    private tryManualFire(): void {
        const now = performance.now();
        if (now - this.lastManualFireTime >= PLAYER_MANUAL_FIRE_COOLDOWN) {
            this.firePlayerBullet();
            this.lastManualFireTime = now;
        }
    }

    public firePlayerBullet(): void {
        const save = SaveManager.getCurrent();
        const weaponMod = save.activeWeaponMod || 'standard';
        const hasWeaponMods = SaveManager.hasUpgrade('weaponModSlot');

        let baseDamage = this.upgradeManager.getDamage();
        const speed = this.upgradeManager.getBulletSpeed();
        let variant: 'standard' | 'pierce' | 'scatter' = 'standard';
        let flashPower = baseDamage;

        // Sound
        this.soundManager.playShoot();

        // Apply behavior script damage modifier (Assassin +15%, Farmer -15%, Guardian -10%)
        const script = this.getActiveBehaviorScript();
        baseDamage *= script.damageModifier;

        const rollCrit = (damage: number): { damage: number; isCrit: boolean } => {
            const critChance = SaveManager.getUpgradeLevel('critChance') * 0.02;
            if (critChance <= 0) return { damage, isCrit: false };
            const critMult = 1.5 + SaveManager.getUpgradeLevel('critMultiplier') * 0.15;
            if (Math.random() < critChance) {
                const critDamage = damage * critMult;
                flashPower = Math.max(flashPower, critDamage);
                return { damage: critDamage, isCrit: true };
            }
            return { damage, isCrit: false };
        };

        // Apply weapon mod effects
        if (hasWeaponMods && weaponMod === 'pierce') {
            // Pierce: -10% damage, bullets go through enemies (straight up)
            variant = 'pierce';
            baseDamage *= 0.9;
            const shot = rollCrit(baseDamage);
            const bullet = this.playerBullets.get(this.player.x, this.player.y - 20) as Bullet;
            if (bullet) {
                bullet.fire(
                    this.player.x,
                    this.player.y - 20,
                    shot.damage,
                    speed,
                    this.player.x,
                    true,
                    true,
                    3,
                    variant,
                    shot.isCrit
                );
            }
        } else if (hasWeaponMods && weaponMod === 'scatter') {
            // Scatter: 3 bullets in a cone, -40% damage each
            variant = 'scatter';
            baseDamage *= 0.6;
            const spreadOffsets = [-50, 0, 50]; // horizontal spread

            spreadOffsets.forEach(offsetX => {
                const shot = rollCrit(baseDamage);
                const bullet = this.playerBullets.get(this.player.x, this.player.y - 20) as Bullet;
                if (bullet) {
                    bullet.fire(
                        this.player.x,
                        this.player.y - 20,
                        shot.damage,
                        speed,
                        this.player.x + offsetX,
                        true,
                        false,
                        0,
                        variant,
                        shot.isCrit
                    );
                }
            });
        } else {
            // Standard single bullet - straight up
            const shot = rollCrit(baseDamage);
            const bullet = this.playerBullets.get(this.player.x, this.player.y - 20) as Bullet;
            if (bullet) {
                bullet.fire(
                    this.player.x,
                    this.player.y - 20,
                    shot.damage,
                    speed,
                    this.player.x,
                    true,
                    false,
                    0,
                    variant,
                    shot.isCrit
                );
            }
        }

        this.player.playMuzzleFlash(flashPower, variant);
    }

    private tryOverload(): void {
        if (Date.now() < this.overloadCooldownEnd) return;
        if (!SaveManager.hasUpgrade('autoFire')) return;

        this.overloadActive = true;
        this.overloadCooldownEnd = Date.now() + OVERLOAD_COOLDOWN;

        // Visual feedback
        if (!this.reducedMotion) {
            this.cameras.main.flash(100, 68, 136, 255, false);
        }

        // End overload after duration
        this.time.delayedCall(OVERLOAD_DURATION, () => {
            this.overloadActive = false;
        });
    }

    private tryOverdrive(): void {
        if (Date.now() < this.overdriveCooldownEnd) return;
        if (SaveManager.getCurrent().highestSector < 5) return;

        this.overdriveActive = true;
        this.overdriveCooldownEnd = Date.now() + OVERDRIVE_COOLDOWN;

        // Visual feedback
        if (!this.reducedMotion) {
            this.cameras.main.flash(200, 255, 136, 68, false);
        }

        this.showToast('OVERDRIVE ACTIVATED', 'warning');

        // End overdrive after duration
        this.time.delayedCall(OVERDRIVE_DURATION, () => {
            this.overdriveActive = false;
        });
    }

    private updateAbilities(): void {
        // Update HUD cooldown displays
        this.hud.updateAbilityCooldowns(
            this.overloadCooldownEnd - Date.now(),
            this.overdriveCooldownEnd - Date.now()
        );
    }

    private cleanupBullets(): void {
        this.playerBullets.getChildren().forEach((bullet) => {
            const b = bullet as unknown as Bullet;
            if (b.y < -50 || b.y > GAME_HEIGHT + 50) {
                b.destroy();
            }
        });

        this.enemyBullets.getChildren().forEach((bullet) => {
            const b = bullet as unknown as Bullet;
            if (b.y < -50 || b.y > GAME_HEIGHT + 50) {
                b.destroy();
            }
        });
    }

    private handleBulletHitEnemy(
        bulletObj: Phaser.GameObjects.GameObject,
        enemyObj: Phaser.GameObjects.GameObject
    ): void {
        const bullet = bulletObj as unknown as Bullet;
        const enemy = enemyObj as unknown as Enemy;

        if (!bullet.active || !enemy.active) return;

        // Apply damage
        const damage = bullet.damage;
        this.damageDealtThisSecond += damage;

        // Overdrive damage bonus
        const actualDamage = this.overdriveActive ? damage * 1.5 : damage;

        enemy.takeDamage(actualDamage);
        this.showHitSpark(enemy.x, enemy.y, actualDamage);
        this.showDamagePopup(enemy.x, enemy.y, actualDamage, bullet.isCrit);

        // Destroy bullet (unless pierce)
        if (!bullet.pierce || bullet.pierceCount <= 0) {
            bullet.destroy();
        } else {
            bullet.pierceCount--;
        }

        // Check if enemy died
        if (enemy.currentHP <= 0) {
            this.onEnemyKilled(enemy);
        }
    }

    private handleEnemyBulletHitPlayer(
        bulletObj: Phaser.GameObjects.GameObject,
        _playerObj: Phaser.GameObjects.GameObject
    ): void {
        const bullet = bulletObj as unknown as Bullet;
        if (!bullet.active) return;

        bullet.destroy();
        this.player.takeDamage(bullet.damage);
        this.soundManager.playHit();

        // Screen shake
        if (!this.reducedMotion) {
            this.cameras.main.shake(100, 0.01);
        }

        // Check for game over
        if (this.player.currentHP <= 0) {
            this.gameOver();
        }
    }

    public handleEnemyReachedBottom(enemy: Enemy): void {
        if (!enemy.active) return;

        const wasBoss = enemy.isBoss;

        // Heavy damage for letting enemies through
        this.player.takeDamage(20);
        this.soundManager.playHit();

        if (!this.reducedMotion) {
            this.cameras.main.shake(150, 0.02);
        }

        // Steal scrap if collector
        if (enemy.enemyType === 'collector') {
            const current = SaveManager.getCurrent();
            SaveManager.update({ scrap: Math.max(0, current.scrap - enemy.scrapValue * 2) });
            this.showToast('SCRAP STOLEN!', 'error');
        }

        // Just destroy the enemy if it passes bottom
        enemy.destroy();

        if (this.player.currentHP <= 0) {
            this.gameOver();
            return;
        }

        if (wasBoss) {
            this.onEnemyKilled(enemy);
        }
    }

    private handleEnemyHitPlayer(
        enemyObj: Phaser.GameObjects.GameObject,
        _playerObj: Phaser.GameObjects.GameObject
    ): void {
        const enemy = enemyObj as unknown as Enemy;
        if (!enemy.active) return;

        const wasBoss = enemy.isBoss;

        // Enemy collision damage
        this.player.takeDamage(15);
        this.soundManager.playHit();
        enemy.destroy();

        if (!this.reducedMotion) {
            this.cameras.main.shake(150, 0.02);
        }

        if (this.player.currentHP <= 0) {
            this.gameOver();
            return;
        }

        if (wasBoss) {
            this.onEnemyKilled(enemy);
        }
    }

    public onEnemyKilled(enemy: Enemy): void {
        // Calculate scrap with bonuses
        let scrap = enemy.scrapValue;

        // Salvage yield upgrade
        scrap *= this.upgradeManager.getSalvageMultiplier();

        // Overdrive bonus
        if (this.overdriveActive) {
            scrap *= 1.2;
        }

        // Behavior script salvage modifier (Farmer gives +15%)
        const script = this.getActiveBehaviorScript();
        scrap *= script.salvageModifier;

        // Repair nanites (heal on kill)
        const repairLevel = SaveManager.getUpgradeLevel('repairNanites');
        if (repairLevel > 0) {
            const healAmount = this.player.maxHP * (repairLevel * 0.005);
            if (healAmount > 0) {
                this.player.heal(healAmount);
                this.showHealPopup(healAmount);
                this.showHealPulse();
            }
        }

        SaveManager.addScrap(scrap);
        SaveManager.recordKill();
        this.scrapEarnedThisSecond += scrap;

        // Visual feedback
        this.showScrapPopup(enemy.x, enemy.y, scrap);
        this.spawnScrapMagnetEffect(enemy.x, enemy.y, scrap);

        // Sound
        this.soundManager.playExplosion(enemy.isBoss ? 2.0 : 1.0);

        // Spawn splitter minis before wave completion checks
        this.spawnSplitterMinis(enemy);

        // Notify wave manager
        this.waveManager.onEnemyKilled(enemy);
    }

    private spawnScrapMagnetEffect(x: number, y: number, scrap: number): void {
        if (!SaveManager.hasUpgrade('scrapMagnet')) return;

        const count = Phaser.Math.Clamp(Math.floor(scrap / 8), 3, 8);
        const color = 0xffdd44;

        for (let i = 0; i < count; i++) {
            const orb = this.add.circle(
                x + Phaser.Math.Between(-10, 10),
                y + Phaser.Math.Between(-6, 6),
                Phaser.Math.Between(1, 3),
                color,
                0.9
            );
            const targetX = this.player.x + Phaser.Math.Between(-6, 6);
            const targetY = this.player.y + Phaser.Math.Between(-8, 8);

            this.tweens.add({
                targets: orb,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: 0.4,
                duration: Phaser.Math.Between(350, 550),
                ease: 'Quad.easeIn',
                onComplete: () => orb.destroy(),
            });
        }
    }

    private getActiveBehaviorScript(): BehaviorScript {
        const save = SaveManager.getCurrent();
        const scriptId = save.activeBehaviorScript || 'balanced';
        return BEHAVIOR_SCRIPTS.find(s => s.id === scriptId) || BEHAVIOR_SCRIPTS[0];
    }

    public getEstimatedDps(): number {
        const weaponMod = SaveManager.getCurrent().activeWeaponMod || 'standard';
        const hasWeaponMods = SaveManager.hasUpgrade('weaponModSlot');
        const baseDps = this.upgradeManager.getEstimatedDPS();
        let modMultiplier = 1;

        if (hasWeaponMods && weaponMod === 'pierce') {
            modMultiplier = 0.9;
        } else if (hasWeaponMods && weaponMod === 'scatter') {
            modMultiplier = 0.6 * 3;
        }

        const script = this.getActiveBehaviorScript();
        return baseDps * modMultiplier * script.damageModifier;
    }

    private showScrapPopup(x: number, y: number, amount: number): void {
        const text = this.add.text(x, y, `+${Math.floor(amount)}`, {
            fontSize: '14px',
            color: '#ffdd44',
            fontFamily: 'Segoe UI, Roboto, sans-serif',
            stroke: '#000000',
            strokeThickness: 2,
        });
        text.setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: y - 30,
            alpha: 0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => text.destroy(),
        });
    }

    private showDamagePopup(x: number, y: number, amount: number, isCrit: boolean = false): void {
        const text = this.add.text(x, y, `-${Math.round(amount)}`, {
            fontSize: isCrit ? '13px' : '12px',
            color: isCrit ? '#ffcc66' : '#ff6688',
            fontFamily: 'Segoe UI, Roboto, sans-serif',
            stroke: '#000000',
            strokeThickness: 2,
        });
        text.setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: y - 20,
            alpha: 0,
            duration: isCrit ? 650 : 500,
            ease: 'Power2',
            onComplete: () => text.destroy(),
        });
    }

    private showHealPopup(amount: number): void {
        const text = this.add.text(this.player.x, this.player.y - 30, `+${Math.ceil(amount)} HP`, {
            fontSize: '12px',
            color: '#44ff88',
            fontFamily: 'Segoe UI, Roboto, sans-serif',
            stroke: '#000000',
            strokeThickness: 2,
        });
        text.setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: text.y - 20,
            alpha: 0,
            duration: 700,
            ease: 'Power2',
            onComplete: () => text.destroy(),
        });
    }

    private showHealPulse(): void {
        const pulse = this.add.circle(this.player.x, this.player.y, 18, 0x44ff88, 0.25);
        this.tweens.add({
            targets: pulse,
            scale: 1.8,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => pulse.destroy(),
        });
    }

    private showHitSpark(x: number, y: number, damage: number): void {
        if (damage < 14) return;

        const color = damage > 30 ? 0xff8844 : 0x88ccff;
        const spark = this.add.graphics();
        spark.fillStyle(color, 0.8);
        spark.fillCircle(x, y, 3);
        spark.lineStyle(1, color, 0.6);
        spark.lineBetween(x - 6, y, x + 6, y);
        spark.lineBetween(x, y - 6, x, y + 6);

        this.tweens.add({
            targets: spark,
            alpha: 0,
            scale: 1.4,
            duration: 120,
            ease: 'Quad.easeOut',
            onComplete: () => spark.destroy(),
        });
    }

    private updateDPSTracking(): void {
        this.sessionDPS = this.damageDealtThisSecond;
        this.sessionSPS = this.scrapEarnedThisSecond;

        // Update save with current scrap/sec for offline calculation
        SaveManager.update({ scrapPerSecond: this.sessionSPS });

        // Reset counters
        this.damageDealtThisSecond = 0;
        this.scrapEarnedThisSecond = 0;
    }

    public getDPS(): number {
        return this.sessionDPS;
    }

    public getSPS(): number {
        return this.sessionSPS;
    }

    private autoSave(): void {
        SaveManager.save(SaveManager.getCurrent());
    }

    public purchaseUpgrade(upgradeId: string): void {
        if (this.upgradeManager.canAfford(upgradeId)) {
            this.upgradeManager.purchase(upgradeId);
            this.soundManager.playPurchase();
            this.shopUI.refresh();
            this.autoSave(); // Save on purchase

            // Show unlock feedback for key upgrades
            if (upgradeId === 'autoFire') {
                this.showToast('AUTO-FIRE ENABLED', 'success');
            } else if (upgradeId === 'autopilot') {
                this.showToast('AUTOPILOT ENGAGED', 'success');
                this.player.enableAutopilot();
            } else if (upgradeId === 'hull') {
                this.player.applyHullUpgrade();
                this.showToast('HULL INTEGRITY BOOSTED', 'success');
            } else if (upgradeId === 'droneSlot1' || upgradeId === 'droneSlot2') {
                this.spawnDrones();
            }
        }
    }

    public toggleAutopilot(): void {
        if (!SaveManager.hasUpgrade('autopilot')) return;
        const enabled = this.player.toggleAutopilot();
        this.showToast(enabled ? 'AUTOPILOT ENGAGED' : 'AUTOPILOT DISENGAGED', 'warning');
    }

    public showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
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

    public onBossDefeated(): void {
        SaveManager.recordBossDefeat();
        SaveManager.addCores(1);

        const save = SaveManager.getCurrent();
        save.currentWave = 1;
        save.currentSector++;

        if (save.currentSector > save.highestSector) {
            save.highestSector = save.currentSector;
        }

        SaveManager.update(save);
        this.autoSave();

        // Check for victory
        if (save.currentSector >= 6) {
            this.victory();
            return;
        }

        // Show sector complete message
        this.showToast(`SECTOR ${save.currentSector - 1} COMPLETE - +1 CORE`, 'success');

        // Start next sector after delay
        this.time.delayedCall(2000, () => {
            this.waveManager.startNextWave();
        });
    }

    public onWaveComplete(): void {
        const save = SaveManager.getCurrent();
        save.currentWave++;
        SaveManager.update(save);

        this.time.delayedCall(1500, () => {
            this.waveManager.startNextWave();
        });
    }

    private showPauseMenu(): void {
        this.isPaused = true;
        this.physics.pause();
        this.scene.pause();

        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.className = 'modal-backdrop';
        overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">Paused</h3>
        <div class="menu-buttons">
          <button id="btn-resume" class="menu-btn">Resume</button>
          <button id="btn-quit" class="menu-btn secondary">Quit to Menu</button>
        </div>
      </div>
    `;
        document.getElementById('ui-overlay')?.appendChild(overlay);

        document.getElementById('btn-resume')?.addEventListener('click', () => {
            overlay.remove();
            this.isPaused = false;
            this.scene.resume();
            this.physics.resume();
        });

        document.getElementById('btn-quit')?.addEventListener('click', () => {
            overlay.remove();
            this.autoSave();
            this.shutdown();
            this.scene.start('MenuScene');
        });
    }

    private gameOver(): void {
        this.isPaused = true;
        this.physics.pause();
        this.scene.pause();

        // Save progress (player keeps upgrades but may lose wave progress)
        this.autoSave();

        const autoContinueLevel = this.upgradeManager.getLevel('autoContinue');
        const autoContinueDelay = this.getAutoContinueDelay(autoContinueLevel);
        const autoContinueHtml = autoContinueLevel > 0
            ? `<p id="auto-continue-text" style="color: #88bbee; margin-bottom: 18px;">Auto-continue in ${autoContinueDelay}s</p>`
            : '';

        const overlay = document.createElement('div');
        overlay.id = 'gameover-overlay';
        overlay.className = 'modal-backdrop';
        overlay.innerHTML = `
      <div class="modal" style="text-align: center;">
        <h3 class="modal-title" style="color: #ff4466;">SYSTEM FAILURE</h3>
        <p style="color: #8899bb; margin-bottom: 24px;">Ship systems offline. Rebooting from last checkpoint...</p>
        ${autoContinueHtml}
        <div class="menu-buttons">
          <button id="btn-continue-game" class="menu-btn">Continue</button>
          <button id="btn-quit-menu" class="menu-btn secondary">Return to Menu</button>
        </div>
      </div>
    `;
        document.getElementById('ui-overlay')?.appendChild(overlay);

        let resolved = false;
        const continueGame = () => {
            if (resolved) return;
            resolved = true;
            this.clearAutoContinueTimers();
            overlay.remove();
            // Restore player HP and continue
            this.player.restoreHP();
            this.isPaused = false;
            this.scene.resume();
            this.physics.resume();
            this.waveManager.restartCurrentWave();
        };

        const returnToMenu = () => {
            if (resolved) return;
            resolved = true;
            this.clearAutoContinueTimers();
            overlay.remove();
            this.shutdown();
            this.scene.start('MenuScene');
        };

        document.getElementById('btn-continue-game')?.addEventListener('click', continueGame);
        document.getElementById('btn-quit-menu')?.addEventListener('click', returnToMenu);

        if (autoContinueLevel > 0) {
            let remaining = autoContinueDelay;
            const countdownEl = document.getElementById('auto-continue-text');
            this.clearAutoContinueTimers();
            this.autoContinueIntervalId = window.setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    this.clearAutoContinueTimers();
                    continueGame();
                    return;
                }
                if (countdownEl) {
                    countdownEl.textContent = `Auto-continue in ${remaining}s`;
                }
            }, 1000);

            this.autoContinueTimeoutId = window.setTimeout(() => {
                continueGame();
            }, autoContinueDelay * 1000);
        }
    }

    private victory(): void {
        this.isPaused = true;
        this.autoSave();
        this.shutdown();
        this.scene.start('VictoryScene');
    }

    private spawnSplitterMinis(enemy: Enemy): void {
        if (enemy.enemyType !== 'splitter') return;

        const save = SaveManager.getCurrent();
        const globalWave = save.currentSector * WAVES_PER_SECTOR + save.currentWave;
        const offsets = [-20, 20];

        offsets.forEach((offsetX) => {
            if (this.enemies.countActive(true) >= MAX_ENEMIES) return;
            const mini = this.enemies.get(enemy.x + offsetX, enemy.y) as Enemy;
            if (mini) {
                mini.spawn(
                    enemy.x + offsetX,
                    enemy.y,
                    'splitter_mini',
                    save.currentSector,
                    globalWave,
                    this.enemyBullets
                );
            }
        });
    }

    shutdown(): void {
        this.autosaveTimer?.remove();
        this.playTimeTimer?.remove();
        this.clearAutoContinueTimers();
        this.shopUI?.destroy();
        this.hud?.destroy();
        document.getElementById('pause-overlay')?.remove();
        document.getElementById('gameover-overlay')?.remove();
    }

    private resetSessionState(): void {
        this.isPaused = false;
        this.lastManualFireTime = 0;
        this.lastAutoFireTime = 0;
        this.overloadActive = false;
        this.overloadCooldownEnd = 0;
        this.overdriveCooldownEnd = 0;
        this.overdriveActive = false;
        this.sessionDPS = 0;
        this.sessionSPS = 0;
        this.damageDealtThisSecond = 0;
        this.scrapEarnedThisSecond = 0;
        this.physics.resume();
    }

    private getAutoContinueDelay(level: number): number {
        if (level <= 0) return 0;
        const baseDelay = 8;
        const minDelay = 2;
        return Math.max(minDelay, baseDelay - level);
    }

    private clearAutoContinueTimers(): void {
        if (this.autoContinueTimeoutId !== undefined) {
            window.clearTimeout(this.autoContinueTimeoutId);
            this.autoContinueTimeoutId = undefined;
        }
        if (this.autoContinueIntervalId !== undefined) {
            window.clearInterval(this.autoContinueIntervalId);
            this.autoContinueIntervalId = undefined;
        }
    }
}
