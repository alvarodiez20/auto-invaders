var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config/GameConfig.ts
var GAME_HEIGHT, PLAYER_Y, SECTOR_COUNT, WAVES_PER_SECTOR, TOTAL_WAVES, SAVE_KEY, MAX_OFFLINE_HOURS;
var init_GameConfig = __esm({
  "src/config/GameConfig.ts"() {
    "use strict";
    GAME_HEIGHT = 600;
    PLAYER_Y = GAME_HEIGHT - 60;
    SECTOR_COUNT = 6;
    WAVES_PER_SECTOR = 12;
    TOTAL_WAVES = SECTOR_COUNT * WAVES_PER_SECTOR;
    SAVE_KEY = "autoInvaders_save";
    MAX_OFFLINE_HOURS = 8;
  }
});

// src/systems/SaveManager.ts
var SaveManager_exports = {};
__export(SaveManager_exports, {
  SaveManager: () => SaveManager
});
var DEFAULT_SETTINGS, DEFAULT_SAVE, SETTINGS_KEY, SaveManager;
var init_SaveManager = __esm({
  "src/systems/SaveManager.ts"() {
    "use strict";
    init_GameConfig();
    DEFAULT_SETTINGS = {
      sound: true,
      soundVolume: 0.5,
      reducedMotion: false,
      uiScale: 1
    };
    DEFAULT_SAVE = {
      scrap: 0,
      cores: 0,
      currentSector: 0,
      currentWave: 1,
      highestSector: 0,
      playerHP: 100,
      playerMaxHP: 100,
      upgrades: {},
      activeWeaponMod: "standard",
      activeBehaviorScript: "balanced",
      activeTargetMode: "closest",
      stats: {
        totalKills: 0,
        totalScrapEarned: 0,
        totalDamageDealt: 0,
        playTime: 0,
        bossesDefeated: 0
      },
      lastSaveTime: Date.now(),
      scrapPerSecond: 0,
      version: 1
    };
    SETTINGS_KEY = "autoInvaders_settings";
    SaveManager = class {
      static currentSave = { ...DEFAULT_SAVE };
      /**
       * Check if a save exists
       */
      static hasSave() {
        return localStorage.getItem(SAVE_KEY) !== null;
      }
      /**
       * Load save from localStorage
       */
      static load() {
        try {
          const data = localStorage.getItem(SAVE_KEY);
          if (data) {
            const parsed = JSON.parse(data);
            this.currentSave = {
              ...DEFAULT_SAVE,
              ...parsed,
              upgrades: { ...DEFAULT_SAVE.upgrades, ...parsed.upgrades },
              stats: { ...DEFAULT_SAVE.stats, ...parsed.stats }
            };
            return this.currentSave;
          }
        } catch (e) {
          console.error("Failed to load save:", e);
        }
        this.currentSave = { ...DEFAULT_SAVE };
        return this.currentSave;
      }
      /**
       * Save to localStorage
       */
      static save(data) {
        try {
          this.currentSave = {
            ...this.currentSave,
            ...data,
            lastSaveTime: Date.now()
          };
          localStorage.setItem(SAVE_KEY, JSON.stringify(this.currentSave));
        } catch (e) {
          console.error("Failed to save:", e);
        }
      }
      /**
       * Get current save (in-memory)
       */
      static getCurrent() {
        return this.currentSave;
      }
      /**
       * Update current save in memory
       */
      static update(data) {
        this.currentSave = { ...this.currentSave, ...data };
      }
      /**
       * Reset to new game
       */
      static reset() {
        this.currentSave = { ...DEFAULT_SAVE, lastSaveTime: Date.now() };
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.currentSave));
      }
      /**
       * Export save as base64 string
       */
      static exportSave() {
        try {
          const json = JSON.stringify(this.currentSave);
          return btoa(json);
        } catch (e) {
          console.error("Failed to export:", e);
          return "";
        }
      }
      /**
       * Import save from base64 string
       */
      static importSave(data) {
        try {
          const json = atob(data);
          const parsed = JSON.parse(json);
          if (typeof parsed.scrap !== "number" || typeof parsed.currentWave !== "number") {
            return false;
          }
          this.currentSave = {
            ...DEFAULT_SAVE,
            ...parsed,
            upgrades: { ...DEFAULT_SAVE.upgrades, ...parsed.upgrades },
            stats: { ...DEFAULT_SAVE.stats, ...parsed.stats }
          };
          localStorage.setItem(SAVE_KEY, JSON.stringify(this.currentSave));
          return true;
        } catch (e) {
          console.error("Failed to import:", e);
          return false;
        }
      }
      /**
       * Calculate offline progress
       * Returns scrap earned while away (capped at MAX_OFFLINE_HOURS)
       */
      static calculateOfflineProgress() {
        const save = this.load();
        const now = Date.now();
        const elapsed = (now - save.lastSaveTime) / 1e3;
        if (elapsed < 60 || save.scrapPerSecond <= 0) {
          return 0;
        }
        const cappedSeconds = Math.min(elapsed, MAX_OFFLINE_HOURS * 3600);
        const offlineScrap = save.scrapPerSecond * cappedSeconds;
        this.save({ scrap: save.scrap + offlineScrap });
        return offlineScrap;
      }
      /**
       * Get settings
       */
      static getSettings() {
        try {
          const data = localStorage.getItem(SETTINGS_KEY);
          if (data) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
          }
        } catch (e) {
          console.error("Failed to load settings:", e);
        }
        return { ...DEFAULT_SETTINGS };
      }
      /**
       * Save settings
       */
      static saveSettings(settings) {
        try {
          const current = this.getSettings();
          const updated = { ...current, ...settings };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to save settings:", e);
        }
      }
      /**
       * Get upgrade level
       */
      static getUpgradeLevel(upgradeId) {
        return this.currentSave.upgrades[upgradeId] || 0;
      }
      /**
       * Check if upgrade is owned (level > 0)
       */
      static hasUpgrade(upgradeId) {
        return this.getUpgradeLevel(upgradeId) > 0;
      }
      /**
       * Add upgrade level
       */
      static addUpgradeLevel(upgradeId) {
        const current = this.getUpgradeLevel(upgradeId);
        this.currentSave.upgrades[upgradeId] = current + 1;
      }
      /**
       * Add scrap
       */
      static addScrap(amount) {
        this.currentSave.scrap += amount;
        this.currentSave.stats.totalScrapEarned += amount;
      }
      /**
       * Spend scrap
       */
      static spendScrap(amount) {
        if (this.currentSave.scrap >= amount) {
          this.currentSave.scrap -= amount;
          return true;
        }
        return false;
      }
      /**
       * Add cores
       */
      static addCores(amount) {
        this.currentSave.cores += amount;
      }
      /**
       * Spend cores
       */
      static spendCores(amount) {
        if (this.currentSave.cores >= amount) {
          this.currentSave.cores -= amount;
          return true;
        }
        return false;
      }
      /**
       * Record a kill
       */
      static recordKill() {
        this.currentSave.stats.totalKills++;
      }
      /**
       * Record boss defeat
       */
      static recordBossDefeat() {
        this.currentSave.stats.bossesDefeated++;
      }
      /**
       * Update play time
       */
      static addPlayTime(seconds) {
        this.currentSave.stats.playTime += seconds;
      }
    };
  }
});

