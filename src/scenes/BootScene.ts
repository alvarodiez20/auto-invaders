/**
 * BootScene - Initial loading scene
 */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload(): void {
        // No external assets to load - using Phaser shapes
        // Show a simple loading indicator
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const loadingText = this.add.text(width / 2, height / 2, 'INITIALIZING...', {
            fontSize: '24px',
            color: '#44ddff',
            fontFamily: 'Segoe UI, Roboto, sans-serif',
        });
        loadingText.setOrigin(0.5);

        // Simulate brief load time for visual effect
        this.time.delayedCall(500, () => {
            this.scene.start('MenuScene');
        });
    }

    create(): void {
        // Transition handled in preload
    }
}
