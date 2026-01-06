# Auto Invaders 🚀

A Space-Invaders-like arcade shooter with progressive automation upgrades. Built with **Vite + TypeScript + Phaser 3**.

![Game Preview](./docs/preview.png)

## 🎮 Gameplay

Start as the "Operator" - manually clicking to fire your ship's cannon. As you earn Scrap from destroying enemies, unlock powerful automation:

1. **Early Game**: Click frantically to survive and earn Scrap
2. **Auto-Fire Module** (120 Scrap): Ship starts shooting automatically
3. **Autopilot Module** (250 Scrap): Ship moves on its own
4. **Late Game**: Upgrade targeting AI, deploy drones, and use tactical abilities

### Campaign Structure
- **6 Sectors** with unique enemy types and mechanics
- **12 Waves + Boss** per sector
- **2-3 hours** of progression content

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 Deployment to GitHub Pages

### 1. Configure Base Path

Edit `vite.config.ts` and set the base to your repository name:

```typescript
export default defineConfig({
  base: "/your-repo-name/",
  // ...
});
```

### 2. Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 3. Enable GitHub Pages

1. Go to your repository **Settings** → **Pages**
2. Under "Build and deployment", select **GitHub Actions**
3. Push to `main` branch to trigger deployment

## 🎯 Controls

| Action | Control |
|--------|---------|
| Fire (before Auto-Fire) | Click / Space |
| Overload (after Auto-Fire) | Click / Space |
| Mark Target (Sector 2+) | Click on enemy |
| Overdrive (Sector 5+) | Q |
| Open Shop | E |
| Pause | ESC |
| Move (always available) | A/D or Arrow Keys |

## 💾 Save System

- **Autosave**: Every 15 seconds
- **Save on Purchase**: Automatic
- **Export/Import**: Base64 save codes
- **Offline Progress**: Earn Scrap while away (up to 8 hours)

## 🛠️ Tech Stack

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe code
- **Phaser 3** - 2D game framework
- **Plain HTML/CSS** - DOM overlay UI (no React)

## 📁 Project Structure

```
auto-invaders/
├── src/
│   ├── main.ts              # Entry point
│   ├── config/
│   │   └── GameConfig.ts    # All game constants
│   ├── scenes/
│   │   ├── BootScene.ts     # Loading
│   │   ├── MenuScene.ts     # Main menu
│   │   ├── GameScene.ts     # Core gameplay
│   │   └── VictoryScene.ts  # End screen
│   ├── entities/
│   │   ├── Player.ts        # Player ship
│   │   ├── Bullet.ts        # Projectiles
│   │   └── Enemy.ts         # All enemy types
│   ├── systems/
│   │   ├── SaveManager.ts   # Persistence
│   │   ├── WaveManager.ts   # Spawn logic
│   │   └── UpgradeManager.ts
│   ├── ui/
│   │   ├── ShopUI.ts        # Upgrade shop
│   │   └── HUD.ts           # In-game UI
│   └── styles/
│       └── main.css         # All styling
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🎨 Graphics

All graphics use Phaser primitive shapes (rectangles, triangles, circles). No external assets required!

## 📜 License

MIT