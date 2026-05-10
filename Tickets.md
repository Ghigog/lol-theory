# 🎫 Project Tickets

This document tracks all planned features and technical tasks for **Theory Forge**. Every task must follow the ticket template below.

---

## 🛠️ Ticket Template

## Ticket Title
*Status: [Status]*
### User Story (as a, i'd like to, so that)

- **Context**: (why)
- **Description**: (What)
- **Requirements**: (how)

### Acceptance criteria (Gherkin language)

- **Estimated complexity**: 
- **Risk assessment**: 

---

## 🟢 Open Tickets

## Ticket #1: Ability Scaling Logic
*Status: Open*
### User Story
As a theorycrafter, I'd like to see the damage and scaling of champion abilities so that I can evaluate the impact of different item builds on burst and DPS.

- **Context**: Champions aren't just stat sticks; their power comes from their kits. Currently, the app only shows base stats.
- **Description**: Implement a system to parse and display champion ability data (Q, W, E, R) with real-time damage calculations based on the current build's stats (AD, AP, HP, etc.).
- **Requirements**:
    - Fetch full champion detail data from Data Dragon.
    - Parse scaling coefficients from the `spells` array.
    - Calculate "final" damage values using current `total` stats.
    - Create a UI section for Ability tooltips/cards.

### Acceptance criteria
- **Given** I have a champion selected and items equipped
- **When** I view the ability section
- **Then** I should see the damage numbers update dynamically as I change items or level.

- **Estimated complexity**: High
- **Risk assessment**: Parsing Data Dragon's tooltip strings for math formulas is notoriously difficult and prone to breaking on patch changes.

---

## Ticket #2: Rune Integration System
*Status: Open*
### User Story
As a competitive player, I'd like to select runes (Keystones and Stat Shards) so that I can see my exact in-game stats at level 1 and beyond.

- **Context**: Runes can provide significant flat stats (AD, AP, AS) or percentage modifiers that are crucial for early-game theorycrafting.
- **Description**: Build a rune selection interface and integrate its modifiers into the global stat calculation engine.
- **Requirements**:
    - Fetch rune data from `runesReforged.json`.
    - Implement a UI for selecting a Primary and Secondary path.
    - Map rune effects to stat modifiers in the `useMemo` stats block.

### Acceptance criteria
- **Given** the rune picker is open
- **When** I select "Conqueror" or "Adaptive Force" shards
- **Then** my Attack Damage or Ability Power should increase immediately in the stat panel.

- **Estimated complexity**: Medium-High
- **Risk assessment**: UI complexity for the rune tree layout; ensuring correct stacking with item bonuses.

---

## Ticket #3: Advanced Item Passives
*Status: Open*
### User Story
As a detailed builder, I'd like item passives (like Rabadon's Deathcap or Infinity Edge) to be calculated so that I get an accurate final stat profile.

