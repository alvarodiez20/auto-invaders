/**
 * Auto-Play Bot for Auto Invaders
 * 
 * This bot simulates human gameplay with realistic behavior including:
 * - Random clicking to fire (before auto-fire is unlocked)
 * - Opening/closing shop
 * - Buying upgrades
 * - Pausing and resuming
 * - Occasional page reloads
 * 
 * HOW TO USE:
 * 1. Open the game: npm run dev → http://localhost:5173
 * 2. Click "New Game" to start
 * 3. Open browser console (F12 → Console)
 * 4. Paste this entire file
 * 5. Run: startBot() to start, stopBot() to stop
 * 
 * CONFIG:
 * - bot.config.clickRate: clicks per second (default 5)
 * - bot.config.shopCheckInterval: ms between shop checks (default 8000)
 * - bot.config.pauseChance: chance to pause per minute (default 0.05)
 * - bot.config.reloadChance: chance to reload per 5 minutes (default 0.1)
 */

(function () {
    'use strict';

    const bot = {
        running: false,
        intervals: [],
        timeouts: [],
        startTime: null,
        actions: [],

        config: {
            clickRate: 5,              // Clicks per second for manual fire
            shopCheckInterval: 8000,   // Check shop every 8 seconds
            pauseChance: 0.05,         // 5% chance to pause per check
            pauseDuration: [2000, 8000], // Pause for 2-8 seconds
            reloadChance: 0.02,        // 2% chance to reload per check
            verboseLogging: true,      // Log all actions
            autoStart: false,          // Auto-start new game if on menu
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

    function getGameCanvas() {
        return document.querySelector('#game-container canvas');
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
    // ACTIONS
    // =========================================================================

    function clickCanvas() {
        const canvas = getGameCanvas();
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + randomBetween(-100, 100);
        const y = rect.top + rect.height * 0.7 + randomBetween(-50, 50);

        const event = new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: x,
            clientY: y,
            button: 0
        });
        canvas.dispatchEvent(event);

        const upEvent = new MouseEvent('pointerup', {
            bubbles: true,
            clientX: x,
            clientY: y,
            button: 0
        });
        canvas.dispatchEvent(upEvent);
    }

    function pressKey(key) {
        const event = new KeyboardEvent('keydown', {
            key: key,
            code: `Key${key.toUpperCase()}`,
            bubbles: true
        });
        document.dispatchEvent(event);

        setTimeout(() => {
            const upEvent = new KeyboardEvent('keyup', {
                key: key,
                code: `Key${key.toUpperCase()}`,
                bubbles: true
            });
            document.dispatchEvent(upEvent);
        }, 50);
    }

    function openShop() {
        if (!isShopOpen()) {
            pressKey('e');
            log('Opened shop', 'action');
        }
    }

    function closeShop() {
        if (isShopOpen()) {
            pressKey('e');
            log('Closed shop', 'action');
        }
    }

    function togglePause() {
        pressKey('Escape');
        log('Toggled pause', 'action');
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
        const items = document.querySelectorAll('.upgrade-item.affordable');
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
        const recommended = document.querySelector('.upgrade-item.recommended');
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

    function manualFireLoop() {
        if (!bot.running) return;
        if (isOnMenu() || isGamePaused() || isGameOver() || isShopOpen()) return;

        clickCanvas();
    }

    function shopCheckLoop() {
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

    function randomEventLoop() {
        if (!bot.running) return;
        if (isOnMenu()) {
            // If on menu and autoStart is on, start new game
            if (bot.config.autoStart) {
                if (clickButton('btn-continue') || clickButton('btn-start')) {
                    log('Started game from menu', 'event');
                }
            }
            return;
        }

        // Handle game over
        if (isGameOver()) {
            log('Game over detected, clicking continue...', 'event');
            clickButton('btn-continue-game');
            return;
        }

        // Random pause
        if (chance(bot.config.pauseChance) && !isGamePaused()) {
            log('Random pause triggered', 'event');
            togglePause();

            const pauseTime = randomBetween(...bot.config.pauseDuration);
            bot.timeouts.push(setTimeout(() => {
                if (isGamePaused()) {
                    clickButton('btn-resume');
                    log(`Resumed after ${pauseTime}ms`, 'event');
                }
            }, pauseTime));
        }

        // Random reload (simulates user closing/reopening)
        if (chance(bot.config.reloadChance)) {
            log('Random reload triggered!', 'event');
            stopBot();
            setTimeout(() => {
                location.reload();
            }, 500);
        }
    }

    function movementLoop() {
        if (!bot.running) return;
        if (isOnMenu() || isGamePaused() || isGameOver() || isShopOpen()) return;

        // Random horizontal movement
        const keys = ['a', 'd'];
        const key = keys[randomBetween(0, 1)];

        pressKey(key);
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

        log('🤖 Bot started!', 'info');
        log(`Config: clickRate=${bot.config.clickRate}, shopCheck=${bot.config.shopCheckInterval}ms`, 'info');

        // Start loops
        const clickInterval = 1000 / bot.config.clickRate;
        bot.intervals.push(setInterval(manualFireLoop, clickInterval));
        bot.intervals.push(setInterval(shopCheckLoop, bot.config.shopCheckInterval));
        bot.intervals.push(setInterval(randomEventLoop, 5000));
        bot.intervals.push(setInterval(movementLoop, 500));

        // Auto-stop after duration
        const stopTime = bot.config.runDurationMinutes * 60 * 1000;
        bot.timeouts.push(setTimeout(() => {
            log(`Auto-stopping after ${bot.config.runDurationMinutes} minutes`, 'info');
            stopBot();
        }, stopTime));

        // Status report every minute
        bot.intervals.push(setInterval(() => {
            const runtime = Math.floor((Date.now() - bot.startTime) / 1000);
            log(`Status: ${runtime}s runtime, ${bot.actions.length} actions`, 'info');
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
        return {
            running: bot.running,
            runtime: bot.startTime ? Math.floor((Date.now() - bot.startTime) / 1000) : 0,
            actionsCount: bot.actions.length,
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

    // =========================================================================
    // QUICK START COMMAND
    // =========================================================================

    window.autoPlay = function (minutes = 10) {
        bot.config.runDurationMinutes = minutes;
        bot.config.autoStart = true;
        log(`Auto-play mode: will run for ${minutes} minutes with auto-start`, 'info');
        startBot();
    };

    // Log instructions
    console.log('%c🤖 Auto-Play Bot loaded!', 'color: #44ff88; font-size: 16px');
    console.log('%cCommands:', 'color: #44ddff');
    console.log('  startBot()     - Start the bot');
    console.log('  stopBot()      - Stop the bot');
    console.log('  autoPlay(10)   - Auto-start and run for 10 minutes');
    console.log('  getBotStatus() - Get current status');
    console.log('  getBotLog()    - Get action log');
    console.log('  botConfig({...}) - Update config');

})();
