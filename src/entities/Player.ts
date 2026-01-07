/**
 * Player - The player's ship with graphics, HP, and movement
 */
import Phaser from 'phaser';
import {
    GAME_WIDTH,
    PLAYER_BASE_HP,
    PLAYER_BASE_MOVE_SPEED,
} from '../config/GameConfig';
import { SaveManager } from '../systems/SaveManager';

export class Player extends Phaser.GameObjects.Container {
    public currentHP: number;
    public maxHP: number;

    // Heat system (S5+)
    public currentHeat: number = 0;
    public maxHeat: number = 100;
    public isOverheated: boolean = false;

    private baseGraphics!: Phaser.GameObjects.Graphics;
    private detailGraphics!: Phaser.GameObjects.Graphics;
    private engineGraphics!: Phaser.GameObjects.Graphics;
    private armorGraphics!: Phaser.GameObjects.Graphics;
    private navGraphics!: Phaser.GameObjects.Graphics;
    private coreGraphics!: Phaser.GameObjects.Graphics;
    private aiRingGraphics!: Phaser.GameObjects.Graphics;
    private hpBar!: Phaser.GameObjects.Graphics;
    private heatBar!: Phaser.GameObjects.Graphics;
    private autopilotEnabled: boolean = false;
    private targetX: number;
    private lastSector: number = -1;
    private lastHullLevel: number = -1;
    private lastWeaponTier: number = -1;
    private lastAutopilotState: boolean = false;
    private lastCoreCount: number = -1;
    private lastDamageLevel: number = -1;
    private lastCoreUnlocks: { weaponModSlot: boolean; behaviorScripts: boolean } | null = null;
    private steamTimer: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        // Initialize HP
        const save = SaveManager.getCurrent();
        const hullBonus = 1 + (SaveManager.getUpgradeLevel('hull') * 0.10);
        this.maxHP = Math.round(PLAYER_BASE_HP * hullBonus);
        this.currentHP = save.playerHP > 0 ? Math.min(save.playerHP, this.maxHP) : this.maxHP;

        // Initialize heat capacity (S5 upgrades)
        const heatCapacityBonus = 1 + (SaveManager.getUpgradeLevel('heatCapacity') * 0.10);
        this.maxHeat = 100 * heatCapacityBonus;

        this.targetX = x;

        // Check if autopilot already unlocked
        this.autopilotEnabled = SaveManager.hasUpgrade('autopilot');

        // Create ship graphics
        this.createShipGraphics();
        this.createHPBar();
        this.createHeatBar();

        // Add to scene
        scene.add.existing(this);

