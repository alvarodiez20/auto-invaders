/**
 * Auto-Play Bot for Auto Invaders (IMPROVED VERSION)
 * 
 * This bot actually plays the game by directly interacting with Phaser internals.
 * 
 * HOW TO USE:
 * 1. Open the game: http://localhost:5173
 * 2. Click "New Game" to start
 * 3. Open browser console (F12 → Console)
 * 4. Paste this entire file
 * 5. Run: autoPlay(5) to run for 5 minutes
 * 
 * Commands:
 * - autoPlay(10)   - Auto-start and run for 10 minutes
 * - startBot()     - Start the bot
 * - stopBot()      - Stop the bot
 * - getBotStatus() - Get status
 * - getBotLog()    - Get action log
 */

(function () {
    'use strict';

    const bot = {
        running: false,
        intervals: [],
        timeouts: [],
        startTime: null,
        actions: [],
        game: null,
        gameScene: null,

        config: {
            fireRate: 10,              // Shots per second
            shopCheckInterval: 5000,   // Check shop every 5 seconds
            pauseChance: 0.02,         // 2% chance to pause per check
            pauseDuration: [1000, 3000], // Pause for 1-3 seconds
            reloadChance: 0.01,        // 1% chance to reload per check
            verboseLogging: true,      // Log all actions
            autoStart: true,           // Auto-start new game if on menu
            runDurationMinutes: 30,    // Max runtime before auto-stop
        },
    };

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    function log(msg, type = 'info') {
        if (!bot.config.verboseLogging && type === 'action') return;

        const colors = {
            info: 'color: #44ddff',
            action: 'color: #44ff88',
            warn: 'color: #ffdd44',
            error: 'color: #ff4466',
            event: 'color: #aa66ff'
        };
        const timestamp = new Date().toLocaleTimeString();
        console.log(`%c[${timestamp}] [BOT] ${msg}`, colors[type] || 'color: white');
        bot.actions.push({ time: timestamp, msg, type });
    }

    function randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function chance(probability) {
        return Math.random() < probability;
    }

    function getGame() {
        if (bot.game) return bot.game;

        // Try to get Phaser game instance
        const canvas = document.querySelector('#game-container canvas');
        if (canvas && canvas.game) {
            bot.game = canvas.game;
            return bot.game;
        }

        // Try global Phaser
        if (window.Phaser && window.Phaser.game) {
            bot.game = window.Phaser.game;
            return bot.game;
        }

        return null;
    }

    function getGameScene() {
        if (bot.gameScene) return bot.gameScene;

        const game = getGame();
        if (!game) return null;

        // Find GameScene
        const scenes = game.scene.scenes;
        for (let scene of scenes) {
            if (scene.scene.key === 'GameScene' && scene.scene.isActive()) {
                bot.gameScene = scene;
                return scene;
            }
        }

        return null;
    }

    function isOnMenu() {
        const menu = document.getElementById('menu-overlay');
        return menu && !menu.classList.contains('hidden');
    }

    function isGamePaused() {
        return !!document.getElementById('pause-overlay');
    }

    function isShopOpen() {
        const shop = document.getElementById('shop-container');
        return shop && !shop.classList.contains('hidden');
    }

    function isGameOver() {
        return !!document.getElementById('gameover-overlay');
    }

    // =========================================================================
    // GAME ACTIONS (Direct Phaser interaction)
    // =========================================================================

    function shootAtEnemy() {
        const scene = getGameScene();
        if (!scene) return false;

        try {
            // Find an enemy
            const enemies = scene.enemies?.getChildren();
            if (!enemies || enemies.length === 0) return false;

            // Get a random active enemy
            const activeEnemies = enemies.filter(e => e.active);
            if (activeEnemies.length === 0) return false;

            const target = activeEnemies[randomBetween(0, activeEnemies.length - 1)];

            // Simulate click near enemy position
            const canvas = document.querySelector('#game-container canvas');
            if (!canvas) return false;

            const rect = canvas.getBoundingClientRect();
            const x = rect.left + (target.x * rect.width / 800);
            const y = rect.top + (target.y * rect.height / 600);

            // Create and dispatch pointer event
            const event = new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                button: 0
            });
            canvas.dispatchEvent(event);

            setTimeout(() => {
                const upEvent = new PointerEvent('pointerup', {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    button: 0
                });
                canvas.dispatchEvent(upEvent);
            }, 10);

            return true;
        } catch (e) {
            log(`Error shooting: ${e.message}`, 'error');
            return false;
        }
    }

    function fireShot() {
        const canvas = document.querySelector('#game-container canvas');
        if (!canvas) return false;

        const rect = canvas.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + randomBetween(-50, 50);
        const y = rect.top + rect.height * 0.7;

        const event = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: 0
        });
        canvas.dispatchEvent(event);

        setTimeout(() => {
            const upEvent = new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                button: 0
            });
            canvas.dispatchEvent(upEvent);
        }, 10);

        return true;
    }

    function movePlayer(direction) {
        const scene = getGameScene();
        if (!scene || !scene.player) return false;

        try {
            // Simulate key press
            const keyCode = direction === 'left' ? 'KeyA' : 'KeyD';
            const key = direction === 'left' ? 'a' : 'd';

            const game = getGame();
            if (game && game.input && game.input.keyboard) {
                // Trigger keyboard event on the game
                const event = new KeyboardEvent('keydown', {
                    key: key,
                    code: keyCode,
                    keyCode: direction === 'left' ? 65 : 68,
                    bubbles: true
                });
                document.dispatchEvent(event);

                setTimeout(() => {
                    const upEvent = new KeyboardEvent('keyup', {
                        key: key,
                        code: keyCode,
                        keyCode: direction === 'left' ? 65 : 68,
                        bubbles: true
                    });
                    document.dispatchEvent(upEvent);
                }, 100);
            }

            return true;
        } catch (e) {
            log(`Error moving: ${e.message}`, 'error');
            return false;
        }
    }

    function openShop() {
        if (!isShopOpen()) {
            const event = new KeyboardEvent('keydown', {
                key: 'e',
                code: 'KeyE',
                keyCode: 69,
                bubbles: true
            });
            document.dispatchEvent(event);
            log('Opened shop', 'action');
            return true;
        }
        return false;
    }

    function closeShop() {
        if (isShopOpen()) {
            const event = new KeyboardEvent('keydown', {
                key: 'e',
                code: 'KeyE',
                keyCode: 69,
                bubbles: true
            });
            document.dispatchEvent(event);
            log('Closed shop', 'action');
            return true;
        }
        return false;
    }

    function clickButton(id) {
        const btn = document.getElementById(id);
        if (btn && !btn.disabled) {
            btn.click();
            log(`Clicked button: ${id}`, 'action');
            return true;
        }
        return false;
    }

    function buyUpgrade() {
        // Find affordable upgrade
        const items = document.querySelectorAll('.upgrade-item.affordable:not(.locked)');
        if (items.length > 0) {
            const item = items[randomBetween(0, items.length - 1)];
            item.click();
            const name = item.querySelector('.upgrade-name')?.textContent || 'Unknown';
            log(`Bought upgrade: ${name}`, 'event');
            return true;
        }
        return false;
    }

    function buyRecommendedUpgrade() {
        const recommended = document.querySelector('.upgrade-item.recommended:not(.locked)');
        if (recommended) {
            recommended.click();
            const name = recommended.querySelector('.upgrade-name')?.textContent || 'Unknown';
            log(`Bought recommended: ${name}`, 'event');
            return true;
        }
        return false;
    }

    // =========================================================================
    // BOT BEHAVIORS
    // =========================================================================

    function combatLoop() {
        if (!bot.running) return;
        if (isOnMenu() || isGamePaused() || isGameOver() || isShopOpen()) return;

        // Try to shoot at enemies
        if (!shootAtEnemy()) {
            // If no enemy targeted, just fire
            fireShot();
        }
    }

    function movementLoop() {
        if (!bot.running) return;
        if (isOnMenu() || isGamePaused() || isGameOver() || isShopOpen()) return;

        const scene = getGameScene();
        if (!scene || !scene.player) return;

        try {
            // Get player and enemy positions
            const playerX = scene.player.x;
            const enemies = scene.enemies?.getChildren().filter(e => e.active);

            if (enemies && enemies.length > 0) {
                // Find closest enemy
                let closestEnemy = null;
                let closestDist = Infinity;

                enemies.forEach(e => {
                    const dist = Math.abs(e.x - playerX);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEnemy = e;
                    }
                });

                if (closestEnemy) {
                    // Move towards enemy
                    if (closestEnemy.x < playerX - 30) {
                        movePlayer('left');
                    } else if (closestEnemy.x > playerX + 30) {
                        movePlayer('right');
                    }
                }
            } else {
                // Random movement
                if (chance(0.3)) {
                    movePlayer(chance(0.5) ? 'left' : 'right');
                }
            }
        } catch (e) {
            log(`Movement error: ${e.message}`, 'error');
        }
    }

    function shopLoop() {
        if (!bot.running) return;
        if (isOnMenu() || isGamePaused() || isGameOver()) return;

        log('Checking shop...', 'action');
        openShop();

        // Wait for shop to open, then buy
        bot.timeouts.push(setTimeout(() => {
            if (isShopOpen()) {
                // Try to buy recommended first, then any affordable
                if (!buyRecommendedUpgrade()) {
                    buyUpgrade();
                }

                // Close shop after purchase
                bot.timeouts.push(setTimeout(() => {
                    closeShop();
                }, 500));
            }
        }, 300));
    }

    function menuAndEventLoop() {
        if (!bot.running) return;

        if (isOnMenu()) {
            // If on menu and autoStart is on, start new game
            if (bot.config.autoStart) {
                if (clickButton('btn-continue') || clickButton('btn-start')) {
                    log('Started game from menu', 'event');
                    // Reset cached scene reference
                    bot.gameScene = null;
                }
            }
            return;
        }

        // Handle game over
        if (isGameOver()) {
            log('Game over detected, clicking continue...', 'event');
            clickButton('btn-continue-game');
            bot.gameScene = null; // Reset scene reference
            return;
        }

        // Random pause
        if (chance(bot.config.pauseChance / 10) && !isGamePaused()) {
            log('Random pause triggered', 'event');
            const event = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                bubbles: true
            });
            document.dispatchEvent(event);

            const pauseTime = randomBetween(...bot.config.pauseDuration);
            bot.timeouts.push(setTimeout(() => {
                if (isGamePaused()) {
                    clickButton('btn-resume');
                    log(`Resumed after ${pauseTime}ms`, 'event');
                }
            }, pauseTime));
        }
    }

    // =========================================================================
    // BOT CONTROL
    // =========================================================================

    window.startBot = function (config = {}) {
        if (bot.running) {
            log('Bot is already running!', 'warn');
            return;
        }

        // Merge config
        Object.assign(bot.config, config);

        bot.running = true;
        bot.startTime = Date.now();
        bot.actions = [];
        bot.game = null;
        bot.gameScene = null;

        log('🤖 Bot started!', 'info');
        log(`Config: fireRate=${bot.config.fireRate}/s, shopCheck=${bot.config.shopCheckInterval}ms`, 'info');

        // Start loops with different intervals
        const fireInterval = 1000 / bot.config.fireRate;
        bot.intervals.push(setInterval(combatLoop, fireInterval));
        bot.intervals.push(setInterval(movementLoop, 200)); // Move 5 times per second
        bot.intervals.push(setInterval(shopLoop, bot.config.shopCheckInterval));
        bot.intervals.push(setInterval(menuAndEventLoop, 1000)); // Check every second

        // Auto-stop after duration
        const stopTime = bot.config.runDurationMinutes * 60 * 1000;
        bot.timeouts.push(setTimeout(() => {
            log(`Auto-stopping after ${bot.config.runDurationMinutes} minutes`, 'info');
            stopBot();
        }, stopTime));

        // Status report every minute
        bot.intervals.push(setInterval(() => {
            const runtime = Math.floor((Date.now() - bot.startTime) / 1000);
            const scene = getGameScene();
            const enemyCount = scene?.enemies?.getChildren().filter(e => e.active).length || 0;
            log(`Status: ${runtime}s runtime, ${enemyCount} enemies, ${bot.actions.length} actions`, 'info');
        }, 60000));
    };

    window.stopBot = function () {
        if (!bot.running) {
            log('Bot is not running', 'warn');
            return;
        }

        bot.running = false;

        // Clear all intervals and timeouts
        bot.intervals.forEach(id => clearInterval(id));
        bot.timeouts.forEach(id => clearTimeout(id));
        bot.intervals = [];
        bot.timeouts = [];

        const runtime = Math.floor((Date.now() - bot.startTime) / 1000);
        log(`🛑 Bot stopped! Runtime: ${runtime}s, Actions: ${bot.actions.length}`, 'info');
    };

    window.getBotStatus = function () {
        const scene = getGameScene();
        return {
            running: bot.running,
            runtime: bot.startTime ? Math.floor((Date.now() - bot.startTime) / 1000) : 0,
            actionsCount: bot.actions.length,
            hasGameAccess: !!getGame(),
            hasSceneAccess: !!scene,
            enemyCount: scene?.enemies?.getChildren().filter(e => e.active).length || 0,
            config: bot.config,
        };
    };

    window.getBotLog = function () {
        return bot.actions;
    };

    window.botConfig = function (newConfig) {
        Object.assign(bot.config, newConfig);
        log(`Config updated: ${JSON.stringify(newConfig)}`, 'info');
    };

    window.autoPlay = function (minutes = 10) {
        bot.config.runDurationMinutes = minutes;
        bot.config.autoStart = true;
        log(`Auto-play mode: will run for ${minutes} minutes with auto-start`, 'info');
        startBot();
    };

    // Log instructions
    console.log('%c🤖 Auto-Play Bot v2 loaded!', 'color: #44ff88; font-size: 16px');
    console.log('%cIMPROVED: Now actually shoots and moves!', 'color: #ffdd44');
    console.log('%cCommands:', 'color: #44ddff');
    console.log('  autoPlay(10)   - Auto-start and run for 10 minutes');
    console.log('  startBot()     - Start the bot');
    console.log('  stopBot()      - Stop the bot');
    console.log('  getBotStatus() - Get current status');
    console.log('  getBotLog()    - Get action log');
    console.log('  botConfig({...}) - Update config');

})();
