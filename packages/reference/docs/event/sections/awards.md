---
title: awards
sidebar_label: awards
---

# `awards`

Awards are badges granted to units that meet a defined condition. They can appear on any section or on the event root.

```yaml
awards:
  - name: Perfect Score
    predicate: 'unit.score == 25'
    badge:
      primary_text: '25!'
      shape: star
      colour: gold
```

---

## Award fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | yes | — | Display name of the award. Shown in the awards UI. |
| `predicate` | `expr → bool` \| `object` | yes | — | Condition under which the award is granted. See [predicates](#predicates). |
| `badge` | `BadgeConfig` | yes | — | Visual configuration for the badge. See [badge fields](#badge-fields). |
| `when` | `expr → bool` | no | `"true"` | Additional guard; the award is only evaluated when this is `true`. Use to scope the award to a specific event phase. |

---

## Badge fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `primary_text` | `string` | yes | — | Main text displayed on the badge face. |
| `secondary_text` | `string` | no | — | Smaller supporting text below `primary_text`. |
| `shape` | `"circle"` \| `"shield"` \| `"star"` \| `"ribbon"` \| `"hex"` | no | `"circle"` | Badge shape. |
| `colour` | `ColourToken` | yes | — | Fill colour from the design system token set. |
| `size` | `"regular"` \| `"large"` | no | `"regular"` | Badge display size. |
| `icon` | `string` | no | — | Material Icons symbol name displayed on the badge. |

### Colour tokens

Colour tokens follow the design system palette. Sequential tokens: `diamond`, `platinum`, `gold`, `silver`, `bronze`, `iron`, `ash`. Semantic tokens: `pos-2`, `pos-1`, `mid`, `neg-1`, `neg-2`. Hue tokens: `green-0` through `green-9`, `blue-0` through `blue-9`, `magenta-0` through `magenta-9`.

---

## Predicates

The `predicate` field accepts either an expression string or a named predicate object.

### Expression string

```yaml
predicate: 'unit.score >= 20'
```

Any [expression](../../expressions) that evaluates to a boolean.

### Named predicate

```yaml
predicate:
  stable_partnership: true
```

Currently supported named predicates:

| Name | Description |
|---|---|
| `stable_partnership` | True when a unit's two participants played together in all submitted games. |

---

## Examples

```yaml
awards:
  # Rank-based award
  - name: Top Finisher
    predicate: 'unit.rank == 1'
    badge:
      primary_text: '#1'
      shape: shield
      colour: gold

  # Participation award
  - name: Participant
    predicate: 'unit.participated'
    badge:
      primary_text: NVC
      shape: circle
      colour: blue-5

  # Scoped to a specific section closing
  - name: Season 3 Champion
    predicate: 'unit.rank == 1'
    when: 'event.section("S3").status == "closed"'
    badge:
      primary_text: S3
      secondary_text: Champion
      shape: hex
      colour: diamond
      icon: emoji_events
```
