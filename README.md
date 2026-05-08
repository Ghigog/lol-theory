# ⚔️ Theory Forge: League of Legends Build Simulator

**Theory Forge** is a high-fidelity, real-time build simulator for League of Legends. It allows developers and players to experiment with champion stats, item combinations, and level scaling using Riot's official Data Dragon API and mathematical formulas.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## 🌟 Key Features

-   **Live Data Sync**: Fetches the latest champion and item data directly from Riot's Data Dragon (`ddragon`).
-   **Accurate Stat Scaling**: Implements Riot's official non-linear growth formula (introduced in Season 11).
-   **Interactive Shop**: Full-featured item shop with categories, search, and drag-and-drop inventory management.
-   **Dynamic UI**: A premium, "Hextech-inspired" dark theme using `Cinzel` and `Rajdhani` typography.
-   **Real-time Calculations**: Instant updates to HP, AD, AP, Attack Speed, Movement Speed (including percentage modifiers), and more.

---

## 🤖 AI Agent & Developer Guide

This section provides critical context for AI agents and developers working on this codebase.

### 🏗️ Architecture & Core Logic
-   **Entry Point**: `src/main.jsx`
-   **Main Application**: `src/App.jsx` (Contains ~95% of the logic, including state management, data fetching, and rendering).
-   **Data Source**: Uses `https://ddragon.leagueoflegends.com`. Versions are fetched dynamically to ensure patch-perfect accuracy.
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
    git clone https://github.com/your-username/lol-theory.git
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

## 📝 Roadmap
-   [ ] **Ability Scaling**: Add logic to calculate damage for individual champion abilities (Q/W/E/R).
-   [ ] **Rune Integration**: Allow users to select runes and see their impact on stats.
-   [ ] **Advanced Item Passives**: Implement complex passives (e.g., Death's Dance, Infinity Edge crit bonus).
-   [ ] **Shareable Builds**: Generate unique URLs for specific champion/item/level configurations.

---

## ⚖️ License
This project is for educational/theorycrafting purposes. All League of Legends assets are owned by Riot Games.
