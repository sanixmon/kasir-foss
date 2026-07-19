# Role Selection and Admin Auth Design Spec

## Overview
Introduce a first-layer authentication screen to differentiate between Cashier and Admin logins. This lays the groundwork for a dedicated Admin Panel and implements basic access control for sensitive areas like Settings.

## Architecture & UI Flow
1. **New Component (`RoleSelection.jsx`)**: 
   - A full-screen welcome view displayed when no role is active.
   - Contains two primary cards: "Portal Kasir" (Cashier Portal) and "Portal Admin" (Admin Portal).
2. **Cashier Flow**:
   - Clicking "Portal Kasir" sets `role = 'cashier'`.
   - The user is seamlessly routed to the existing `LoginPage.jsx` to enter their shift name.
3. **Admin Flow**:
   - Clicking "Portal Admin" triggers a password prompt modal on the same screen.
   - Validates input against the existing `adminPassword` state in `App.jsx`.
   - On success, sets `role = 'admin'` and bypasses `LoginPage.jsx`, dropping the admin directly into the main app (with no active shift user).

## State Management (`App.jsx`)
- Introduce new state: `currentUserRole` (null, 'cashier', 'admin').
- Persist in localStorage as `kw_userRole`.
- Modify `handleLogout`: clears both `kw_currentUser` (shift name) and `kw_userRole`, returning the user to `RoleSelection.jsx`.

## Access Control
- **Settings Tab Protection**: The Settings tab in the bottom navigation and routing will be hidden if `currentUserRole === 'cashier'`. Only Admins will see and access Settings.

## Testing Strategy (TDD)
- Write tests for `RoleSelection` rendering and role clicks.
- Write tests in `App.test.jsx` (or equivalent) to ensure `RoleSelection` is shown initially, routes to `LoginPage` for cashiers, and handles Admin password validation.
- Assert that Settings tab is omitted for cashier role.
