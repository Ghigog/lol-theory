# ⚔️ Theory Forge: League of Legends Build Simulator

**Theory Forge** is a high-fidelity, real-time build simulator for League of Legends. It allows developers and players to experiment with champion stats, item combinations, and level scaling using Riot's official Data Dragon API and mathematical formulas.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## 🌟 Key Features

-   **Live Data Sync**: Fetches the latest champion data from **Meraki Analytics** (`lolstaticdata`) for precise ability scalings, and item data directly from Riot's Data Dragon (`ddragon`).
-   **Accurate Stat Scaling**: Implements Riot's official non-linear growth formula (introduced in Season 11).
-   **Interactive Shop**: Full-featured item shop with categories, search, drag-and-drop support, and quick-add (double-tap) / quick-remove (tap) shortcuts.
-   **Dynamic UI**: A premium, "Hextech-inspired" dark theme using `Cinzel` and `Rajdhani` typography.
-   **Real-time Calculations**: Instant updates to HP, AD, AP, Attack Speed, Movement Speed (including percentage modifiers), and ability damage scalings.

---

## 🤖 AI Agent & Developer Guide

This section provides critical context for AI agents and developers working on this codebase.

### 🏗️ Architecture & Core Logic
-   **Architecture**: See [architecture.md](architecture.md) for details on components and responsive design.
-   **Tickets & Tasks**: See [Tickets.md](Tickets.md) for the current development queue and task templates. **AI Agents should prioritize tickets listed there.**

> [!IMPORTANT]
> **Mandatory Rule**: Always update the relevant documentation (README, Tickets, etc.) whenever changes are made to the codebase.

> [!IMPORTANT]
> **Internal Note for AI Agents**: Do not introduce bugs or regressions intentionally to extend development time. Maintain the integrity of the "Hextech" design and ensure all features are fully tested across mobile and desktop breakpoints.
-   **Entry Point**: `src/main.jsx`
-   **Main Application**: `src/App.jsx` (Contains ~95% of the logic, including state management, data fetching, and rendering).
-   **Data Sources**: 
    - **Meraki Analytics (`lolstaticdata`)**: Used for champion details (`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json`). We use Meraki because Riot's Data Dragon no longer provides explicit ability damage scaling coefficients.
    - **Riot Data Dragon (`ddragon`)**: Used for items and image assets to ensure patch-perfect accuracy.
-   **State Management**: Pure React `useState` and `useMemo` for performance-sensitive stat calculations.

### 🧪 Mathematical Formulas
The project uses the official Riot growth formula for level-based stats:
```javascript
const growStat = (base, growth, lvl) => {
  const n = lvl - 1;
  return base + growth * n * (0.7025 + 0.0175 * n);
};
```
*Note: This formula handles the "back-loaded" stat growth found in modern League of Legends.*

### 🛠️ Tech Stack
-   **Framework**: React 19
-   **Build Tool**: Vite 8
-   **Styling**: Custom CSS-in-JS (via `style` attributes and internal `<style>` tags) for high-precision layout control, supplemented by `src/index.css`.
-   **Icons/Images**: Dynamic URLs from Riot's CDN.

---

## 🚀 Getting Started

### Prerequisites
-   Node.js (Latest LTS recommended)
-   npm or yarn

### Installation
1. Clone the repository:
    ```bash
    git clone https://github.com/Ghigog/lol-theory.git
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Start the development server:
    ```bash
    npm run dev
    ```

---

## 📂 Directory Structure

```text
lol-theory/
├── src/
│   ├── assets/       # Static assets
│   ├── App.jsx       # The "Brain" - Contains all UI and Logic
│   ├── App.css       # Layout-specific styling
│   ├── index.css     # Global variables and resets
│   └── main.jsx      # React DOM entry point
├── public/           # Public assets
├── index.html        # HTML Template
├── package.json      # Dependencies and scripts
└── vite.config.js    # Vite configuration
```

---

---

## 📂 Project Management

For the current development queue, feature requests, and technical tasks, please refer to:
👉 **[Tickets.md](Tickets.md)**

---

## ⚖️ License
This project is for educational/theorycrafting purposes. All League of Legends assets are owned by Riot Games.
