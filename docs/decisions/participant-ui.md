# Participant-Facing UI Design Decisions

_Recorded from interview with user — 2026-04-25._
_These decisions govern tickets 030 (web shell), 033 (event page), 034 (scoreboard), 038 (awards), and 042 (mobile)._

---

## Q1 — Overall page structure

**Answer:** Top nav. Use the existing `MainLayout.tsx` chrome — header with nav links (Home, Events, About, Admin[organiser only]), main content area, and footer. No sidebar.

**Decision:** All participant-facing pages use `apps/web/src/layouts/MainLayout.tsx` as the wrapping layout. The header contains the navigation tabs, theme toggle, notifications bell, user pill, and login/logout. The footer contains legal and contact links. Page content renders inside `<Main>` → `<PageContainer>` → `<Outlet />`. No sidebar.

**Downstream effect on Ticket 030:** Confirm `MainLayout.tsx` is already wired as the root layout in the router. Route all participant pages through it.

---

## Q2 — Admin panel for organisers

**Answer:** Separate admin panel (global, not per-event). A floating button on event pages navigates directly to that event's config page in the admin panel.

**Decision:**
- The admin area lives at `/admin/*` — a separate section of the site, not an overlay.
- On participant-facing event pages (`/events/:slug`), organisers see a floating action button (bottom-right) that links directly to `/admin/events/:id` for that event.
- The button is only rendered when the current user is an organiser (`role IN ('ADMIN', 'SUPERADMIN')`).
- The floating button uses a `MaterialIcon` (e.g., `"settings"`) inside a `Button variant="primary"` with a fixed `position: fixed` style.

**Downstream effect on Ticket 033:** Render the floating admin shortcut button inside the event page only when `user.isOrganiser` is true.

---

## Q3 — Event page default view

**Answer:** Overview first.

**Decision:** When a participant navigates to `/events/:slug`, the default view is a summary landing section: event name, status badge, description, team size, schedule of rounds/sections, and registration status/CTA. The scoreboard is available on the same page, below the overview, or via a tab. It is not the first thing seen.

**Downstream effect on Ticket 033:** Lead with an overview section. Scoreboard (if present) follows below, or lives behind a tab labeled "Scoreboard".

---

## Q4 — Scoreboard column overflow

**Answer:** Scroll.

**Decision:** When the scoreboard has more columns than the viewport can display (e.g., many game slots), the table container scrolls horizontally. Column content is not truncated. Use `overflow-x: auto` on the table wrapper.

**Downstream effect on Ticket 034:** Wrap the scoreboard table in a horizontally scrollable container.

---

## Q5 — Row ribbon width

**Answer:** Wider than 3px — exact value TBD, can be adjusted later. The ribbon clearly indicates row status (award tier, highlight, etc.).

**Decision:** Use `8px` as the left-border ribbon width on decorated scoreboard rows. Applied as `border-left: 8px solid <color>` using the unit's `color_hex` or a status-based color token. This value is not locked — adjust freely once the component is visually reviewed.

**Downstream effect on Ticket 034:** Set ribbon width to 8px in the scoreboard row style. Use a CSS custom property (`--ribbon-width: 8px`) so it's trivial to adjust globally.

---

## Q6 — Player awards location

**Answer:** Dedicated `/profile/awards` page.

**Decision:** Earned awards are displayed at `/profile/awards` (or `/me/awards` if the profile is at `/me`). The event detail page may show a compact summary (e.g., "You earned 2 awards for this event"), but the canonical awards view is the dedicated profile awards page.

**Downstream effect on Ticket 038:** Build `AwardsPage` at `/me/awards`. Event page may link to it with a count badge.

---

## Q7 — Earned badges visibility

**Answer:** Visible to all players.

**Decision:** Award badges on the `/profile/awards` page and any inline award displays (e.g., on the scoreboard or event page) are publicly visible — not hidden from other players.

**Downstream effect on Ticket 038:** No visibility gating required. All badge/award data can be returned in public API responses.

---

## Q8 — Mobile support

**Answer:** Not a first-class V1 concern.

**Decision:** Mobile is deferred. V1 targets desktop browsers. Minimum supported screen width is not formally specified. Layouts should not break catastrophically on small screens (no fixed-width containers that cause content overflow), but responsive design is not a gating requirement. Expand scope post-V1.

**Downstream effect on Ticket 042:** No mobile-specific breakpoints or responsive variants required for V1. Ticket 042 scope is deferred.
