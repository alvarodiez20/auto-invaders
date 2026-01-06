/**
 * Drone - Autonomous combat drone entity
 */
import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { Bullet } from './Bullet';

// Forward reference interface
interface GameSceneInterface {
    playerBullets: Phaser.GameObjects.Group;
    enemies: Phaser.GameObjects.Group;
    player: { x: number; y: number };
}

export class Drone extends Phaser.GameObjects.Container {
    private graphics!: Phaser.GameObjects.Graphics;
    private orbitAngle: number = 0;
    private orbitRadius: number = 60;
    private orbitSpeed: number = 2;
    private fireTimer: number = 0;
    private gameScene: GameSceneInterface;

    constructor(scene: Phaser.Scene, gameScene: GameSceneInterface, slotIndex: number) {
        super(scene, 0, 0);

        this.gameScene = gameScene;

        // Offset orbit based on slot
        this.orbitAngle = slotIndex * Math.PI;

        this.createGraphics();

        scene.add.existing(this);
    }

    private createGraphics(): void {
        this.graphics = this.scene.add.graphics();

        // Small triangular drone
        this.graphics.fillStyle(0x66ddff, 1);
        this.graphics.fillTriangle(0, -8, -6, 6, 6, 6);

        // Engine glow
        this.graphics.fillStyle(0xff8844, 0.8);
        this.graphics.fillCircle(0, 4, 3);

        this.add(this.graphics);
    }

    preUpdate(_time: number, delta: number): void {
        // Orbit around player
        this.orbitAngle += this.orbitSpeed * (delta / 1000);

        const playerX = this.gameScene.player.x;
        const playerY = this.gameScene.player.y;

        this.x = playerX + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = playerY + Math.sin(this.orbitAngle) * this.orbitRadius * 0.5;

        // Rotate to face movement direction
        this.rotation = this.orbitAngle + Math.PI / 2;

        // Handle shooting
        this.handleShooting(delta);
    }

    private handleShooting(delta: number): void {
        this.fireTimer -= delta;

        if (this.fireTimer <= 0) {
            // Get fire rate from upgrades
            const droneFireRateLevel = SaveManager.getUpgradeLevel('droneFireRate');
            const baseInterval = 800; // ms between shots
            const fireRateMultiplier = Math.pow(1.06, droneFireRateLevel);
            const interval = baseInterval / fireRateMultiplier;

            this.fireTimer = interval;

            // Find closest enemy
            const target = this.findClosestEnemy();
            if (target) {
                this.fireBullet(target.x);
            }
        }
    }

    private findClosestEnemy(): { x: number; y: number } | null {
        let closest: { x: number; y: number } | null = null;
        let closestDist = Infinity;

        this.gameScene.enemies.getChildren().forEach((e) => {
            const enemy = e as unknown as { x: number; y: number; active: boolean };
            if (!enemy.active) return;

            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        });

        return closest;
    }

    private fireBullet(targetX: number): void {
        // Calculate drone damage
        const droneDamageLevel = SaveManager.getUpgradeLevel('droneDamage');
        const baseDamage = 5;
        const damageMultiplier = Math.pow(1.08, droneDamageLevel);
        const damage = baseDamage * damageMultiplier;

        const bullet = new Bullet(
            this.scene,
            this.x,
            this.y - 8,
            damage,
            350,
            targetX,
            true
        );
        this.gameScene.playerBullets.add(bullet);
    }
}
