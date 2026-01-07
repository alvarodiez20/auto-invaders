# Auto Invaders 🚀

A Space-Invaders-like arcade shooter with progressive automation upgrades. Built with **Vite + TypeScript + Phaser 3**.

## ✅ Play Now (Deployed)

**Play here:** https://alvarodiez20.github.io/auto-invaders/  
Jump in, blast a few waves, and see how far you can automate the ship. It’s fast to learn and hard to put down.

---

## 📖 Story

> **Year 2187 - The Outer Rim**
>
> You are the last Operator of the **A.I.S. (Automated Interception System)**, a prototype defense platform stationed at the edge of known space. When the Scrap Swarm—an endless tide of autonomous salvage drones gone rogue—began sweeping through colonial space, humanity's only hope became this single, underfunded station.
>
> At first, you must do everything manually: aim, fire, dodge. But as you destroy enemies and collect **Scrap**, you'll upgrade your ship with increasingly powerful automation systems. Your goal? Transform from a desperate "trigger-clicker" into a fully automated defense grid capable of holding back the swarm.
>
> Survive 6 sectors. Defeat 6 sector bosses. Save humanity—one upgrade at a time.

---

## 🎮 How to Play

### Starting Out (Operator Mode)
- **Click** or press **Space** to fire your weapon manually
- Use **A/D** or **Arrow Keys** to move your ship left/right
- Destroy enemies to collect **Scrap** (currency)
- Spend Scrap on upgrades in the **Shop** (always visible on the right)
- Use the **Upgrades / Info** toggle to view your stats and enemy intel

### Your First Upgrades (In Order)
1. **Auto-Fire Module** (120 Scrap) - Ship fires automatically!
2. **Autopilot Module** (250 Scrap) - Ship moves on its own!
3. **Weapon Amplifier** (25 Scrap) - Boosts damage per shot

### Core Progression
- **6 Sectors** with 12 waves + boss each
- Defeat bosses to earn **Cores** (special currency)
- Cores unlock advanced systems like Weapon Mods and Behavior Scripts
- As you progress, new enemy types appear with unique behaviors

---

## 🎯 Controls

| Action | Key/Button |
|--------|------------|
| Fire (manual mode) | **Click** or **Space** |
| Move | **A/D** or **←/→** |
| Toggle Autopilot | **T** |
| Pause | **ESC** |
| Overload (after Auto-Fire) | **Click** / **Space** |
| Overdrive (Sector 5+) | **Q** |

---

## 🛠️ Upgrade Systems

### Core Systems
| Upgrade | Cost | Effect |
|---------|------|--------|
| Auto-Fire Module | 120 Scrap | Automatic shooting |
| Autopilot Module | 250 Scrap | Automatic movement |
| Weapon Mod Slot | 1 Core | Unlocks weapon mods |
| Behavior Scripts | 1 Core | Unlocks AI behavior scripts |

### Weapon Mods (Sector 3, 1 Core)
| Mod | Effect |
|-----|--------|
| **Standard** | Single straight bullet |
| **Pierce** | Bullets pass through 3 enemies (-10% damage) |
| **Scatter** | 3-bullet spread (-40% damage each) |

### Drones (Sector 1+)
| Upgrade | Cost | Effect |
|---------|------|--------|
| Drone Bay I | 400 Scrap | Deploy first combat drone |
| Drone Bay II | 2 Cores | Deploy second combat drone |

---

## 👾 Enemy Types

| Enemy | Sector | Behavior |
|-------|--------|----------|
| **Grunt** | 0 | Basic enemy, shoots |
| **Swarmer** | 1 | Fast, erratic movement |
| **Jammer** | 2 | Disrupts systems, low armor |
| **Tank** | 3 | High HP, slow |
| **Shielded** | 3 | Has regenerating shield |
| **Splitter** | 3 | Splits into 2 minis on death |
| **Diver** | 4 | Fast horizontal sweeps |
| **Bomber** | 4 | Rapid fire |
| **Collector** | 4 | Steals scrap if it escapes |

---

## 💾 Save System

- **Autosave** every 15 seconds
- **Saves on purchase** for safety
- **Offline Progress** - Earn scrap while away (up to 8 hours)

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 📦 Deployment to GitHub Pages

**Live site:** https://alvarodiez20.github.io/auto-invaders/

1. **Configure** `vite.config.ts`:
   ```typescript
   base: "/your-repo-name/"
   ```

2. **Enable GitHub Pages** in Settings → Pages → Source: **GitHub Actions**

3. **Push to main** - Automatic deployment via included workflow

---

## 📁 Project Structure

```
auto-invaders/
├── src/
│   ├── main.ts              # Entry point
│   ├── config/GameConfig.ts # All constants
│   ├── scenes/              # Boot, Menu, Game, Victory
│   ├── entities/            # Player, Bullet, Enemy, Drone
│   ├── systems/             # SaveManager, WaveManager, UpgradeManager
│   ├── ui/                  # ShopUI, HUD
│   └── styles/main.css      # All styling
├── .github/workflows/deploy.yml
└── package.json
```

---

## 📜 License

Copyright © 2026 Alvaro Diez. All Rights Reserved.

See [LICENSE](LICENSE) for details.

