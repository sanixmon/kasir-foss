# UX & Performance Improvements Design

## Objective
To improve the perceived responsiveness and performance of the application by addressing a root-level re-render issue and adding tactile CSS micro-animations for button interactions.

## 1. Architecture & Performance Fixes
Currently, the `App.jsx` component manages a `liveTime` state that updates every second via a `setInterval`. This causes the entire React component tree (including `DashboardTab` and `HistoryTab`) to re-render every second, which severely impacts interaction responsiveness and list rendering performance.

**Solution:**
- Create a standalone `<LiveClock />` component that internally manages its own `time` and `date` state and `setInterval`.
- Remove the `liveTime` and `liveDate` state and effects from `App.jsx`.
- Replace the current static UI elements in the Header with the `<LiveClock />` component.
- **Expected Outcome:** `App.jsx` and its heavy children will no longer re-render every second, immediately eliminating the sluggish UI feel ("berat").

## 2. Micro-Animations & Interaction Feedback
The application currently lacks tactile feedback when buttons, cards, or interactive elements are pressed, leading to a flat UX ("kurang feel").

**CSS Implementations:**
- **Active State (`:active`):** Apply a `transform: scale(0.96)` to all buttons (`.btn`, `.act-btn`, `.btn-start`, `.btn-sec`, etc.) and interactive cards (`.rental-card`, `.sum-card`). This creates a physical "push" effect.
- **Hover State (`:hover`):** Apply subtle brightness/box-shadow transitions to interactive elements.
- **Global Transitions:** Add `transition: all 0.2s ease` to these elements to ensure the scale and hover effects are smooth rather than abrupt.
- **Cursor Feedback:** Ensure all clickable elements explicitly use `cursor: pointer`.

## 3. Data Flow & State Management
- No changes to underlying business logic, state shape, or database operations.
- The `LiveClock` component will only contain local display state, keeping data flow completely isolated.

## 4. Testing & Verification
- Verify that clicking buttons feels snappy and provides visual feedback.
- Verify via React DevTools (or console logs) that `App.jsx` no longer re-renders every second.
- Run the existing test suite to ensure the clock component extraction does not break any structural expectations (though tests usually use mocked timers).
