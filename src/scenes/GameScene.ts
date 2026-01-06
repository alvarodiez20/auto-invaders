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
    OVERLOAD_COOLDOWN,
    OVERLOAD_DURATION,
    OVERLOAD_FIRE_RATE_MULT,
    MARK_TARGET_COOLDOWN,
    MARK_TARGET_DURATION,
    OVERDRIVE_COOLDOWN,
    OVERDRIVE_DURATION,
} from '../config/GameConfig';
import { SaveManager } from '../systems/SaveManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Drone } from '../entities/Drone';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
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

    // UI
    public shopUI!: ShopUI;
    private hud!: HUD;

    // State
    private isPaused: boolean = false;
    private lastManualFireTime: number = 0;
    private lastAutoFireTime: number = 0;
    private autosaveTimer!: Phaser.Time.TimerEvent;
    private playTimeTimer!: Phaser.Time.TimerEvent;

    // Abilities
    private overloadActive: boolean = false;
    private overloadCooldownEnd: number = 0;
    private markTargetCooldownEnd: number = 0;
    private overdriveCooldownEnd: number = 0;
    private overdriveActive: boolean = false;
    private markedEnemy: Enemy | null = null;

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
        // Load save
        SaveManager.load();

        // Get settings
        const settings = SaveManager.getSettings();
        this.reducedMotion = settings.reducedMotion;

        // Create background
        this.createBackground();

        // Create groups
        this.playerBullets = this.add.group({ runChildUpdate: true });
        this.enemyBullets = this.add.group({ runChildUpdate: true });
        this.enemies = this.add.group({ runChildUpdate: true });

        // Create player
        this.player = new Player(this, GAME_WIDTH / 2, PLAYER_Y);

        // Create managers
        this.waveManager = new WaveManager(this);
        this.upgradeManager = new UpgradeManager(this);

        // Create drones if unlocked
        this.spawnDrones();

        // Create UI
        this.hud = new HUD(this, () => this.shopUI.toggle());
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

    private spawnDrones(): void {
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
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // Check if clicking on UI
            if (this.shopUI.isOpen()) return;

            // Check if clicking on an enemy (for Mark Target)
            if (this.canMarkTarget()) {
                const enemy = this.getEnemyAtPoint(pointer.x, pointer.y);
                if (enemy) {
                    this.markTarget(enemy);
                    return;
                }
            }

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
                if (!this.shopUI.isOpen()) {
                    this.tryManualFire();
                }
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

        this.input.keyboard?.on('keydown-E', () => {
            this.shopUI.toggle();
        });

        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.shopUI.isOpen()) {
                this.shopUI.close();
            } else {
                this.showPauseMenu();
            }
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

        const interval = 1000 / fireRate;

        if (time - this.lastAutoFireTime >= interval) {
            this.firePlayerBullet();
            this.lastAutoFireTime = time;
        }
    }

    private tryManualFire(): void {
        const now = performance.now();
        if (now - this.lastManualFireTime >= PLAYER_MANUAL_FIRE_COOLDOWN) {
            this.firePlayerBullet();
            this.lastManualFireTime = now;
        }
    }

    private firePlayerBullet(): void {
        if (this.playerBullets.getLength() >= MAX_PLAYER_BULLETS) return;

        const save = SaveManager.getCurrent();
        const weaponMod = save.activeWeaponMod || 'standard';
        const hasWeaponMods = SaveManager.hasUpgrade('weaponModSlot');

        let baseDamage = this.upgradeManager.getDamage();
        const speed = this.upgradeManager.getBulletSpeed();

        // Apply weapon mod effects
        if (hasWeaponMods && weaponMod === 'pierce') {
            // Pierce: -10% damage, bullets go through enemies (straight up)
            baseDamage *= 0.9;
            const bullet = new Bullet(
                this,
                this.player.x,
                this.player.y - 20,
                baseDamage,
                speed,
                this.player.x,  // Same as origin = straight up
                true,
                true,  // pierce enabled
                3      // pierce count
            );
            this.playerBullets.add(bullet);
        } else if (hasWeaponMods && weaponMod === 'scatter') {
            // Scatter: 3 bullets in a cone, -40% damage each
            baseDamage *= 0.6;
            const spreadOffsets = [-50, 0, 50]; // horizontal spread

            spreadOffsets.forEach(offsetX => {
                const bullet = new Bullet(
                    this,
                    this.player.x,
                    this.player.y - 20,
                    baseDamage,
                    speed,
                    this.player.x + offsetX,  // Spread left, center, right
                    true
                );
                this.playerBullets.add(bullet);
            });
        } else {
            // Standard single bullet - straight up
            const bullet = new Bullet(
                this,
                this.player.x,
                this.player.y - 20,
                baseDamage,
                speed,
                this.player.x,  // Same as origin = straight up
                true
            );
            this.playerBullets.add(bullet);
        }
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

    private canMarkTarget(): boolean {
        if (Date.now() < this.markTargetCooldownEnd) return false;
        return SaveManager.getCurrent().highestSector >= 2;
    }

    private getEnemyAtPoint(x: number, y: number): Enemy | null {
        let closest: Enemy | null = null;
        let closestDist = 50; // Max click distance

        this.enemies.getChildren().forEach((e) => {
            const enemy = e as unknown as Enemy;
            const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        });

        return closest;
    }

    private markTarget(enemy: Enemy): void {
        this.markedEnemy = enemy;
        this.markTargetCooldownEnd = Date.now() + MARK_TARGET_COOLDOWN;
        enemy.setMarked(true);

        // Remove mark after duration or on death
        this.time.delayedCall(MARK_TARGET_DURATION, () => {
            if (this.markedEnemy === enemy) {
                enemy.setMarked(false);
                this.markedEnemy = null;
            }
        });
    }

    public getTargetEnemy(): Enemy | null {
        const mode = SaveManager.getCurrent().activeTargetMode;
        let target: Enemy | null = null;
        let bestScore = -Infinity;

        // Prioritize marked enemy
        if (this.markedEnemy && this.markedEnemy.active) {
            return this.markedEnemy;
        }

        this.enemies.getChildren().forEach((e) => {
            const enemy = e as unknown as Enemy;
            if (!enemy.active) return;

            let score = 0;
            switch (mode) {
                case 'closest':
                    // Closest to bottom (highest Y)
                    score = enemy.y;
                    break;
                case 'valuable':
                    // Highest scrap value
                    score = enemy.scrapValue;
                    break;
                case 'weakest':
                    // Lowest current HP
                    score = -enemy.currentHP;
                    break;
                default:
                    score = enemy.y;
            }

            if (score > bestScore) {
                bestScore = score;
                target = enemy;
            }
        });

        return target;
    }

    private updateAbilities(): void {
        // Update HUD cooldown displays
        this.hud.updateAbilityCooldowns(
            this.overloadCooldownEnd - Date.now(),
            this.markTargetCooldownEnd - Date.now(),
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

        // Screen shake
        if (!this.reducedMotion) {
            this.cameras.main.shake(100, 0.01);
        }

        // Check for game over
        if (this.player.currentHP <= 0) {
            this.gameOver();
        }
    }

    private handleEnemyHitPlayer(
        enemyObj: Phaser.GameObjects.GameObject,
        _playerObj: Phaser.GameObjects.GameObject
    ): void {
        const enemy = enemyObj as unknown as Enemy;
        if (!enemy.active) return;

        // Enemy collision damage
        this.player.takeDamage(15);
        enemy.destroy();

        if (!this.reducedMotion) {
            this.cameras.main.shake(150, 0.02);
        }

        if (this.player.currentHP <= 0) {
            this.gameOver();
        }
    }

    public onEnemyKilled(enemy: Enemy): void {
        // Calculate scrap with bonuses
        let scrap = enemy.scrapValue;

        // Salvage yield upgrade
        scrap *= this.upgradeManager.getSalvageMultiplier();

        // Marked target bonus
        if (enemy === this.markedEnemy) {
            scrap *= 1.5;
            this.markedEnemy = null;
        }

        // Overdrive bonus
        if (this.overdriveActive) {
            scrap *= 1.2;
        }

        SaveManager.addScrap(scrap);
        SaveManager.recordKill();
        this.scrapEarnedThisSecond += scrap;

        // Visual feedback
        this.showScrapPopup(enemy.x, enemy.y, scrap);

        // Notify wave manager
        this.waveManager.onEnemyKilled(enemy);
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
            this.shopUI.refresh();
            this.autoSave(); // Save on purchase

            // Show unlock feedback for key upgrades
            if (upgradeId === 'autoFire') {
                this.showToast('AUTO-FIRE ENABLED', 'success');
            } else if (upgradeId === 'autopilot') {
                this.showToast('AUTOPILOT ENGAGED', 'success');
                this.player.enableAutopilot();
            } else if (upgradeId === 'targetingFirmware') {
                this.showToast('TARGETING ONLINE', 'success');
            }
        }
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

        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.className = 'modal-backdrop';
        overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">Paused</h3>
        <div class="menu-buttons">
          <button id="btn-resume" class="menu-btn">Resume</button>
          <button id="btn-export-game" class="menu-btn secondary">Export Save</button>
          <button id="btn-quit" class="menu-btn secondary">Quit to Menu</button>
        </div>
      </div>
    `;
        document.getElementById('ui-overlay')?.appendChild(overlay);

        document.getElementById('btn-resume')?.addEventListener('click', () => {
            overlay.remove();
            this.isPaused = false;
            this.physics.resume();
        });

        document.getElementById('btn-export-game')?.addEventListener('click', () => {
            const data = SaveManager.exportSave();
            navigator.clipboard.writeText(data);
            this.showToast('Save copied to clipboard!', 'success');
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

        // Save progress (player keeps upgrades but may lose wave progress)
        this.autoSave();

        const overlay = document.createElement('div');
        overlay.id = 'gameover-overlay';
        overlay.className = 'modal-backdrop';
        overlay.innerHTML = `
      <div class="modal" style="text-align: center;">
        <h3 class="modal-title" style="color: #ff4466;">SYSTEM FAILURE</h3>
        <p style="color: #8899bb; margin-bottom: 24px;">Ship systems offline. Rebooting from last checkpoint...</p>
        <div class="menu-buttons">
          <button id="btn-continue-game" class="menu-btn">Continue</button>
          <button id="btn-quit-menu" class="menu-btn secondary">Return to Menu</button>
        </div>
      </div>
    `;
        document.getElementById('ui-overlay')?.appendChild(overlay);

        document.getElementById('btn-continue-game')?.addEventListener('click', () => {
            overlay.remove();
            // Restore player HP and continue
            this.player.restoreHP();
            this.isPaused = false;
            this.physics.resume();
            this.waveManager.restartCurrentWave();
        });

        document.getElementById('btn-quit-menu')?.addEventListener('click', () => {
            overlay.remove();
            this.shutdown();
            this.scene.start('MenuScene');
        });
    }

    private victory(): void {
        this.isPaused = true;
        this.autoSave();
        this.shutdown();
        this.scene.start('VictoryScene');
    }

    shutdown(): void {
        this.autosaveTimer?.remove();
        this.playTimeTimer?.remove();
        this.shopUI?.destroy();
        this.hud?.destroy();
        document.getElementById('pause-overlay')?.remove();
        document.getElementById('gameover-overlay')?.remove();
    }
}
