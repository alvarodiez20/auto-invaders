/**
 * Enemy - Base enemy entity with different types
 */
import Phaser from 'phaser';
import {
    ENEMY_TYPES,
    EnemyStats,
    getEnemyHP,
    getScrapDrop,
    getEnemyFireMultiplier,
    getEnemyBulletSpeedMultiplier,
    GAME_WIDTH,
    GAME_HEIGHT,
    MAX_ENEMY_BULLETS,
} from '../config/GameConfig';
import { Bullet } from './Bullet';
import { SaveManager } from '../systems/SaveManager';

export class Enemy extends Phaser.GameObjects.Container {
    public enemyType: string;
    public currentHP: number;
    public maxHP: number;
    public scrapValue: number;
    public isMarked: boolean = false;
    public isBoss: boolean = false;

    private stats: EnemyStats;
    private graphics!: Phaser.GameObjects.Graphics;
    private hpBar!: Phaser.GameObjects.Graphics;
    private markIndicator?: Phaser.GameObjects.Graphics;
    private shieldHP: number = 0;
    private hasShield: boolean = false;

    private moveDirection: number = 1;
    private moveTimer: number = 0;
    private fireTimer: number = 0;
    private globalWave: number;

    // Reference to enemy bullets group (set by GameScene)
    private enemyBulletsGroup?: Phaser.GameObjects.Group;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        type: string,
        sector: number,
        globalWave: number,
        enemyBulletsGroup?: Phaser.GameObjects.Group
    ) {
        super(scene, x, y);

        this.enemyType = type;
        this.globalWave = globalWave;
        this.stats = ENEMY_TYPES[type] || ENEMY_TYPES.grunt;
        this.enemyBulletsGroup = enemyBulletsGroup;

        // Calculate scaled stats
        this.maxHP = getEnemyHP(type, sector, globalWave);
        this.currentHP = this.maxHP;
        this.scrapValue = getScrapDrop(type, globalWave);

        // Shield for shielded type
        if (type === 'shielded') {
            this.hasShield = true;
            this.shieldHP = this.maxHP * 0.5;
        }

        // Create graphics
        this.createGraphics();
        this.createHPBar();

        // Add to scene
        scene.add.existing(this);

        // Enable physics
        scene.physics.add.existing(this);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(this.stats.width, this.stats.height);
        body.setOffset(-this.stats.width / 2, -this.stats.height / 2);

        // Initialize timers with randomization
        this.fireTimer = Phaser.Math.Between(1000, 3000);
        this.moveTimer = 0;
    }

    private createGraphics(): void {
        this.graphics = this.scene.add.graphics();

        const w = this.stats.width;
        const h = this.stats.height;

        // Main body
        this.graphics.fillStyle(this.stats.color, 1);

        // Different shapes for different enemy types
        switch (this.enemyType) {
            case 'grunt':
                // Invader-like shape
                this.graphics.fillRect(-w / 2, -h / 2, w, h);
                this.graphics.fillStyle(0x000000, 0.5);
                this.graphics.fillRect(-w / 3, -h / 4, w / 6, h / 4);
                this.graphics.fillRect(w / 6, -h / 4, w / 6, h / 4);
                break;

            case 'swarmer':
                // Small diamond
                this.graphics.fillTriangle(0, -h / 2, -w / 2, 0, 0, h / 2);
                this.graphics.fillTriangle(0, -h / 2, w / 2, 0, 0, h / 2);
                break;

            case 'tank':
                // Thick rectangle with armor plates
                this.graphics.fillRect(-w / 2, -h / 2, w, h);
                this.graphics.fillStyle(0x444444, 1);
                this.graphics.fillRect(-w / 2 + 4, -h / 2, 8, h);
                this.graphics.fillRect(w / 2 - 12, -h / 2, 8, h);
                break;

            case 'shielded':
                // Core with shield ring
                this.graphics.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
                this.graphics.lineStyle(3, 0x88ccff, 0.8);
                this.graphics.strokeRect(-w / 2, -h / 2, w, h);
                break;

            case 'bomber':
                // Round with warning colors
                this.graphics.fillCircle(0, 0, w / 2);
                this.graphics.fillStyle(0xffaa00, 1);
                this.graphics.fillCircle(0, 0, w / 4);
                break;

            case 'jammer':
                // Antenna-like shape
                this.graphics.fillRect(-w / 2, -h / 4, w, h / 2);
                this.graphics.fillRect(-3, -h / 2, 6, h);
                this.graphics.lineStyle(2, 0xff44ff, 0.8);
                this.graphics.lineBetween(-w / 3, -h / 2, -w / 3, -h / 2 - 10);
                this.graphics.lineBetween(w / 3, -h / 2, w / 3, -h / 2 - 10);
                break;

            case 'splitter':
            case 'splitter_mini':
                // Angular shape that looks like it could split
                this.graphics.fillTriangle(-w / 2, h / 2, 0, -h / 2, w / 2, h / 2);
                break;

            case 'diver':
                // Streamlined fast-looking shape
                this.graphics.fillTriangle(0, -h / 2, -w / 2, h / 3, w / 2, h / 3);
                this.graphics.fillRect(-w / 4, h / 3, w / 2, h / 6);
                break;

            case 'collector':
                // Claw-like shape
                this.graphics.fillRect(-w / 2, -h / 2, w, h * 0.6);
                this.graphics.fillRect(-w / 2, h * 0.1, w / 4, h * 0.4);
                this.graphics.fillRect(w / 4, h * 0.1, w / 4, h * 0.4);
                break;

            default:
                this.graphics.fillRect(-w / 2, -h / 2, w, h);
        }

        this.add(this.graphics);
    }

    private createHPBar(): void {
        this.hpBar = this.scene.add.graphics();
        this.updateHPBar();
        this.add(this.hpBar);
    }

    private updateHPBar(): void {
        this.hpBar.clear();

        const barWidth = this.stats.width;
        const barHeight = 3;
        const barY = -this.stats.height / 2 - 6;

        // Background
        this.hpBar.fillStyle(0x333333, 0.8);
        this.hpBar.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        // HP fill
        const hpPercent = this.currentHP / this.maxHP;
        this.hpBar.fillStyle(0xff4466, 1);
        this.hpBar.fillRect(-barWidth / 2, barY, barWidth * hpPercent, barHeight);

        // Shield bar (if applicable)
        if (this.hasShield && this.shieldHP > 0) {
            this.hpBar.fillStyle(0x4488ff, 0.8);
            const shieldPercent = this.shieldHP / (this.maxHP * 0.5);
            this.hpBar.fillRect(-barWidth / 2, barY - 4, barWidth * shieldPercent, 2);
        }
    }

    preUpdate(_time: number, delta: number): void {
        if (!this.active) return;

        // Movement
        this.handleMovement(delta);

        // Shooting
        if (this.stats.canShoot) {
            this.handleShooting(delta);
        }

        // Update HP bar
        this.updateHPBar();

        // Check if off screen (bottom)
        if (this.y > GAME_HEIGHT + 50) {
            // Collectors steal scrap
            if (this.enemyType === 'collector') {
                const current = SaveManager.getCurrent();
                SaveManager.update({ scrap: Math.max(0, current.scrap - this.scrapValue * 2) });
            }
            this.destroy();
        }
    }

    private handleMovement(delta: number): void {
        const speed = this.stats.speed;

        // Descend slowly
        this.y += speed * 0.3 * (delta / 1000);

        // Horizontal movement varies by type
        switch (this.enemyType) {
            case 'diver':
                // Fast horizontal sweeps
                this.moveTimer += delta;
                if (this.moveTimer > 500) {
                    this.moveDirection *= -1;
                    this.moveTimer = 0;
                }
                this.x += this.moveDirection * speed * 2 * (delta / 1000);
                break;

            case 'swarmer':
                // Erratic movement
                this.x += Math.sin(performance.now() / 200 + this.x) * speed * 0.5 * (delta / 1000);
                break;

            default:
                // Standard side-to-side
                this.moveTimer += delta;
                if (this.moveTimer > 2000) {
                    this.moveDirection *= -1;
                    this.moveTimer = 0;
                }
                this.x += this.moveDirection * speed * 0.5 * (delta / 1000);
        }

        // Keep in bounds
        this.x = Phaser.Math.Clamp(this.x, 30, GAME_WIDTH - 30);
    }

    private handleShooting(delta: number): void {
        if (!this.enemyBulletsGroup) return;

        this.fireTimer -= delta;

        if (this.fireTimer <= 0 && this.enemyBulletsGroup.getLength() < MAX_ENEMY_BULLETS) {
            const interval = this.stats.shootInterval || 3000;
            const fireMult = getEnemyFireMultiplier(this.globalWave);
            this.fireTimer = interval / fireMult + Phaser.Math.Between(-500, 500);

            // Fire bullet
            const bulletSpeed = 150 * getEnemyBulletSpeedMultiplier(this.globalWave);
            const damage = 10;

            const bullet = new Bullet(
                this.scene,
                this.x,
                this.y + this.stats.height / 2,
                damage,
                bulletSpeed,
                this.x,
                false
            );
            this.enemyBulletsGroup.add(bullet);
        }
    }

    public takeDamage(amount: number): void {
        // Shield absorbs damage first
        if (this.hasShield && this.shieldHP > 0) {
            const shieldDamage = Math.min(this.shieldHP, amount);
            this.shieldHP -= shieldDamage;
            amount -= shieldDamage;

            if (amount <= 0) {
                this.flashEffect(0x4488ff);
                return;
            }
        }

        this.currentHP -= amount;

        // Flash effect
        this.flashEffect(0xffffff);

        // Check for death
        if (this.currentHP <= 0) {
            this.onDeath();
        }
    }

    private flashEffect(color: number): void {
        const flash = this.scene.add.graphics();
        flash.fillStyle(color, 0.5);
        flash.fillRect(-this.stats.width / 2, -this.stats.height / 2, this.stats.width, this.stats.height);
        this.add(flash);

        this.scene.time.delayedCall(50, () => {
            flash.destroy();
        });
    }

    private onDeath(): void {
        // Splitter spawns mini enemies - handled by GameScene
        // Mark as inactive and destroy
        this.setActive(false);
        this.destroy();
    }

    public setMarked(marked: boolean): void {
        this.isMarked = marked;

        if (marked) {
            if (!this.markIndicator) {
                this.markIndicator = this.scene.add.graphics();
                this.add(this.markIndicator);
            }

            // Draw mark indicator (pulsing ring)
            this.markIndicator.clear();
            this.markIndicator.lineStyle(2, 0xffdd44, 1);
            this.markIndicator.strokeCircle(0, 0, this.stats.width / 2 + 8);
        } else {
            this.markIndicator?.clear();
        }
    }

    public setEnemyBulletsGroup(group: Phaser.GameObjects.Group): void {
        this.enemyBulletsGroup = group;
    }
}
