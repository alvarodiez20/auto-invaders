/**
 * Browser-based Test Suite for Auto Invaders
 * 
 * HOW TO USE:
 * 1. Open the game in browser: http://localhost:5173
 * 2. Open browser console (F12 -> Console)
 * 3. Copy and paste this entire file into the console
 * 4. Run: runTests()
 * 
 * Or run individual tests:
 *   testSaveManager()
 *   testMenuFlow()
 *   testGameFlow()
 */

(function () {
    const results = [];

    function log(msg, type = 'info') {
        const colors = {
            pass: 'color: #44ff88',
            fail: 'color: #ff4466',
            info: 'color: #44ddff',
            warn: 'color: #ffdd44'
        };
        console.log(`%c${msg}`, colors[type] || 'color: white');
    }

    function assert(condition, message) {
        if (!condition) throw new Error(message);
        return true;
    }

    // =========================================================================
    // SAVE MANAGER TESTS
    // =========================================================================
    window.testSaveManager = function () {
        log('\n=== SAVE MANAGER TESTS ===', 'info');

        try {
            // Test 1: Reset creates fresh save
            localStorage.removeItem('autoInvaders_save');
            SaveManager.reset();
            const save1 = SaveManager.getCurrent();
            assert(save1.scrap === 0, 'Scrap should be 0');
            assert(save1.currentWave === 1, 'Wave should be 1');
            log('✅ Reset creates fresh save', 'pass');

            // Test 2: addScrap works
            SaveManager.addScrap(100);
            assert(SaveManager.getCurrent().scrap === 100, 'Scrap should be 100');
            log('✅ addScrap works', 'pass');

            // Test 3: save persists to localStorage
            SaveManager.save(SaveManager.getCurrent());
            const stored = localStorage.getItem('autoInvaders_save');
            assert(stored !== null, 'Should have localStorage data');
            log('✅ save persists to localStorage', 'pass');

            // Test 4: hasSave returns true after save
            assert(SaveManager.hasSave() === true, 'hasSave should return true');
            log('✅ hasSave works', 'pass');

            // Test 5: load restores data
            SaveManager.addScrap(50); // Now at 150
            SaveManager.save(SaveManager.getCurrent());
            const loaded = SaveManager.load();
            assert(loaded.scrap === 150, 'Loaded scrap should be 150');
            log('✅ load restores data', 'pass');

            // Test 6: export/import works
            SaveManager.update({ currentWave: 5, currentSector: 2 });
            SaveManager.save(SaveManager.getCurrent());
            const exported = SaveManager.exportSave();

            SaveManager.reset(); // Clear state
            const importResult = SaveManager.importSave(exported);
            assert(importResult === true, 'Import should succeed');
            assert(SaveManager.getCurrent().currentWave === 5, 'Wave should be 5 after import');
            log('✅ export/import works', 'pass');

            // Test 7: Upgrade system
            SaveManager.reset();
            assert(!SaveManager.hasUpgrade('autoFire'), 'Should not have autoFire');
            SaveManager.addUpgradeLevel('autoFire');
            assert(SaveManager.hasUpgrade('autoFire'), 'Should have autoFire after adding');
            log('✅ Upgrade system works', 'pass');

            log('\n✅ ALL SAVE MANAGER TESTS PASSED', 'pass');
            return true;
        } catch (e) {
            log(`❌ FAILED: ${e.message}`, 'fail');
            return false;
        }
    };

    // =========================================================================
    // MENU FLOW TESTS
    // =========================================================================
    window.testMenuFlow = function () {
        log('\n=== MENU FLOW TESTS ===', 'info');

        try {
            // Test 1: Menu overlay exists
            const menu = document.getElementById('menu-overlay');
            assert(menu !== null, 'Menu overlay should exist');
            log('✅ Menu overlay exists', 'pass');

            // Test 2: Start button exists
            const startBtn = document.getElementById('btn-start');
            assert(startBtn !== null, 'Start button should exist');
            log('✅ Start button exists', 'pass');

            // Test 3: Continue button disabled when no save
            localStorage.removeItem('autoInvaders_save');
            // Note: Would need to reload scene to test this properly
            log('⚠️ Continue button test requires scene reload', 'warn');

            // Test 4: Settings overlay exists
            const settings = document.getElementById('settings-overlay');
            assert(settings !== null, 'Settings overlay should exist');
            log('✅ Settings overlay exists', 'pass');

            log('\n✅ MENU FLOW TESTS PASSED', 'pass');
            return true;
        } catch (e) {
            log(`❌ FAILED: ${e.message}`, 'fail');
            return false;
        }
    };

    // =========================================================================
    // GAME FLOW TESTS (run during gameplay)
    // =========================================================================
    window.testGameFlow = function () {
        log('\n=== GAME FLOW TESTS ===', 'info');

        try {
            // Test 1: HUD exists
            const hud = document.getElementById('hud');
            assert(hud !== null, 'HUD should exist');
            log('✅ HUD exists', 'pass');

            // Test 2: Shop container exists
            const shop = document.getElementById('shop-container');
            assert(shop !== null, 'Shop container should exist');
            log('✅ Shop container exists', 'pass');

            // Test 3: Game scene is active (check for player)
            const canvas = document.querySelector('#game-container canvas');
            assert(canvas !== null, 'Game canvas should exist');
            log('✅ Game canvas exists', 'pass');

            log('\n✅ GAME FLOW TESTS PASSED', 'pass');
            return true;
        } catch (e) {
            log(`❌ FAILED: ${e.message}`, 'fail');
            return false;
        }
    };

    // =========================================================================
    // RUN ALL TESTS
    // =========================================================================
    window.runTests = function () {
        log('\n🧪 AUTO INVADERS TEST SUITE\n', 'info');

        const results = [];
        results.push(['SaveManager', testSaveManager()]);
        results.push(['MenuFlow', testMenuFlow()]);
        results.push(['GameFlow', testGameFlow()]);

        log('\n=====================================', 'info');
        log('RESULTS:', 'info');
        results.forEach(([name, passed]) => {
            log(`  ${passed ? '✅' : '❌'} ${name}`, passed ? 'pass' : 'fail');
        });

        const allPassed = results.every(r => r[1]);
        log(`\n${allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'}`, allPassed ? 'pass' : 'fail');

        return allPassed;
    };

    // Make SaveManager accessible for tests
    if (typeof window.SaveManager === 'undefined') {
        // Try to access from Phaser game
        const game = document.querySelector('#game-container canvas')?.__phaser;
        if (game) {
            log('Note: Access SaveManager via game.scene.scenes[0] if needed', 'warn');
        }
    }

    log('🧪 Test suite loaded! Run: runTests()', 'info');
    log('Or individual tests: testSaveManager(), testMenuFlow(), testGameFlow()', 'info');
})();
