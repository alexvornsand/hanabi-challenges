---
title: event
sidebar_label: event
---

# `event`

The `event` key is the root of every config file. It defines the event's identity, scoring behaviour, and the tree of sections and slots that make up the competition.

```yaml
event:
  name: No Variant Challenge
  slug: nvc
  scoring_unit_type: individual
  sections:
    - name: Main
      ...
```

---

## Direct fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | yes | — | Display name of the event. |
| `slug` | `string` | yes | — | URL-safe identifier, unique across all events. |
| `scoring_unit_type` | `"individual"` \| `"team"` \| `"inferred"` | no | `"individual"` | How participants are grouped into scoring units. [Inheritable.](#inheritance) |
| `organisers` | `string[]` | no | `[]` | Platform display names of users who can manage this event. Root-only. |
| `classification_rule` | `expr → string` | no | — | Expression evaluated per unit to assign a classification label (e.g. a division). |
| `unit_attribution` | `"share"` \| `"split"` | no | — | How points are attributed when multiple units share a game slot. |
| `conditional_activation` | `expr → bool` | no | — | Guard expression; the section is skipped unless this evaluates to `true`. |
| `non_participant_result` | `expr → number` | no | `"0"` | Score assigned to units that did not participate. [Inheritable.](#inheritance) |

---

## Sub-objects

These fields are objects with their own nested structure. Each links to a dedicated page.

| Field | Description |
|---|---|
| [`aggregation_function`](./aggregation-function) | How game results are aggregated into a section score. |
| [`time_window`](./time-window) | Active time range for this section. Inheritable. |
| [`capture_policy`](./capture-policy) | Which game capture methods are accepted. Inheritable. |
| [`registration_policy`](./registration-policy) | How participants register. Inheritable. |
| [`visibility_policy`](./visibility-policy) | When results and specs are visible. Inheritable. |
| [`matchmaking`](./matchmaking) | How units are paired into game slots. |
| [`advancement`](./advancement) | Whether units advance to another section after this one. |
| [`routing`](./routing) | Fine-grained routing rules applied after a section concludes. |

---

## Root-only sub-objects

These fields are only valid at the `event` level and will produce an error on child sections.

| Field | Description |
|---|---|
| [`dimensions`](./dimensions) | Parallel registration categories (e.g. player count classes or skill tiers). |
| [`absence_policy`](./absence-policy) | How absent units are handled in a division system. |
| [`promotion_relegation`](./promotion-relegation) | Division promotion and relegation configuration. |

---

## Children

| Field | Type | Description |
|---|---|---|
| [`sections`](./sections/) | `Section[]` | Nested competition sections. Sections can themselves contain sections. |
| `slots` | `SlotConfig[]` | Game slots defined directly on the event (uncommon; usually defined on sections). See [slots](./sections/slots). |

---

## Inheritance

Six fields cascade from parent to child automatically when not explicitly set on a child. Setting them once on `event` applies them to every section unless a section overrides:

| Field | Root default |
|---|---|
| `scoring_unit_type` | `"individual"` |
| `time_window` | `{}` (no bounds) |
| `capture_policy` | `{ submit: true, scrape: false }` |
| `registration_policy` | `{ implicit: true, explicit: false, pool_units_allowed: false }` |
| `visibility_policy` | `{ results_visible: "true", specs_visible: "true" }` |
| `non_participant_result` | `"0"` |

:::note derived_ranking override
When `aggregation_function` is `derived_ranking`, `non_participant_result` automatically inherits `"unit.parent_score"` unless explicitly set.
:::