        // Enable physics
        scene.physics.add.existing(this);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(40, 30);
        body.setOffset(-20, -15);
    }

    private createShipGraphics(): void {
        this.engineGraphics = this.scene.add.graphics();
        this.baseGraphics = this.scene.add.graphics();
        this.armorGraphics = this.scene.add.graphics();
        this.detailGraphics = this.scene.add.graphics();
        this.navGraphics = this.scene.add.graphics();
        this.coreGraphics = this.scene.add.graphics();
        this.aiRingGraphics = this.scene.add.graphics();

        this.add(this.engineGraphics);
        this.add(this.baseGraphics);
        this.add(this.armorGraphics);
        this.add(this.detailGraphics);
        this.add(this.navGraphics);
        this.add(this.coreGraphics);
        this.add(this.aiRingGraphics);

        this.refreshVisuals();
    }

    private refreshVisuals(): void {
        const save = SaveManager.getCurrent();
        const sectorColor = this.getSectorColor();
        const hullLevel = SaveManager.getUpgradeLevel('hull');
        const weaponTier = this.getWeaponTier();

        this.baseGraphics.clear();
        this.armorGraphics.clear();
        this.detailGraphics.clear();
        this.aiRingGraphics.clear();

        this.drawBaseShip(sectorColor);
        this.drawArmor(hullLevel, this.adjustColor(sectorColor, 40));
        this.drawDetails(this.adjustColor(sectorColor, 60), weaponTier);

        if (this.autopilotEnabled) {
            this.drawAutopilotRing();
        }

        this.lastSector = save.currentSector;
        this.lastHullLevel = hullLevel;
        this.lastWeaponTier = weaponTier;
        this.lastAutopilotState = this.autopilotEnabled;
    }

    private refreshVisualsIfNeeded(): void {
        const save = SaveManager.getCurrent();
        const hullLevel = SaveManager.getUpgradeLevel('hull');
        const weaponTier = this.getWeaponTier();
        const autopilot = this.autopilotEnabled;

        if (
            save.currentSector !== this.lastSector ||
            hullLevel !== this.lastHullLevel ||
            weaponTier !== this.lastWeaponTier ||
            autopilot !== this.lastAutopilotState
        ) {
            this.refreshVisuals();
        }
    }

    private drawBaseShip(color: number): void {
        // Ship body (triangle pointing up)
        this.baseGraphics.fillStyle(color, 1);
        this.baseGraphics.fillTriangle(0, -20, -20, 15, 20, 15);

        // Wing extensions
        this.baseGraphics.fillTriangle(-20, 6, -32, 12, -18, 12);
        this.baseGraphics.fillTriangle(20, 6, 32, 12, 18, 12);
    }

    private drawDetails(accentColor: number, weaponTier: number): void {
        // Cockpit
        this.detailGraphics.fillStyle(this.adjustColor(accentColor, 20), 1);
        this.detailGraphics.fillTriangle(0, -10, -8, 8, 8, 8);

        // Wing details
        this.detailGraphics.lineStyle(2, accentColor, 1);
        this.detailGraphics.lineBetween(-18, 10, -8, 0);
        this.detailGraphics.lineBetween(18, 10, 8, 0);

        // Weapon pods grow with upgrades
        if (weaponTier >= 1) {
            this.detailGraphics.fillStyle(this.adjustColor(accentColor, 40), 1);
            this.detailGraphics.fillRect(-24, 2, 6, 10);
            this.detailGraphics.fillRect(18, 2, 6, 10);
        }

        if (weaponTier >= 2) {
            this.detailGraphics.fillStyle(this.adjustColor(accentColor, 60), 1);
            this.detailGraphics.fillRect(-10, -18, 4, 8);
            this.detailGraphics.fillRect(6, -18, 4, 8);
        }

        if (weaponTier >= 3) {
            this.detailGraphics.lineStyle(1, this.adjustColor(accentColor, 90), 1);
            this.detailGraphics.strokeRect(-14, -6, 28, 8);
        }
    }

    private drawArmor(hullLevel: number, armorColor: number): void {
        if (hullLevel <= 0) return;

        const plateCount = Math.min(3, Math.floor(hullLevel / 4) + 1);
        this.armorGraphics.fillStyle(armorColor, 0.8);

        for (let i = 0; i < plateCount; i++) {
            const offset = i * 3;
            this.armorGraphics.fillRect(-20 - offset, 8 + offset, 8, 6);
            this.armorGraphics.fillRect(12 + offset, 8 + offset, 8, 6);
        }
    }

    private drawAutopilotRing(): void {
        this.aiRingGraphics.lineStyle(1, 0x44ddff, 0.6);
        this.aiRingGraphics.strokeCircle(0, -26, 10);
        this.aiRingGraphics.lineBetween(-6, -26, 6, -26);
        this.aiRingGraphics.lineBetween(0, -32, 0, -20);
    }

    private updateEngineGlow(time: number): void {
        const heatPercent = this.maxHeat > 0 ? this.currentHeat / this.maxHeat : 0;
        const coolColor = 0x44ddff;
        const hotColor = 0xff6644;
        const glowColor = this.interpolateColor(coolColor, hotColor, heatPercent);
        const fireRateLevel = SaveManager.getUpgradeLevel('fireRate');
        const pulseSpeed = Math.max(140, 260 - fireRateLevel * 6);
        const pulse = (Math.sin(time / pulseSpeed) + 1) / 2;
        const glowAlpha = Phaser.Math.Clamp(0.35 + heatPercent * 0.6 + pulse * 0.15, 0.35, 1);

        this.engineGraphics.clear();
        this.engineGraphics.fillStyle(glowColor, glowAlpha);
        this.engineGraphics.fillRect(-9, 15, 5, 10 + heatPercent * 6);
        this.engineGraphics.fillRect(4, 15, 5, 10 + heatPercent * 6);
    }

    private updateNavLights(time: number): void {
        const pulse = (Math.sin(time / 180) + 1) / 2;
        this.navGraphics.clear();
        this.navGraphics.fillStyle(0x44ff88, 0.4 + pulse * 0.6);
        this.navGraphics.fillCircle(-26, 12, 2);
        this.navGraphics.fillStyle(0xff4466, 0.4 + (1 - pulse) * 0.6);
        this.navGraphics.fillCircle(26, 12, 2);
    }

    private updateAutopilotRing(time: number): void {
        if (!this.autopilotEnabled) {
            this.aiRingGraphics.setVisible(false);
            return;
        }

        this.aiRingGraphics.setVisible(true);
        this.aiRingGraphics.alpha = 0.6 + Math.sin(time / 250) * 0.2;
        this.aiRingGraphics.rotation = time / 1500;
    }

    private updateCoreGlow(): void {
        const save = SaveManager.getCurrent();
        const unlocks = {
            weaponModSlot: SaveManager.hasUpgrade('weaponModSlot'),
            behaviorScripts: SaveManager.hasUpgrade('behaviorScripts'),
        };

        const damageLevel = SaveManager.getUpgradeLevel('damage');
        if (
            save.cores === this.lastCoreCount &&
            damageLevel === this.lastDamageLevel &&
            this.lastCoreUnlocks &&
            unlocks.weaponModSlot === this.lastCoreUnlocks.weaponModSlot &&
            unlocks.behaviorScripts === this.lastCoreUnlocks.behaviorScripts
        ) {
            return;
        }

        this.coreGraphics.clear();

        const damageBoost = Math.min(0.4, damageLevel * 0.02);
        const coreAlpha = Phaser.Math.Clamp(0.3 + save.cores * 0.2 + damageBoost, 0.3, 0.95);
        this.coreGraphics.fillStyle(0x44ddff, coreAlpha);
        this.coreGraphics.fillCircle(0, 2, 4 + damageBoost * 4);

        if (unlocks.weaponModSlot) {
            this.coreGraphics.fillStyle(0x44ff88, 0.8);
            this.coreGraphics.fillCircle(-8, 4, 2);
        }

        if (unlocks.behaviorScripts) {
            this.coreGraphics.fillStyle(0xffdd44, 0.8);
            this.coreGraphics.fillCircle(8, 4, 2);
        }

        this.lastCoreCount = save.cores;
        this.lastDamageLevel = damageLevel;
        this.lastCoreUnlocks = unlocks;
    }

    private emitCoolingSteam(delta: number): void {
        if (this.currentHeat <= 0) return;

        this.steamTimer -= delta;
        if (this.currentHeat < this.maxHeat * 0.5 || this.steamTimer > 0) return;

        this.steamTimer = 180;
        const puff = this.scene.add.circle(this.x, this.y + 22, 2, 0x88ccff, 0.6);
        this.scene.tweens.add({
            targets: puff,
            y: puff.y + 10,
            alpha: 0,
            duration: 400,
            ease: 'Sine.easeOut',
            onComplete: () => puff.destroy(),
        });
    }

    private getSectorColor(): number {
        const sectorColors = [0x44aaff, 0x44ddff, 0x66ffaa, 0x88ccff, 0xffaa44, 0xff6644];
        const save = SaveManager.getCurrent();
        return sectorColors[save.currentSector] || 0x44aaff;
    }

    private getWeaponTier(): number {
        const damage = SaveManager.getUpgradeLevel('damage');
        const fireRate = SaveManager.getUpgradeLevel('fireRate');
        return Math.min(3, Math.floor((damage + fireRate) / 5));
    }

    private adjustColor(color: number, delta: number): number {
        const rgb = Phaser.Display.Color.IntegerToRGB(color);
        const r = Phaser.Math.Clamp(rgb.r + delta, 0, 255);
        const g = Phaser.Math.Clamp(rgb.g + delta, 0, 255);
        const b = Phaser.Math.Clamp(rgb.b + delta, 0, 255);
        return Phaser.Display.Color.GetColor(r, g, b);
    }

    private interpolateColor(from: number, to: number, t: number): number {
        const fromRgb = Phaser.Display.Color.IntegerToRGB(from);
        const toRgb = Phaser.Display.Color.IntegerToRGB(to);
        const r = Math.round(Phaser.Math.Linear(fromRgb.r, toRgb.r, t));
        const g = Math.round(Phaser.Math.Linear(fromRgb.g, toRgb.g, t));
        const b = Math.round(Phaser.Math.Linear(fromRgb.b, toRgb.b, t));
        return Phaser.Display.Color.GetColor(r, g, b);
    }

    private createHPBar(): void {
        this.hpBar = this.scene.add.graphics();
        this.updateHPBar();
        this.add(this.hpBar);
    }

    private createHeatBar(): void {
        this.heatBar = this.scene.add.graphics();
        this.updateHeatBar();
        this.add(this.heatBar);
    }

    private updateHPBar(): void {
        this.hpBar.clear();

        const barWidth = 40;
        const barHeight = 4;
        const barY = 25;

        // Background
        this.hpBar.fillStyle(0x333333, 0.8);
        this.hpBar.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        // HP fill
        const hpPercent = this.currentHP / this.maxHP;
        let color = 0x44ff88;
        if (hpPercent < 0.3) color = 0xff4466;
        else if (hpPercent < 0.6) color = 0xffaa44;

        this.hpBar.fillStyle(color, 1);
        this.hpBar.fillRect(-barWidth / 2, barY, barWidth * hpPercent, barHeight);
    }

    private updateHeatBar(): void {
        this.heatBar.clear();

        // Only show heat bar if S5 heat system is active
        const save = SaveManager.getCurrent();
        if (save.highestSector < 5) return;

        const barWidth = 40;
        const barHeight = 3;
        const barY = 31;

        // Background
        this.heatBar.fillStyle(0x222233, 0.8);
        this.heatBar.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        // Heat fill
        const heatPercent = this.currentHeat / this.maxHeat;
        let color = 0x4488ff; // Cool
        if (heatPercent > 0.8) color = 0xff4444; // Overheating
        else if (heatPercent > 0.5) color = 0xff8844; // Warm

        this.heatBar.fillStyle(color, 1);
        this.heatBar.fillRect(-barWidth / 2, barY, barWidth * heatPercent, barHeight);
    }

    update(time: number, delta: number): void {
        // Handle autopilot movement
        if (this.autopilotEnabled) {
            this.handleAutopilot(time, delta);
        }

        // Keyboard manual movement (always available)
        this.handleKeyboardMovement(delta);

        // Handle heat cooling
        this.handleCooling(delta);

        // Update upgrade visuals
        this.refreshVisualsIfNeeded();
        this.updateEngineGlow(time);
        this.updateNavLights(time);
        this.updateAutopilotRing(time);
        this.updateCoreGlow();
        this.emitCoolingSteam(delta);

        // Update bars
        this.updateHPBar();
        this.updateHeatBar();

        // Save current HP/Max HP for consistency
        SaveManager.update({ playerHP: this.currentHP, playerMaxHP: this.maxHP });
    }

    private handleCooling(delta: number): void {
        if (this.currentHeat > 0) {
            const coolingRateBonus = 1 + (SaveManager.getUpgradeLevel('coolingRate') * 0.08);
            const baseCooling = 15; // Per second
            const cooling = baseCooling * coolingRateBonus * (delta / 1000);
            this.currentHeat = Math.max(0, this.currentHeat - cooling);

            // Exit overheat when cooled below 50%
            if (this.isOverheated && this.currentHeat < this.maxHeat * 0.5) {
                this.isOverheated = false;
            }
        }
    }

    public addHeat(amount: number): void {
        this.currentHeat = Math.min(this.maxHeat, this.currentHeat + amount);

        // Trigger overheat at 100%
        if (this.currentHeat >= this.maxHeat) {
            this.isOverheated = true;
        }
    }

    public getHeatPenalty(): number {
        // Return fire rate multiplier (1.0 = normal, 0.3 = overheated)
        if (this.isOverheated) {
            return 0.3;
        }
        return 1.0;
    }

    private handleAutopilot(time: number, delta: number): void {
        const autopilotV2 = SaveManager.hasUpgrade('autopilotV2');
        const autopilotV3 = SaveManager.hasUpgrade('autopilotV3');

        // Calculate target position based on AI level
        if (autopilotV3) {
            // V3: Dodge bullets + prioritize valuable targets
            this.targetX = this.calculateDodgeAndTargetPosition(time);
        } else if (autopilotV2) {
            // V2: Position under most dangerous enemy
            this.targetX = this.calculateDangerousEnemyPosition(time);
        } else {
            // V1: Patrol across the screen (range grows with thruster upgrades)
            this.targetX = this.calculatePatrolPosition(time);
        }

        // Move towards target
        this.moveTowardsTarget(delta);
    }

    private calculatePatrolPosition(time: number): number {
        const rangeLevel = SaveManager.getUpgradeLevel('autopilotRange');
        const maxRange = GAME_WIDTH / 2 - 30;
        const baseRange = 90;
        const range = Math.min(maxRange, baseRange + rangeLevel * 24);
        const period = Math.max(1400, 3200 - rangeLevel * 120);
        return GAME_WIDTH / 2 + Math.sin(time / period) * range;
    }

    private calculateDangerousEnemyPosition(time: number): number {
        const enemy = this.findMostDangerousEnemy();
        if (enemy) {
            return enemy.x;
        }

        return this.calculatePatrolPosition(time);
    }

    private calculateDodgeAndTargetPosition(time: number): number {
        const target = this.findMostValuableEnemy() || this.findMostDangerousEnemy();
        let desiredX = target ? target.x : this.calculatePatrolPosition(time);

        const dodgeOffset = this.getBulletAvoidanceOffset();
        desiredX += dodgeOffset;

        return Phaser.Math.Clamp(desiredX, 30, GAME_WIDTH - 30);
    }

    private findMostDangerousEnemy(): { x: number; y: number } | null {
        const enemies = this.getEnemyGroup();
        if (!enemies) return null;

        let best: { x: number; y: number } | null = null;
        let bestScore = -Infinity;

        enemies.getChildren().forEach((enemy) => {
            const e = enemy as unknown as { x: number; y: number; active: boolean };
            if (!e.active) return;
            if (e.y > bestScore) {
                bestScore = e.y;
                best = { x: e.x, y: e.y };
            }
        });

        return best;
    }

    private findMostValuableEnemy(): { x: number; y: number } | null {
        const enemies = this.getEnemyGroup();
        if (!enemies) return null;

        let best: { x: number; y: number; scrapValue?: number } | null = null;
        let bestScore = -Infinity;

        enemies.getChildren().forEach((enemy) => {
            const e = enemy as unknown as { x: number; y: number; active: boolean; scrapValue?: number };
            if (!e.active) return;
            const scrap = e.scrapValue ?? 0;
            const score = scrap * 2 + e.y * 0.01;
            if (score > bestScore) {
                bestScore = score;
                best = { x: e.x, y: e.y, scrapValue: scrap };
            }
        });

        return best;
    }

    private getBulletAvoidanceOffset(): number {
        const bullets = this.getEnemyBulletsGroup();
        if (!bullets) return 0;

        let offset = 0;
        bullets.getChildren().forEach((bullet) => {
            const b = bullet as unknown as { x: number; y: number; active: boolean };
            if (!b.active) return;

            const dy = this.y - b.y;
            if (dy < 0 || dy > 220) return;

            const dx = this.x - b.x;
            const distance = Math.abs(dx);
            if (distance > 70) return;

            const strength = (1 - distance / 70) * (1 - dy / 220);
            offset += Math.sign(dx || 1) * strength * 90;
        });

        return Phaser.Math.Clamp(offset, -90, 90);
    }

    private getEnemyGroup(): Phaser.GameObjects.Group | null {
        const sceneAny = this.scene as unknown as { enemies?: Phaser.GameObjects.Group };
        return sceneAny.enemies ?? null;
    }

    private getEnemyBulletsGroup(): Phaser.GameObjects.Group | null {
        const sceneAny = this.scene as unknown as { enemyBullets?: Phaser.GameObjects.Group };
        return sceneAny.enemyBullets ?? null;
    }

    private handleKeyboardMovement(delta: number): void {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;

        const speed = this.getMoveSpeed() * (delta / 1000);

        if (keyboard.addKey('A').isDown || keyboard.addKey('LEFT').isDown) {
            this.x = Math.max(30, this.x - speed);
        }
        if (keyboard.addKey('D').isDown || keyboard.addKey('RIGHT').isDown) {
            this.x = Math.min(GAME_WIDTH - 30, this.x + speed);
        }
    }

    private moveTowardsTarget(delta: number): void {
        const speed = this.getMoveSpeed() * (delta / 1000);
        const diff = this.targetX - this.x;

        if (Math.abs(diff) > 5) {
            const move = Math.sign(diff) * Math.min(speed, Math.abs(diff));
            this.x = Phaser.Math.Clamp(this.x + move, 30, GAME_WIDTH - 30);
        }
    }

    private getMoveSpeed(): number {
        const thrusterBonus = 1 + (SaveManager.getUpgradeLevel('thrusterSpeed') * 0.05);
        return PLAYER_BASE_MOVE_SPEED * thrusterBonus;
    }

    public enableAutopilot(): void {
        this.autopilotEnabled = true;
    }

    public setAutopilotEnabled(enabled: boolean): void {
        if (enabled && !SaveManager.hasUpgrade('autopilot')) return;
        this.autopilotEnabled = enabled;
    }

    public toggleAutopilot(): boolean {
        if (!SaveManager.hasUpgrade('autopilot')) return this.autopilotEnabled;
        this.autopilotEnabled = !this.autopilotEnabled;
        return this.autopilotEnabled;
    }

    public isAutopilotEnabled(): boolean {
        return this.autopilotEnabled;
    }

    public playMuzzleFlash(power: number, variant: 'standard' | 'pierce' | 'scatter' | 'drone' = 'standard'): void {
        const intensity = Phaser.Math.Clamp(power / 10, 0.8, 2.0);
        let color = 0x44ddff;
        if (variant === 'pierce') color = 0x88ccff;
        if (variant === 'scatter') color = 0xffdd44;
        if (variant === 'drone') color = 0xff8844;

        const flash = this.scene.add.circle(this.x, this.y - 26, 4 * intensity, color, 0.8);
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.6,
            duration: 120,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy(),
        });
    }

    public takeDamage(amount: number): void {
        this.currentHP = Math.max(0, this.currentHP - amount);

        // Flash effect using tween
        this.scene.tweens.add({
            targets: [this.baseGraphics, this.detailGraphics, this.armorGraphics],
            alpha: 0.5,
            duration: 50,
            yoyo: true,
        });
    }

    public restoreHP(): void {
        this.currentHP = this.maxHP;
    }

    public heal(amount: number): void {
        this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    }

    public applyHullUpgrade(): void {
        const hullBonus = 1 + (SaveManager.getUpgradeLevel('hull') * 0.10);
        const newMax = Math.round(PLAYER_BASE_HP * hullBonus);
        const diff = newMax - this.maxHP;

        if (diff <= 0) return;

        this.maxHP = newMax;
        this.currentHP = Math.min(this.currentHP + diff, this.maxHP);
        SaveManager.update({ playerHP: this.currentHP, playerMaxHP: this.maxHP });
    }
}
