---
title: matchmaking
sidebar_label: matchmaking
---

# `matchmaking`

Controls how units are paired into game slots within a section. The `type` field selects one of three strategies.

```yaml
matchmaking:
  type: none
```

---

## `none` (default)

No matchmaking. Units play independently; slots are assigned without pairing. This is the default when `matchmaking` is omitted.

```yaml
matchmaking:
  type: none
```

| Field | Type | Required | Default |
|---|---|---|---|
| `type` | `"none"` | yes | — |

---

## `manual`

An organiser assigns pairings by hand via the admin panel. The platform does not automate this step.

```yaml
matchmaking:
  type: manual
```

| Field | Type | Required | Default |
|---|---|---|---|
| `type` | `"manual"` | yes | — |

---

## `algorithmic`

The platform generates matchups automatically based on eligibility and ordering rules.

```yaml
matchmaking:
  type: algorithmic
  eligibility: 'unit.score >= 10'
  order_by: 'unit.rank'
  grouping: 'unit.division'
  assignment: dynamic
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"algorithmic"` | yes | — | Selects this strategy. |
| `eligibility` | `expr → bool` | no | — | Expression that must be true for a unit to be matched. |
| `order_by` | `expr` | no | — | Expression used to order units before pairing. |
| `grouping` | `expr → string` | no | — | Units with the same grouping value are only paired within that group. |
| `assignment` | `number` \| `"dynamic"` \| `"admin"` | no | — | Number of matchups per unit, `"dynamic"` to compute at runtime, or `"admin"` to defer to an organiser. |
