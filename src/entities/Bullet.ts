/**
 * Bullet - Projectile for both player and enemies
 */
import Phaser from 'phaser';

export class Bullet extends Phaser.GameObjects.Container {
    public damage: number;
    public speed: number;
    public isPlayerBullet: boolean;
    public pierce: boolean = false;
    public pierceCount: number = 0;
    public isCrit: boolean = false;

    private graphics!: Phaser.GameObjects.Graphics;
    private variant: 'standard' | 'pierce' | 'scatter' | 'drone' = 'standard';
    private powerScale: number = 1;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        damage: number,
        speed: number,
        targetX: number = x,
        isPlayerBullet: boolean = true,
        pierce: boolean = false,
        pierceCount: number = 0,
        variant: 'standard' | 'pierce' | 'scatter' | 'drone' = 'standard'
    ) {
        super(scene, x, y);

        this.damage = damage;
        this.speed = speed;
        this.isPlayerBullet = isPlayerBullet;
        this.pierce = pierce;
        this.pierceCount = pierceCount;
        this.variant = variant;
        this.updatePowerScale();

        // Create graphics
        this.createGraphics();

        // Add to scene
        scene.add.existing(this);

        // Enable physics
        scene.physics.add.existing(this);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(8, 16);
        body.setOffset(-4, -8);

        // Calculate velocity
        if (isPlayerBullet) {
            // Player bullets go straight up
            // If targetX differs from x (scatter mode), add slight horizontal velocity
            const horizontalDiff = targetX - x;
            const velocityX = Math.abs(horizontalDiff) > 5 ? horizontalDiff * 0.5 : 0;
            const velocityY = -speed;
            body.setVelocity(velocityX, velocityY);
        } else {
            // Enemy bullets go down
            body.setVelocity(0, speed);
        }
    }

    public fire(
        x: number,
        y: number,
        damage: number,
        speed: number,
        targetX: number = x,
        isPlayerBullet: boolean = true,
        pierce: boolean = false,
        pierceCount: number = 0,
        variant: 'standard' | 'pierce' | 'scatter' | 'drone' = 'standard',
        isCrit: boolean = false
    ): void {
        this.setPosition(x, y);
        this.damage = damage;
        this.speed = speed;
        this.isPlayerBullet = isPlayerBullet;
        this.pierce = pierce;
        this.pierceCount = pierceCount;
        this.variant = variant;
        this.isCrit = isCrit;
        this.updatePowerScale();

        this.setActive(true);
        this.setVisible(true);

        // Re-create graphics if type changed or first run
        this.createGraphics();

        // Physics body reset
        if (this.body) {
            const body = this.body as Phaser.Physics.Arcade.Body;
            body.reset(x, y);

            if (isPlayerBullet) {
                const horizontalDiff = targetX - x;
                const velocityX = Math.abs(horizontalDiff) > 5 ? horizontalDiff * 0.5 : 0;
                const velocityY = -speed;
                body.setVelocity(velocityX, velocityY);
            } else {
                body.setVelocity(0, speed);
            }
        }
    }

    private createGraphics(): void {
        if (this.graphics) {
            this.graphics.clear();
        } else {
            this.graphics = this.scene.add.graphics();
            this.add(this.graphics);
        }

        if (this.isPlayerBullet) {
            let coreColor = 0x44ddff;
            let glowColor = 0x44ddff;
            let width = 4;
            let height = 16;

            if (this.variant === 'pierce') {
                coreColor = 0x88ccff;
                glowColor = 0x88ccff;
                width = 3;
                height = 20;
            } else if (this.variant === 'scatter') {
                coreColor = 0xffdd44;
                glowColor = 0xffdd44;
                width = 5;
                height = 12;
            } else if (this.variant === 'drone') {
                coreColor = 0xff8844;
                glowColor = 0xffaa66;
                width = 3;
                height = 12;
            }

            const scaledHeight = height * this.powerScale;
            const scaledWidth = width * this.powerScale;

            // Player bullet
            this.graphics.fillStyle(coreColor, 1);
            this.graphics.fillRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);

            // Glow effect
            this.graphics.fillStyle(glowColor, 0.35);
            this.graphics.fillRect(-scaledWidth, -scaledHeight / 2 - 3, scaledWidth * 2, scaledHeight + 6);
        } else {
            // Enemy bullet - red/orange
            this.graphics.fillStyle(0xff6644, 1);
            this.graphics.fillRect(-2, -6, 4, 12);

            // Glow effect
            this.graphics.fillStyle(0xff6644, 0.3);
            this.graphics.fillRect(-3, -8, 6, 16);
        }
    }

    private updatePowerScale(): void {
        this.powerScale = Phaser.Math.Clamp(this.damage / 10, 0.7, 2.0);
    }

    preUpdate(): void {
        // Update position based on physics body
        if (this.body) {
            const body = this.body as Phaser.Physics.Arcade.Body;
            this.x = body.x + 4;
            this.y = body.y + 8;
        }
    }
}
