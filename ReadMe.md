# AnalystOS - Personal Work Tracker (v3)

## Project Overview
A Single-Page Application (SPA) designed for an Intern Analyst to track tasks, daily journals, milestones, and project history. It uses a "Local First + Cloud Sync" architecture.

## Tech Stack
* **Frontend:** Vanilla HTML5, CSS3 (Flexbox/Grid), JavaScript (ES6 Modules).
* **Backend:** Firebase Firestore (v10.7.1).
* **Icons:** FontAwesome (CDN).
* **Fonts:** Inter (Google Fonts).

## Core Architecture
1.  **Hybrid Data:** Data loads from `localStorage` immediately for speed, then syncs with Firestore in the background.
2.  **State Management:** A single `appState` object controls `tasks`, `journal`, `milestones`, and `categories`.
3.  **Document ID:** All data is stored in Firestore collection `userData`, document ID `my-tracker-v3`.

## Logic Documentation (CRITICAL)

### 1. Task Filtering Logic
The system uses "Fail-Safe" logic to ensure tasks don't disappear.
* **Daily Board (Today's Focus):**
    * Status is `In Progress` (Always shows, regardless of date).
    * Status is `To Do` AND Due Date is Today OR in the past (Overdue).
    * Status is `Done` AND Completed Date is Today.
* **Weekly Board (Upcoming):**
    * Shows any task due within the current week (Sun-Sat) that is NOT `Done`.
* **History View:**
    * Shows all `Done` tasks that were completed *before* today.

### 2. Timezone Handling
* Dates are stored as strings `YYYY-MM-DD`.
* Uses a custom `getLocalISODate()` function to prevent UTC timezone bugs that cause tasks to disappear late at night.

### 3. Journal Logic
* Includes a specialized "Copy to Clipboard" feature that formats the text for Supervisor/Slack updates:
    * Format: `Todays Recap: (DD/MM/YY) [Time] ...`

## File Structure
* `index.html`: Main structure, contains all 4 Views (Tasks, Journal, Milestones, History) and 3 Modals.
* `style.css`: Minimalist "Agency" black/white aesthetic. Handles Dark Mode via CSS variables.
* `script.js`: Contains all logic, Firebase config, and DOM manipulation.

## Future Development Notes
* **If modifying data structure:** Ensure `window.loadData` checks for integrity (e.g., `if(!appState.newField) appState.newField = []`).
* **If adding Login:** Switch Firestore rules from `allow read, write: if true;` to `request.auth != null`.
