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

    private graphics!: Phaser.GameObjects.Graphics;
    private hpBar!: Phaser.GameObjects.Graphics;
    private heatBar!: Phaser.GameObjects.Graphics;
    private autopilotEnabled: boolean = false;
    private targetX: number;

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
        this.graphics = this.scene.add.graphics();

        // Ship body (triangle pointing up)
        this.graphics.fillStyle(0x44aaff, 1);
        this.graphics.fillTriangle(0, -20, -20, 15, 20, 15);

        // Cockpit
        this.graphics.fillStyle(0x66ddff, 1);
        this.graphics.fillTriangle(0, -10, -8, 8, 8, 8);

        // Engine glow
        this.graphics.fillStyle(0xff6644, 0.8);
        this.graphics.fillRect(-8, 15, 4, 8);
        this.graphics.fillRect(4, 15, 4, 8);

        // Wing details
        this.graphics.lineStyle(2, 0x88ccff, 1);
        this.graphics.lineBetween(-18, 10, -8, 0);
        this.graphics.lineBetween(18, 10, 8, 0);

        this.add(this.graphics);
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

    update(_time: number, delta: number): void {
        // Handle autopilot movement
        if (this.autopilotEnabled) {
            this.handleAutopilot(delta);
        }

        // Keyboard manual movement (always available)
        this.handleKeyboardMovement(delta);

        // Handle heat cooling
        this.handleCooling(delta);

        // Update bars
        this.updateHPBar();
        this.updateHeatBar();

        // Save current HP
        SaveManager.update({ playerHP: this.currentHP });
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

    private handleAutopilot(delta: number): void {
        const autopilotV2 = SaveManager.hasUpgrade('autopilotV2');
        const autopilotV3 = SaveManager.hasUpgrade('autopilotV3');

        // Calculate target position based on AI level
        if (autopilotV3) {
            // V3: Opportunist - position near valuable targets
            this.targetX = this.calculateOpportunistPosition();
        } else if (autopilotV2) {
            // V2: Threat-aware - dodge incoming fire and stay near threats
            this.targetX = this.calculateThreatAwarePosition();
        } else {
            // V1: Simple - stay near center, slight wander
            this.targetX = GAME_WIDTH / 2 + Math.sin(performance.now() / 1000) * 100;
        }

        // Move towards target
        this.moveTowardsTarget(delta);
    }

    private calculateThreatAwarePosition(): number {
        // Simple: stay near center with some randomness
        return GAME_WIDTH / 2 + Math.sin(performance.now() / 800) * 150;
    }

    private calculateOpportunistPosition(): number {
        // Simple: follow a patrol pattern
        return GAME_WIDTH / 2 + Math.sin(performance.now() / 600) * 200;
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

    public takeDamage(amount: number): void {
        this.currentHP = Math.max(0, this.currentHP - amount);

        // Flash effect using tween
        this.scene.tweens.add({
            targets: this.graphics,
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
}
