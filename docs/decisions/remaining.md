# Remaining Design Decisions

## Q1 — Warning / Error UX in the YAML Editor

**Decision:** Warnings and errors surface in real time in the editor feedback section as a reflection of the current config state. They are not dismissable. If warnings or errors are present at publish time, a modal surfaces them and blocks (or warns before) publishing.

**Scope clarification:** This applies to event *planning* (config authoring). Execution-time enforcement (e.g. slot fill warnings during a live event) is deferred.

**Downstream impact:**
- Ticket 050+: editor diagnostics panel is read-only, live-updating; no per-warning acknowledge buttons; no "Acknowledge all" action.
- Publish modal: list active warnings/errors; errors hard-block; warnings soft-block (confirm to proceed, or block — TBD per error severity).

---

## Q2 — Scoreboard Refresh

**Decision:** No special refresh mechanism is needed. Scoreboard data is stored in the DB after scraping. Client calls to the DB are on-demand (standard HTTP fetch on page load / explicit navigation). Calls to the source platform happen on the scrape schedule. The UI simply fetches current DB state — no polling, no push notifications, no manual refresh button required.

**Downstream impact:**
- Ticket 051: scoreboard page performs a standard fetch on mount. No refresh button, no WebSocket, no push notification wiring.

---

## Q3 — On-demand Scrape Trigger

**Decision:** "Scrape now" lives in the **event control panel** — the side panel on the event page where admin-triggered actions (e.g. manual advancement decisions) already live. It can also appear in the admin space, but that is UI surface area, not a new architectural concern.

**Downstream impact:**
- Ticket 053: implement scrape trigger in the event control panel side panel. Admin space trigger is optional polish.
