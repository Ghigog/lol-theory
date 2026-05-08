# Project Architecture: Theory Forge

This document details the modular structure and responsive design principles implemented in **Theory Forge**.

## 🏗️ Component Modularization

To support scalability and clean code, the main application logic has been divided into the following sub-components within `App.jsx`:

| Component | Responsibility |
| :--- | :--- |
| **Header** | Top-level branding, Gold display, and Reset controls. |
| **ChampionPanel** | Handles champion search/picking (`ChampionPicker`) and stat display (`ChampionDetails`). |
| **BuildPanel** | Manages the 6-slot item inventory (`Inventory`). |
| **ShopPanel** | The item shop with search and category filtering (`Shop`). |
| **MobileNav** | A bottom navigation bar visible only on screens <= 768px. |
| **ItemTooltip** | A custom fixed-position tooltip for detailed item stats and descriptions. |

## 📱 Responsive Strategy (Mobile-First)

The app uses a **Hybrid Layout** approach:

1.  **Desktop (>= 769px)**:
    - Side-by-side layout: Stats on the left, Build and Shop on the right (stacked vertically).
    - Uses `display: flex` and `flex: 1` to fill the available screen space.
2.  **Mobile (<= 768px)**:
    - **Tabbed Navigation**: Only one panel is visible at a time (`STATS`, `BUILD`, or `SHOP`).
    - Tab switching is handled via the `activeTab` state and the `MobileNav` component.
    - Viewport management uses `100svh` to prevent issues with mobile browser chrome.

## 🎨 Design System: "Hextech"

The visual aesthetic is governed by a unified system in `App.css`:

-   **Typography**: Uses Google Fonts `Cinzel` (Headings) and `Rajdhani` (UI/Stats).
-   **Color Palette**: Defined as CSS variables (`--c-gold`, `--c-panel`, etc.) for consistency.
-   **Visual Language**: High-contrast borders, gold gradients, and dark blue backgrounds inspired by the League of Legends client.

## ⚙️ Data Flow & State

-   **Data Dragon**: Fetches data from Riot's official Data Dragon API.
-   **Stat Engine**: Implements the official non-linear stat growth formula.
-   **Persistence**: (Planned) Ticket #5 will introduce `localStorage` for build saving.
