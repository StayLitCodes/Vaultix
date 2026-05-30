# 📱 Vaultix Mobile — QA Checklist

> Use this checklist to manually validate the core mobile flows before submitting a release or dev build.

---

## 1. Welcome / Connect Wallet Screen

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 1.1 | Launch the app on a simulator/device | Welcome screen appears with branding (**Vaultix** + tagline) | ☐ |
| 1.2 | Verify feature cards are displayed | Three cards: Secure Escrow, Milestone Tracking, Dispute Resolution | ☐ |
| 1.3 | Tap **Connect Wallet** | Button shows loading spinner ("Connecting…") for ~1.5s | ☐ |
| 1.4 | Wait for connection to finish | App navigates to **Dashboard** tab automatically | ☐ |
| 1.5 | Tap **Explore without wallet →** | App navigates to **Dashboard** tab (skip wallet) | ☐ |
| 1.6 | Rotate the device or resize | Layout adapts correctly (ScrollView still scrollable) | ☐ |

---

## 2. Dashboard — Escrow List

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 2.1 | Dashboard loads on wallet connect or skip | Screen shows empty state ("No escrows found") when API returns empty | ☐ |
| 2.2 | Pull down to refresh | Refresh indicator appears; list reloads | ☐ |
| 2.3 | Skeleton loaders appear while loading | Grey placeholder cards shown before real data | ☐ |
| 2.4 | **Status filter tabs** are visible | Tabs: All, Created, Funded, Active, Completed, Disputed, Expired | ☐ |
| 2.5 | Tap a status filter (e.g., "Active") | List filters to show only escrows with that status | ☐ |
| 2.6 | Active filter tab has highlighted style | Selected tab has purple (#6c63ff) background | ☐ |
| 2.7 | Escrow cards show: title, status badge, amount, deadline | All fields visible and formatted | ☐ |
| 2.8 | Status badge color matches status | Created=purple, Funded=blue, Completed=green, Disputed=red, Expired=orange | ☐ |
| 2.9 | Scroll to bottom of list (≥20 items) | Pagination triggers; "loading more" spinner appears | ☐ |
| 2.10 | Tap **＋** button (top-right) | Navigates to **Create Escrow** screen | ☐ |
| 2.11 | Tap an escrow card | Navigates to **Escrow Detail** screen with correct ID | ☐ |

---

## 3. Escrow Detail Screen

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 3.1 | Navigate to escrow detail (from dashboard) | Skeleton loaders shown while fetching | ☐ |
| 3.2 | Data loads successfully | Title, description, status badge, amount, deadline are displayed | ☐ |
| 3.3 | **Milestones** section visible | Each milestone shows title, amount, and status (Released / Pending) | ☐ |
| 3.4 | **Parties** section visible | Each party shows role, wallet address (truncated), and status | ☐ |
| 3.5 | **Activity Timeline** section visible | Events listed in order with date/time | ☐ |
| 3.6 | **Actions** section shows correct buttons per status + role | See table below | ☐ |

### Action visibility by status / role

| Escrow Status | Depositor | Recipient | Arbitrator |
|---------------|-----------|-----------|------------|
| created | Fund Escrow | — | — |
| funded / confirmed | Release (per milestone) + Raise Dispute | — | — |
| disputed | — | — | Resolve Dispute |
| completed / cancelled / expired | No actions | No actions | No actions |

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 3.7 | Tap **Release** on a milestone | Navigates to **Release Milestone** screen | ☐ |
| 3.8 | Swipe back from detail screen | Returns to Dashboard with previous state preserved | ☐ |
| 3.9 | Error state (e.g., network offline) | Error message + "Retry" button shown | ☐ |

---

## 4. Create Escrow — Multi-Step Form

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 4.1 | Navigate to Create Escrow (+ button) | Step indicator shows "Step 1 of 4" | ☐ |
| 4.2 | **Step 1 — Parties & Amount**: Leave all fields empty, tap **Next →** | Validation errors shown for Title, Recipient, Amount | ☐ |
| 4.3 | Fill valid data, tap **Next →** | Advances to Step 2 (Milestones) | ☐ |
| 4.4 | **Step 2 — Milestones**: One milestone pre-filled | Can edit title, amount | ☐ |
| 4.5 | Enter milestone amounts that sum to more/less than total | Error shown: "Milestone amounts must equal total" | ☐ |
| 4.6 | Tap **+ Add Milestone** (up to 10) | New milestone block added | ☐ |
| 4.7 | Tap **Remove** on a milestone (if > 1) | Milestone block removed | ☐ |
| 4.8 | Fill milestone amounts that sum to total, tap **Next →** | Advances to Step 3 (Deadline) | ☐ |
| 4.9 | **Step 3 — Deadline**: Leave empty, tap **Next →** | Validation error: "Deadline is required" | ☐ |
| 4.10 | Enter a past date, tap **Next →** | Error: "Deadline must be in the future" | ☐ |
| 4.11 | Enter a future date, tap **Next →** | Advances to Step 4 (Review) | ☐ |
| 4.12 | **Step 4 — Review**: Verify all fields show correctly | Title, Recipient, Amount, Deadline, Milestone count displayed | ☐ |
| 4.13 | Tap **Create Escrow** | Loading indicator; success alert on completion | ☐ |
| 4.14 | Tap "View" in success alert | Navigates to Escrow Detail screen for the new escrow | ☐ |
| 4.15 | Tap ← Back at any step | Returns to previous step with all data preserved | ☐ |

---

## 5. Release Milestone Screen

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 5.1 | Navigate to Release Milestone (from detail screen) | Screen shows escrow ID, milestone ID, and "Confirm Release" button | ☐ |
| 5.2 | Tap **Confirm Release** | Status changes to "Submitting" with spinner | ☐ |
| 5.3 | Tx submitted successfully | Status changes to "Submitted", polling starts | ☐ |
| 5.4 | Tx confirmed by network | Status changes to "Confirmed" with success banner | ☐ |
| 5.5 | Tx fails | Status shows "Failed" with error message + "Retry" + "Go Back" buttons | ☐ |
| 5.6 | Tap **Retry** after failure | State resets to "Ready" (idle) | ☐ |
| 5.7 | Tap **Back to Escrow** after confirmation | Navigates to Escrow Detail screen | ☐ |
| 5.8 | Transaction hash displayed during submitted/confirmed states | Hash shown in monospace font, tappable | ☐ |

---

## 6. Notifications Screen

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 6.1 | Navigate to Notifications (tab) | Screen shows empty state or notification list | ☐ |
| 6.2 | Skeleton loaders shown while loading | Grey skeleton items before data loads | ☐ |
| 6.3 | Unread notifications have a purple dot + left border | Visual distinction from read items | ☐ |
| 6.4 | Unread count shown in header | "(N) unread" badge visible | ☐ |
| 6.5 | Tap an unread notification | Dot disappears; navigates to related Escrow Detail (if escrowId exists) | ☐ |
| 6.6 | Tap **Mark all read** | All notifications marked as read; count goes to 0 | ☐ |
| 6.7 | Pull down to refresh | List reloads with latest data | ☐ |
| 6.8 | Error state (network offline) | Error message + "Retry" button shown | ☐ |
| 6.9 | Notification event types display readable labels | CREATED → "Escrow Created", FUNDED → "Escrow Funded", etc. | ☐ |

---

## 7. Cross-Cutting Concerns

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 7.1 | **Dark theme** consistency across all screens | Background: #12121f, cards: #1e1e30, text: white/grey | ☐ |
| 7.2 | **Accessibility**: Screen reader labels | Buttons have `accessibilityLabel` props | ☐ |
| 7.3 | **Keyboard handling**: Create Escrow form on iOS | KeyboardAvoidingView pushes content up | ☐ |
| 7.4 | **API timeout** (15s) | Requests fail gracefully with error state | ☐ |
| 7.5 | **Memory**: Navigate between all screens repeatedly | No crashes, no memory warnings | ☐ |

---

## 8. Build & CI Checks

| # | Check | Expected Result | Pass/Fail |
|---|-------|----------------|-----------|
| 8.1 | `pnpm lint` passes | No ESLint errors | ☐ |
| 8.2 | `pnpm type-check` passes | No TypeScript errors | ☐ |
| 8.3 | `pnpm test` passes | All Jest tests green | ☐ |
| 8.4 | `pnpm validate` passes | lint → type-check → test all pass in sequence | ☐ |
| 8.5 | EAS dev build compiles | `eas build --profile development --platform all` succeeds | ☐ |
| 8.6 | Dev build installs on device/emulator | App launches without crash | ☐ |

---

## Tips for Testers

- **Reset state**: Clear app data or reinstall to test fresh-start scenarios.
- **Network simulation**: Toggle airplane mode to verify error states.
- **Backend**: Ensure the backend is running (`cd apps/backend && pnpm start:dev`) and seeded with test data.
- **Reporting bugs**: Include screen name, step number, expected vs actual result, and a screenshot/video if possible.
