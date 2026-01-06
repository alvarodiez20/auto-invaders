/**
 * Automated Test Suite for Auto Invaders
 * Run with: npx ts-node tests/game-tests.ts
 * Or import in browser console for live testing
 */

// Test utilities
interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    return Promise.resolve(fn())
        .then(() => {
            results.push({ name, passed: true });
            console.log(`✅ ${name}`);
        })
        .catch((error) => {
            results.push({ name, passed: false, error: String(error) });
            console.log(`❌ ${name}: ${error}`);
        });
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

// ============================================================================
// SAVE MANAGER TESTS
// ============================================================================

async function testSaveManagerReset(): Promise<void> {
    const { SaveManager } = await import('../src/systems/SaveManager');

    SaveManager.reset();
    const save = SaveManager.getCurrent();

    assertEqual(save.scrap, 0, 'Scrap should be 0 after reset');
    assertEqual(save.currentWave, 1, 'Wave should be 1 after reset');
    assertEqual(save.currentSector, 0, 'Sector should be 0 after reset');
}

async function testSaveManagerPersistence(): Promise<void> {
    const { SaveManager } = await import('../src/systems/SaveManager');

    // Add some scrap
    SaveManager.addScrap(100);
    SaveManager.save(SaveManager.getCurrent());

    // Verify it's saved
    const saveData = localStorage.getItem('autoInvaders_save');
    assert(saveData !== null, 'Save should exist in localStorage');

    const parsed = JSON.parse(saveData!);
    assertEqual(parsed.scrap, 100, 'Saved scrap should be 100');
}

async function testSaveManagerLoad(): Promise<void> {
    const { SaveManager } = await import('../src/systems/SaveManager');

    // First reset and save
    SaveManager.reset();
    SaveManager.addScrap(250);
    SaveManager.save(SaveManager.getCurrent());

    // Simulate new session by clearing in-memory state
    // @ts-expect-error - Accessing private for testing
    SaveManager.currentSave = { scrap: 0 };

    // Load from localStorage
    const loaded = SaveManager.load();

    assertEqual(loaded.scrap, 250, 'Loaded scrap should be 250');
}

async function testHasSave(): Promise<void> {
    const { SaveManager } = await import('../src/systems/SaveManager');

    // Clear localStorage
    localStorage.removeItem('autoInvaders_save');

    assert(!SaveManager.hasSave(), 'hasSave should return false when no save');

    SaveManager.reset();
    assert(SaveManager.hasSave(), 'hasSave should return true after reset');
}

async function testExportImport(): Promise<void> {
    const { SaveManager } = await import('../src/systems/SaveManager');

    SaveManager.reset();
    SaveManager.addScrap(500);
    SaveManager.update({ currentWave: 5, currentSector: 2 });
    SaveManager.save(SaveManager.getCurrent());

    const exported = SaveManager.exportSave();
    assert(exported.length > 0, 'Export should produce a string');

    // Reset and import
    SaveManager.reset();
    const imported = SaveManager.importSave(exported);

    assert(imported, 'Import should succeed');
    assertEqual(SaveManager.getCurrent().scrap, 500, 'Imported scrap should be 500');
    assertEqual(SaveManager.getCurrent().currentWave, 5, 'Imported wave should be 5');
}

// ============================================================================
// UPGRADE TESTS
// ============================================================================

async function testUpgradePurchase(): Promise<void> {
    const { SaveManager } = await import('../src/systems/SaveManager');

    SaveManager.reset();
    SaveManager.addScrap(200);
    SaveManager.save(SaveManager.getCurrent());

    const hasAutoFire = SaveManager.hasUpgrade('autoFire');
    assert(!hasAutoFire, 'Should not have autoFire before purchase');

    // Simulate purchase
    const cost = 120; // Auto-fire cost
    if (SaveManager.getCurrent().scrap >= cost) {
        SaveManager.spendScrap(cost);
        SaveManager.addUpgradeLevel('autoFire');
        SaveManager.save(SaveManager.getCurrent());
    }

    assert(SaveManager.hasUpgrade('autoFire'), 'Should have autoFire after purchase');
    assertEqual(SaveManager.getCurrent().scrap, 80, 'Should have 80 scrap remaining');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests(): Promise<void> {
    console.log('🧪 Running Auto Invaders Test Suite...\n');

    await test('SaveManager.reset()', testSaveManagerReset);
    await test('SaveManager persistence', testSaveManagerPersistence);
    await test('SaveManager.load()', testSaveManagerLoad);
    await test('SaveManager.hasSave()', testHasSave);
    await test('Export/Import', testExportImport);
    await test('Upgrade purchase', testUpgradePurchase);

    console.log('\n========================================');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`Tests: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        console.log('\nFailures:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  ❌ ${r.name}: ${r.error}`);
        });
    }
}

// Export for browser console usage
if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).runAutoInvadersTests = runAllTests;
}

// Run if executed directly
runAllTests().catch(console.error);
