/**
 * Auto-Play Bot for Auto Invaders v5 - DIRECT METHOD CALLS
 * 
 * This bot plays by directly calling game methods (not synthetic events).
 * 
 * Usage:
 * 1. Start the game, open console (F12)
 * 2. fetch('/auto-invaders/tests/auto-play-bot.js').then(r=>r.text()).then(eval)
 * 3. autoPlay(5) to run for 5 minutes
 */

(function () {
    'use strict';

    const bot = {
        running: false,
        intervals: [],
        timeouts: [],
        startTime: null,
        actions: [],
        lastScrap: 0,
        stats: {
            shotsAttempted: 0,
            enemiesKilled: 0,
            upgradesBought: 0,
            wavesSeen: 0,
            deaths: 0
        },
        config: {
            fireRate: 15,              // Shots per second
            moveCheckInterval: 50,     // Movement updates (ms)
            shopCheckInterval: 5000,    // Shop check every 5 seconds
            verboseLogging: true,
            autoStart: true,
            runDurationMinutes: 30,
        },
    };

    // ==========================================================================
    // LOGGING
    // ==========================================================================

    function log(msg, type = 'info') {
        if (!bot.config.verboseLogging && type === 'action') return;

        const colors = {
            info: 'color: #44ddff',
            action: 'color: #44ff88',
            warn: 'color: #ffdd44',
            error: 'color: #ff4466',
            event: 'color: #aa66ff',
            kill: 'color: #ff88ff'
        };
        const timestamp = new Date().toLocaleTimeString();
        console.log(`%c[${timestamp}] [BOT] ${msg}`, colors[type] || 'color: white');
        bot.actions.push({ time: Date.now(), msg, type });

        if (bot.actions.length > 500) bot.actions = bot.actions.slice(-250);
    }

    // ==========================================================================
    // GAME ACCESS
    // ==========================================================================

    function getGame() {
        return window.game || null;
    }

    function getGameScene() {
        const game = getGame();
        if (!game?.scene) return null;
        return game.scene.scenes.find(s => s.scene?.key === 'GameScene' && s.scene.isActive()) || null;
    }

    function getPlayer() {
        return getGameScene()?.player || null;
    }

    function getEnemies() {
        const scene = getGameScene();
        if (!scene?.enemies) return [];
        return scene.enemies.getChildren().filter(e => e.active);
    }

    // ==========================================================================
    // UI STATE
    // ==========================================================================

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

    function canPlay() {
        return !isOnMenu() && !isGamePaused() && !isGameOver() && !isShopOpen();
    }

    // ==========================================================================
    // BUTTON CLICKS
    // ==========================================================================

    function clickButton(id) {
        const btn = document.getElementById(id);
        if (btn && !btn.disabled) {
            btn.click();
            return true;
        }
        return false;
    }

    function pressKey(key, code, keyCode) {
        const down = new KeyboardEvent('keydown', {
            key, code, keyCode,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(down);
        setTimeout(() => {
            const up = new KeyboardEvent('keyup', {
                key, code, keyCode,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(up);
        }, 30);
    }

    // ==========================================================================
    // COMBAT - DIRECT METHOD CALLS
    // ==========================================================================

    function shoot() {
        if (!canPlay()) return;

        const scene = getGameScene();
        if (!scene) return;

        // Directly call the scene's firing method (bypassing input events)
        try {
            // The scene has a private firePlayerBullet method, but we can access tryManualFire
            // or simulate what happens when clicking - check if scene has these methods

            // Try calling internal methods directly
            if (typeof scene.firePlayerBullet === 'function') {
                scene.firePlayerBullet();
                bot.stats.shotsAttempted++;
                return;
            }

            // Alternative: simulate the input pointer for Phaser
            // Phaser's input manager needs to process the event properly
            const pointer = scene.input.activePointer;
            if (pointer) {
                // Manually trigger the pointerdown handler
                pointer.isDown = true;
                pointer.x = scene.player?.x || 400;
                pointer.y = 300;

                // Emit the event on Phaser's input system
                scene.input.emit('pointerdown', pointer);

                bot.stats.shotsAttempted++;

                // Reset pointer state
                setTimeout(() => {
                    pointer.isDown = false;
                    scene.input.emit('pointerup', pointer);
                }, 10);
            }
        } catch (e) {
            // Fallback: try space key for manual fire
            pressKey(' ', 'Space', 32);
            bot.stats.shotsAttempted++;
        }
    }

    // ==========================================================================
    // MOVEMENT - Direct position updates via keyboard
    // ==========================================================================

    let moveDir = null;

    function setMove(dir) {
        if (dir === moveDir) return;

        // Release current key
        if (moveDir) {
            const k = moveDir === 'left' ? 'a' : 'd';
            const c = moveDir === 'left' ? 'KeyA' : 'KeyD';
            const kc = moveDir === 'left' ? 65 : 68;
            document.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: c, keyCode: kc, bubbles: true }));
        }

        moveDir = dir;

        // Press new key
        if (dir) {
            const k = dir === 'left' ? 'a' : 'd';
            const c = dir === 'left' ? 'KeyA' : 'KeyD';
            const kc = dir === 'left' ? 65 : 68;
            document.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c, keyCode: kc, bubbles: true }));
        }
    }

    function moveToTarget() {
        if (!canPlay()) {
            setMove(null);
            return;
        }

        const player = getPlayer();
        if (!player) {
            setMove(null);
            return;
        }

        const enemies = getEnemies();

        if (enemies.length === 0) {
            // No enemies, stay centered
            if (player.x < 380) setMove('right');
            else if (player.x > 420) setMove('left');
            else setMove(null);
            return;
        }

        // Find best target (closest to bottom = most dangerous)
        let bestEnemy = null;
        let bestY = -Infinity;
        for (const e of enemies) {
            if (e.y > bestY) {
                bestY = e.y;
                bestEnemy = e;
            }
        }

        if (!bestEnemy) {
            setMove(null);
            return;
        }

        // Move under target
        const tol = 20;
        if (bestEnemy.x < player.x - tol) setMove('left');
        else if (bestEnemy.x > player.x + tol) setMove('right');
        else setMove(null);
    }

    // ==========================================================================
    // KILL TRACKING via Scrap
    // ==========================================================================

    function trackProgress() {
        const scrapEl = document.getElementById('hud-scrap');
        const currentScrap = parseInt(scrapEl?.textContent?.replace(/,/g, '') || '0');

        if (currentScrap > bot.lastScrap) {
            const gained = currentScrap - bot.lastScrap;
            bot.stats.enemiesKilled += Math.ceil(gained / 10); // Rough estimate
            log(`Scrap gained: +${gained} (total kills: ~${bot.stats.enemiesKilled})`, 'kill');
        }

        bot.lastScrap = currentScrap;
    }

    // ==========================================================================
    // SHOP - Improved purchasing
    // ==========================================================================

    const SHOP_TABS = ['core', 'weapons', 'autopilot', 'drones', 'economy', 'survival'];
    let currentTabIndex = 0;

    function handleShop() {
        if (!bot.running || !canPlay()) return;

        const scrapEl = document.getElementById('hud-scrap');
        const scrap = parseInt(scrapEl?.textContent?.replace(/,/g, '') || '0');

        // Check if shop is open (sidebar visible)
        if (!isShopOpen()) {
            if (scrap >= 25) {
                log(`Opening shop (${scrap} scrap)...`, 'action');
                pressKey('e', 'KeyE', 69); // Open sidebar
            }
        }

        // If open (or opening), try to buy
        if (isShopOpen() || scrap >= 25) {
            bot.timeouts.push(setTimeout(() => {
                if (isShopOpen()) {
                    buyAllAffordable();
                }
            }, 300));
        }
    }

    function buyAllAffordable() {
        let totalBought = 0;

        // Try all tabs to find affordable upgrades
        for (let t = 0; t < SHOP_TABS.length && totalBought < 10; t++) {
            const tabName = SHOP_TABS[(currentTabIndex + t) % SHOP_TABS.length];
            const tab = document.querySelector(`.shop-tab[data-tab="${tabName}"]`);

            if (tab) {
                tab.click(); // Switch to this tab

                // Small delay for tab content to render
                const items = document.querySelectorAll('.upgrade-item.affordable:not(.locked):not(.maxed)');
                const recommended = document.querySelector('.upgrade-item.recommended.affordable:not(.locked):not(.maxed)');

                // Buy recommended first, then others
                const targets = recommended ? [recommended, ...Array.from(items).filter(i => i !== recommended)] : Array.from(items);

                for (const target of targets) {
                    if (totalBought >= 10) break;

                    target.click();
                    const name = target.querySelector('.upgrade-name')?.textContent || 'upgrade';
                    log(`Bought: ${name}`, 'event');
                    bot.stats.upgradesBought++;
                    totalBought++;
                }

                if (totalBought > 0) {
                    // Stay on this tab for next time if we found stuff
                    currentTabIndex = (currentTabIndex + t) % SHOP_TABS.length;
                    break;
                }
            }
        }
    }

    // ==========================================================================
    // STATE MANAGEMENT
    // ==========================================================================

    function handleMenuAndEvents() {
        if (!bot.running) return;

        if (isOnMenu()) {
            if (bot.config.autoStart) {
                if (clickButton('btn-continue') || clickButton('btn-start')) {
                    log('Started game', 'event');
                }
            }
            return;
        }

        if (isGameOver()) {
            log('Game over - continuing', 'event');
            bot.stats.deaths++;
            clickButton('btn-continue-game');
            return;
        }

        if (isGamePaused()) {
            clickButton('btn-resume');
        }
    }

    function trackWave() {
        const scene = getGameScene();
        if (scene?.waveManager) {
            try {
                const info = scene.waveManager.getCurrentWaveInfo();
                const key = `${info.sector}-${info.wave}`;
                if (bot._lastWave !== key) {
                    bot._lastWave = key;
                    bot.stats.wavesSeen++;
                    log(`Wave: ${info.wave}/10, ${info.sectorName}`, 'event');
                }
            } catch (e) { }
        }
    }

    // ==========================================================================
    // BOT CONTROL
    // ==========================================================================

    window.startBot = function (config = {}) {
        if (bot.running) {
            log('Already running!', 'warn');
            return;
        }

        const game = getGame();
        if (!game) {
            log('ERROR: No game found!', 'error');
            return;
        }

        Object.assign(bot.config, config);

        bot.running = true;
        bot.startTime = Date.now();
        bot.actions = [];
        bot.stats = { shotsAttempted: 0, enemiesKilled: 0, upgradesBought: 0, wavesSeen: 0, deaths: 0 };
        bot._lastWave = null;
        bot.lastScrap = 0;

        const scene = getGameScene();
        log('🤖 Bot v5 started!', 'info');
        log(`Game: YES, Scene: ${scene ? 'YES' : 'NO'}, Player: ${scene?.player ? 'YES' : 'NO'}`, 'info');

        // Check if firePlayerBullet is accessible
        if (scene && typeof scene.firePlayerBullet === 'function') {
            log('Direct fire method: AVAILABLE', 'info');
        } else {
            log('Direct fire method: NOT AVAILABLE - using input simulation', 'warn');
        }

        // Combat loop
        const fireInterval = Math.floor(1000 / bot.config.fireRate);
        bot.intervals.push(setInterval(shoot, fireInterval));

        // Movement loop
        bot.intervals.push(setInterval(moveToTarget, bot.config.moveCheckInterval));

        // Progress tracking
        bot.intervals.push(setInterval(trackProgress, 500));

        // Shop
        bot.intervals.push(setInterval(handleShop, bot.config.shopCheckInterval));

        // State management
        bot.intervals.push(setInterval(handleMenuAndEvents, 500));

        // Wave tracking
        bot.intervals.push(setInterval(trackWave, 2000));

        // Status log every 15 seconds
        bot.intervals.push(setInterval(() => {
            const runtime = Math.floor((Date.now() - bot.startTime) / 1000);
            const player = getPlayer();
            const enemies = getEnemies().length;
            const scrapEl = document.getElementById('hud-scrap');

            log(`[${runtime}s] HP: ${player?.currentHP || 0}/${player?.maxHP || 100}, ` +
                `Enemies: ${enemies}, Shots: ${bot.stats.shotsAttempted}, ` +
                `Kills: ~${bot.stats.enemiesKilled}, Scrap: ${scrapEl?.textContent || '0'}`, 'info');
        }, 15000));

        // Auto-stop
        bot.timeouts.push(setTimeout(() => {
            log(`Auto-stop after ${bot.config.runDurationMinutes}m`, 'warn');
            stopBot();
        }, bot.config.runDurationMinutes * 60 * 1000));
    };

    window.stopBot = function () {
        if (!bot.running) {
            log('Not running', 'warn');
            return;
        }

        bot.running = false;
        setMove(null);

        bot.intervals.forEach(id => clearInterval(id));
        bot.timeouts.forEach(id => clearTimeout(id));
        bot.intervals = [];
        bot.timeouts = [];

        const runtime = Math.floor((Date.now() - bot.startTime) / 1000);
        log(`🛑 Stopped! Runtime: ${runtime}s, Kills: ~${bot.stats.enemiesKilled}, Deaths: ${bot.stats.deaths}`, 'info');
    };

    window.getBotStatus = function () {
        const scene = getGameScene();
        const player = getPlayer();
        const scrapEl = document.getElementById('hud-scrap');

        return {
            running: bot.running,
            runtime: bot.startTime ? Math.floor((Date.now() - bot.startTime) / 1000) : 0,
            hasGameAccess: !!getGame(),
            hasSceneAccess: !!scene,
            hasPlayerAccess: !!player,
            canFireDirect: scene && typeof scene.firePlayerBullet === 'function',
            enemyCount: getEnemies().length,
            playerHP: player?.currentHP || 0,
            scrap: scrapEl?.textContent || '0',
            stats: { ...bot.stats }
        };
    };

    window.getBotLog = function (count = 50) {
        return bot.actions.slice(-count);
    };

    window.autoPlay = function (minutes = 10) {
        bot.config.runDurationMinutes = minutes;
        log(`🎮 Auto-play: ${minutes} minutes`, 'info');
        startBot();
    };

    // Startup
    console.log('%c🤖 Auto-Play Bot v5 loaded!', 'color: #44ff88; font-size: 16px; font-weight: bold');
    console.log('%cDirect method calls + Phaser input simulation', 'color: #ffdd44');
    console.log('  autoPlay(5) - Run 5 minutes');
    console.log('  stopBot()   - Stop');
    console.log('  getBotStatus() - Status');

    const scene = getGameScene();
    if (scene) {
        console.log('%c✅ Game ready' + (typeof scene.firePlayerBullet === 'function' ? ' (direct fire)' : ''), 'color:#44ff88');
    } else {
        console.log('%c⚠️ Start a game first', 'color:#ffdd44');
    }

})();