- **Context**: Many "capstone" items provide percentage increases to total stats rather than just flat bonuses.
- **Description**: Refactor the stat engine to handle "Unique Passives" that apply multipliers to the final sums.
- **Requirements**:
    - Identify items with special passives (e.g., ID 3089 for Rabadon's).
    - Implement a second pass in the stat calculation to apply multipliers.
    - Display passive names in the item tooltips.

### Acceptance criteria
- **Given** I have 100 AP and I buy Rabadon's Deathcap
- **When** the stats are calculated
- **Then** my total AP should reflect the +35% (or current patch value) increase.

- **Estimated complexity**: Medium
- **Risk assessment**: Circular dependencies if passives scale off each other (though rare in LoL).

---

## Ticket #4: Shareable Build URLs
*Status: Open*
### User Story
As a community member, I'd like to share my builds via a URL so that I can show others my optimal setups.

- **Context**: Theorycrafting is a social activity; users need a way to export their work.
- **Description**: Implement a system to encode the current champion, level, and items into the URL's search parameters.
- **Requirements**:
    - Create a serialization function for the state (champId, level, itemIds).
    - Update the URL as the user makes changes (using `window.history.pushState` or similar).
    - Handle state hydration from the URL on page load.

### Acceptance criteria
- **Given** I have a custom build
- **When** I copy the URL and open it in a new tab
- **Then** the same champion, level, and items should be automatically loaded.

---

## Ticket #5: Local Build Saving & Recovery
*Status: Completed*
### User Story
As a builder, I'd like to save my builds into dedicated slots and recover them later so that I can quickly switch between different experimental setups for the same or different champions.

- **Context**: Experimenting with builds takes time; users need a way to "bookmark" a specific configuration without relying on URL sharing alone.
- **Description**: Implement a local storage-based build management system with 6 available slots.
- **Requirements**:
    - **Persistence**: Use `localStorage` to persist builds across sessions.
    - **Slot Management**: Limit to 6 max slots per user.
    - **UI Integration**: Display saved builds in the champion detail panel after a hero is selected.
    - **Save Workflow**: A "Save" button that triggers a modal or dropdown with options: "Save as New", "Overwrite Current", or "Cancel".
    - **Deletion**: Include an 'x' button next to each slot with a confirmation modal to prevent accidental deletion.
    - **Loading**: Clicking a slot instantly hydrates the current `equipped` items and `level`.

### Acceptance criteria
- **Given** I have a build for Aatrox
- **When** I click "Save" and choose "Save as New"
- **Then** I should see a new build slot appearing in the champion panel.
- **Given** I am on a different champion
- **When** I click my saved Aatrox build slot
- **Then** the app should switch back to Aatrox (or apply the items to the current champ, depending on desired behavior—let's assume it restores the champ as well) with the correct items and level.

- **Estimated complexity**: Medium
- **Risk assessment**: LocalStorage quota limits (unlikely for this small data); UI clutter in the champion panel.

---

## Ticket #6: Time Objective System
*Status: Open*
### User Story
As a strategic player, I'd like to define specific time-based objectives for my build so that I have a clear roadmap of power spikes and gold targets to follow during a live match.

- **Context**: Knowing the final build is only half the battle; knowing *when* you should have certain items is critical for competitive play.
- **Description**: A supplemental modal that allows users to attach timestamps and notes to each item in their build.
- **Requirements**:
    - **Integration**: Must be saved as part of the build data in Ticket #5 (Build Slots).
    - **UI**: A "Time Objectives" button that opens an editable list.
    - **Data**: Each objective should include an item reference, a timestamp (e.g., "12:30"), and an optional note.
    - **Persistence**: Objectives are saved/loaded alongside the main build slots.
    - **Accessibility**: Design the modal to be "glanceable" so it can be kept open on a second monitor or referenced quickly during a game.

### Acceptance criteria
- **Given** I have an active build and Ticket #5 is implemented
- **When** I open the Time Objectives modal
- **Then** I should be able to assign a "15:00" target to my second item.
- **When** I save the build slot
- **Then** the time targets should be persisted and restored when I reload that slot.

- **Estimated complexity**: Medium
- **Risk assessment**: UI complexity in managing the relationship between the inventory slots and the time targets.

---

## Ticket #7: Mobile Responsiveness & UI Overhaul
*Status: Done*
### User Story
As a mobile user, I'd like to access the build simulator on my phone so that I can theorycraft and check builds on the go without the UI breaking, overlapping, or becoming unreadable.

- **Context**: The current layout is optimized for desktop (wide screen), with a fixed-width sidebar and a large item grid. This is unusable on vertical mobile screens.
- **Description**: Implement a fully responsive CSS architecture that adapts the "Hextech" UI for mobile and tablet devices.
- **Requirements**:
    - **Layout Overhaul**: Use CSS Grid and Flexbox to transition from a side-by-side layout (Desktop) to a stacked or tabbed view (Mobile).
    - **Interactive Elements**: Ensure touch targets (champion icons, item cells) are appropriately sized for mobile taps.
    - **Stat Panel**: Create a collapsible or scrollable stat section for smaller screens.
    - **Navigation**: Consider a bottom-tab or drawer navigation for switching between "Champion", "Build", and "Shop".
    - **Standards**: Use `rem`/`em` units and media queries to ensure the design scales smoothly without losing its "premium" feel.

### Acceptance criteria
- **Given** I am on a screen narrower than 768px
- **When** I load the app
- **Then** the UI should stack vertically or offer a tabbed interface rather than horizontal columns.
- **When** I tap an item in the shop
- **Then** it should be easy to select without mis-clicking neighboring items.

- **Estimated complexity**: Medium-High
- **Risk assessment**: Overhauling the core layout can easily break the "premium" aesthetics if not done carefully with media queries.

---

## Ticket #8: Item Shop Grouping & Filtering
*Status: Open*
### User Story
As a player, I'd like the item shop to group items by their appropriate tier (Basic, Epic, Legendary, Boots, etc.) so that I can browse items in a structured way that matches the in-game experience.

- **Context**: Currently, the shop items are just one big grid. Grouping them makes it easier to visually scan for components vs finished items.
- **Description**: Categorize items based on their properties (`depth` or `tags`) into groups like Basic, Epic, Legendary, Boots, Starters, and Consumables. Add collapsible banners for each group.
- **Requirements**:
    - Deduce item tiers based on Data Dragon properties (e.g., `depth: 1` -> Basic, `depth: 2` -> Epic, `depth >= 3` -> Legendary).
    - Implement grouped rendering in the `Shop` component.
    - Add a header banner for each group with an expand/collapse toggle (dropdown arrow).
    - Keep "Basics" at the top of the hierarchy or follow standard game flow (Starter/Basic -> Epic -> Legendary).

### Acceptance criteria
- **Given** I am browsing the shop
- **When** I look at the item list
- **Then** I should see items separated into distinct grouped sections like "Basic", "Epic", and "Legendary".
- **When** I click the arrow on a group banner
- **Then** the group should collapse or expand.

- **Estimated complexity**: Low-Medium
- **Risk assessment**: Minimal. UI grouping logic is self-contained.

---

## Ticket #9: Mobile Scroll Fix & Responsiveness Audit
*Status: Completed*
### User Story
As a mobile user, I'd like to be able to scroll vertically and access all features (like saving builds) so that I can view and interact with all application features without getting stuck.

- **Context**: A recent update or layout change has broken vertical scrolling on mobile devices, rendering parts of the app inaccessible. Additionally, on mobile, the saved builds list is not accessible, and users cannot add their builds to the saved builds list. There is empty space under the item build tab that could be utilized for this.
- **Description**: Perform a comprehensive mobile responsiveness audit to identify and fix the CSS or layout constraints blocking vertical scrolling. Integrate an "Add to Saved Builds" button in the unused space beneath the item build tab to ensure this feature is accessible on mobile.
- **Requirements**:
    - Debug and remove any properties restricting vertical scrolling on mobile viewports (e.g., `overflow: hidden`, `height: 100vh`).
    - Audit all mobile breakpoints to ensure containers overflow properly and are scrollable.
    - Design and implement an "Add to Saved Builds" button adhering to the Hextech aesthetic, placing it beneath the item build tab.
    - Wire the button to the existing build persistence logic.
    - Maintain the "Hextech" aesthetic during adjustments.

### Acceptance criteria
- **Given** I am using a mobile device or a simulated mobile viewport
- **When** I attempt to scroll up or down on the page
- **Then** the page or the appropriate scrollable container should scroll smoothly and reveal hidden content.
- **Given** I have populated an item build on a mobile device
- **When** I view the item build tab
- **Then** I should see a clear button to save my build in the space underneath it, and clicking it saves my configuration.

- **Estimated complexity**: Medium
- **Risk assessment**: Altering global scroll properties or container heights might affect desktop layout or fixed panels.

---

## Ticket #10: Stats Screen Mobile Layout Fix
*Status: Completed*
### User Story
As a mobile user, I'd like the character panel to occupy the entire vertical space on the stats screen so that the saved builds section is pushed to the bottom.

- **Context**: On mobile devices, the stats panel appeared squished as a short horizontal panel, leaving empty space below it due to the hidden panel-group occupying the vertical height.
- **Description**: Fix the CSS flexbox layout on mobile viewports so that the `.panel-group` is hidden when inactive, allowing the active `.stats-panel` to take the full height.
- **Requirements**:
    - Update the media query for mobile screens to correctly hide `.panel-group` when it does not have the `.active` class.
    - Ensure `.champ-picker` and `.champ-details` correctly inherit flex properties to stretch to the available height.

### Acceptance criteria
- **Given** I am on a mobile device
- **When** I view the stats tab
- **Then** the character details/picker should occupy all available vertical space, pushing the saved builds to the bottom of the screen.

- **Estimated complexity**: Low
- **Risk assessment**: Minimal, isolated to mobile CSS overrides.

---

## Ticket #11: Unified Build and Shop Tab
*Status: Completed*
### User Story
As a user, I'd like the build and shop panels to be combined into a single unified tab so that I don't have to constantly switch back and forth while creating a build.

- **Context**: On mobile, the "Build" and "Shop" were on separate tabs, requiring extra taps to pick items and then view the inventory.
- **Description**: Merge the build and shop tabs into one view on mobile. The inventory appears at the top (with all 7 slots squeezed into one row), and the shop is placed directly below it. The dedicated "Add to Saved Builds" text button on mobile is replaced by a compact save icon next to the clear button.
- **Requirements**:
    - Remove the mobile "Shop" tab from the navigation.
    - Render both `.build-panel` and `.shop-panel` inside the `.panel-group` when the "Build" tab is active.
    - Remove the `.mobile-save-build-container` and its associated CSS.
    - Add a `.save-btn` to the `inventory-header` next to the `.trash-btn`.
    - Update `.inventory-grid` on mobile to use `repeat(7, 1fr)` with a small gap instead of `repeat(3, 1fr)`.

### Acceptance criteria
- **Given** I am on a mobile device
- **When** I navigate to the Build tab
- **Then** I should see the 7 item slots in a single row at the top, and the item shop immediately below it.
- **When** I look at the item inventory header
- **Then** I should see a save icon and a trash icon instead of a large text button at the bottom of the panel.

- **Estimated complexity**: Low
- **Risk assessment**: Mobile layout adjustments might look cramped on very narrow screens.
