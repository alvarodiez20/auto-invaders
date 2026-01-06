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

    private graphics!: Phaser.GameObjects.Graphics;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        damage: number,
        speed: number,
        targetX: number = x,
        isPlayerBullet: boolean = true,
        pierce: boolean = false,
        pierceCount: number = 0
    ) {
        super(scene, x, y);

        this.damage = damage;
        this.speed = speed;
        this.isPlayerBullet = isPlayerBullet;
        this.pierce = pierce;
        this.pierceCount = pierceCount;

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
            // Player bullets go up, with optional slight homing
            const angle = Math.atan2(-300, targetX - x);
            const velocityX = Math.sin(angle) * speed * 0.3;
            const velocityY = -speed;
            body.setVelocity(velocityX, velocityY);
        } else {
            // Enemy bullets go down
            body.setVelocity(0, speed);
        }
    }

    private createGraphics(): void {
        this.graphics = this.scene.add.graphics();

        if (this.isPlayerBullet) {
            // Player bullet - cyan/blue
            this.graphics.fillStyle(0x44ddff, 1);
            this.graphics.fillRect(-2, -8, 4, 16);

            // Glow effect
            this.graphics.fillStyle(0x44ddff, 0.3);
            this.graphics.fillRect(-4, -10, 8, 20);
        } else {
            // Enemy bullet - red/orange
            this.graphics.fillStyle(0xff6644, 1);
            this.graphics.fillRect(-2, -6, 4, 12);

            // Glow effect
            this.graphics.fillStyle(0xff6644, 0.3);
            this.graphics.fillRect(-3, -8, 6, 16);
        }

        this.add(this.graphics);
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
