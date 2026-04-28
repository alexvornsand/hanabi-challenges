---
title: dimensions
sidebar_label: dimensions
---

# `dimensions`

Defines parallel registration categories that let a single event track multiple sub-competitions simultaneously — for example, a player-count class dimension that separates 2-player and 4-player results.

`dimensions` is root-only: it can only appear on `event`, not on child sections.

```yaml
dimensions:
  - axis: player_count_class
    values:
      - '2-player'
      - '3-player'
      - '4-player'
      - '5-player'
    registration_cardinality: one_per_unit
```

---

## Fields

Each entry in the `dimensions` list is a `Dimension` object.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `axis` | `"player_count_class"` \| `"convention_system"` \| `"skill_tier"` \| `"format"` | yes | — | The dimension category. Determines how the axis is labelled and interpreted. |
| `values` | `string[]` | yes | — | The allowed values for this axis. Participants choose from this list when registering. |
| `registration_cardinality` | `"multiple"` \| `"one_per_unit"` \| `"organizer_assigned"` | yes | — | How many values a unit can register under. |
| `division_count` | `number` \| `string` | no | — | Number of divisions for this axis, if the event uses a division system. |

---

## `registration_cardinality`

| Value | Description |
|---|---|
| `multiple` | A unit can register under more than one value on this axis (e.g. playing in multiple player-count classes). |
| `one_per_unit` | A unit registers under exactly one value per event. |
| `organizer_assigned` | An organiser assigns the value for each unit; participants cannot self-select. |

---

## Multiple dimensions

An event can declare multiple dimensions simultaneously. A unit's registration is a combination of values, one per axis.

```yaml
dimensions:
  - axis: player_count_class
    values: ['2-player', '4-player']
    registration_cardinality: one_per_unit
  - axis: convention_system
    values: ['vanilla', 'hat-guessing']
    registration_cardinality: multiple
```