// tests/game-tests.ts
var globalScope = globalThis;
if (typeof globalScope.localStorage === "undefined") {
  const store = /* @__PURE__ */ new Map();
  globalScope.localStorage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    }
  };
}
if (typeof globalScope.btoa === "undefined") {
  globalScope.btoa = (data) => Buffer.from(data, "utf-8").toString("base64");
}
if (typeof globalScope.atob === "undefined") {
  globalScope.atob = (data) => Buffer.from(data, "base64").toString("utf-8");
}
var results = [];
function test(name, fn) {
  return Promise.resolve(fn()).then(() => {
    results.push({ name, passed: true });
    console.log(`\u2705 ${name}`);
  }).catch((error) => {
    results.push({ name, passed: false, error: String(error) });
    console.log(`\u274C ${name}: ${error}`);
  });
}
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}
async function testSaveManagerReset() {
  const { SaveManager: SaveManager2 } = await Promise.resolve().then(() => (init_SaveManager(), SaveManager_exports));
  SaveManager2.reset();
  const save = SaveManager2.getCurrent();
  assertEqual(save.scrap, 0, "Scrap should be 0 after reset");
  assertEqual(save.currentWave, 1, "Wave should be 1 after reset");
  assertEqual(save.currentSector, 0, "Sector should be 0 after reset");
}
async function testSaveManagerPersistence() {
  const { SaveManager: SaveManager2 } = await Promise.resolve().then(() => (init_SaveManager(), SaveManager_exports));
  SaveManager2.addScrap(100);
  SaveManager2.save(SaveManager2.getCurrent());
  const saveData = localStorage.getItem("autoInvaders_save");
  assert(saveData !== null, "Save should exist in localStorage");
  const parsed = JSON.parse(saveData);
  assertEqual(parsed.scrap, 100, "Saved scrap should be 100");
}
async function testSaveManagerLoad() {
  const { SaveManager: SaveManager2 } = await Promise.resolve().then(() => (init_SaveManager(), SaveManager_exports));
  SaveManager2.reset();
  SaveManager2.addScrap(250);
  SaveManager2.save(SaveManager2.getCurrent());
  SaveManager2.currentSave = { scrap: 0 };
  const loaded = SaveManager2.load();
  assertEqual(loaded.scrap, 250, "Loaded scrap should be 250");
}
async function testHasSave() {
  const { SaveManager: SaveManager2 } = await Promise.resolve().then(() => (init_SaveManager(), SaveManager_exports));
  localStorage.removeItem("autoInvaders_save");
  assert(!SaveManager2.hasSave(), "hasSave should return false when no save");
  SaveManager2.reset();
  assert(SaveManager2.hasSave(), "hasSave should return true after reset");
}
async function testExportImport() {
  const { SaveManager: SaveManager2 } = await Promise.resolve().then(() => (init_SaveManager(), SaveManager_exports));
  SaveManager2.reset();
  SaveManager2.addScrap(500);
  SaveManager2.update({ currentWave: 5, currentSector: 2 });
  SaveManager2.save(SaveManager2.getCurrent());
  const exported = SaveManager2.exportSave();
  assert(exported.length > 0, "Export should produce a string");
  SaveManager2.reset();
  const imported = SaveManager2.importSave(exported);
  assert(imported, "Import should succeed");
  assertEqual(SaveManager2.getCurrent().scrap, 500, "Imported scrap should be 500");
  assertEqual(SaveManager2.getCurrent().currentWave, 5, "Imported wave should be 5");
}
async function testUpgradePurchase() {
  const { SaveManager: SaveManager2 } = await Promise.resolve().then(() => (init_SaveManager(), SaveManager_exports));
  SaveManager2.reset();
  SaveManager2.addScrap(200);
  SaveManager2.save(SaveManager2.getCurrent());
  const hasAutoFire = SaveManager2.hasUpgrade("autoFire");
  assert(!hasAutoFire, "Should not have autoFire before purchase");
  const cost = 120;
  if (SaveManager2.getCurrent().scrap >= cost) {
    SaveManager2.spendScrap(cost);
    SaveManager2.addUpgradeLevel("autoFire");
    SaveManager2.save(SaveManager2.getCurrent());
  }
  assert(SaveManager2.hasUpgrade("autoFire"), "Should have autoFire after purchase");
  assertEqual(SaveManager2.getCurrent().scrap, 80, "Should have 80 scrap remaining");
}
async function runAllTests() {
  console.log("\u{1F9EA} Running Auto Invaders Test Suite...\n");
  await test("SaveManager.reset()", testSaveManagerReset);
  await test("SaveManager persistence", testSaveManagerPersistence);
  await test("SaveManager.load()", testSaveManagerLoad);
  await test("SaveManager.hasSave()", testHasSave);
  await test("Export/Import", testExportImport);
  await test("Upgrade purchase", testUpgradePurchase);
  console.log("\n========================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  \u274C ${r.name}: ${r.error}`);
    });
  }
}
if (typeof window !== "undefined") {
  window.runAutoInvadersTests = runAllTests;
}
runAllTests().catch(console.error);
