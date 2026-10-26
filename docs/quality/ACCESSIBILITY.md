# PrepMate Quality — Accessibility & WCAG 2.1 AA Compliance

## 1. Overview
PrepMate follows Web Content Accessibility Guidelines (WCAG 2.1 AA) across all candidate-facing and administrative pages.

---

## 2. Key Accessibility Implementations

### 2.1 Visible Focus Management
- Interactive elements (buttons, inputs, links, sliders) have distinct, high-contrast `:focus-visible` outlines defined in `tokens.css` (`outline: 2px solid var(--pm-primary)`).
- Modal dialogs trap focus when active and return focus to the triggering element upon dismissal.

### 2.2 Semantic ARIA Landmarks & Roles
- Navigation headers have `role="banner"` and `role="navigation"`.
- Main content areas use `<main>` and `role="main"`.
- Live interview room HUD features a dedicated live screen-reader announcer (`<div id="sr-status-announcer" aria-live="polite">`).

### 2.3 Color Contrast & Readability
- All text styles strictly meet minimum 4.5:1 contrast ratios against light and dark background surfaces.
- Text sizes scale smoothly with browser root zoom without container overflow or clipping.

---

## 3. Automated Verification
Verified via `tests/accessibility/accessibility.test.js` (24 checks PASS):
- Form control labels.
- Keyboard navigability of multi-step wizards.
- Range slider accessibility labels.
