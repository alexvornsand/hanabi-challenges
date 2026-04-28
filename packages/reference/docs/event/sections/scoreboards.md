---
title: scoreboards
sidebar_label: scoreboards
---

# `scoreboards`

Scoreboard definitions control how results are displayed for a section. A section can have multiple scoreboards — for example, one ranked by total points and another filtered to a specific division.

```yaml
scoreboards:
  - name: Overall
    scope: Main
    primary: true
    rank_by:
      primary:
        expr: 'unit.score'
        direction: descending
    columns:
      - label: Score
        value: 'unit.score'
```

---

## Scoreboard fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | yes | — | Display name for this scoreboard tab. |
| `scope` | `string` | yes | — | Name of the section whose results are displayed. |
| `primary` | `bool` | no | `false` | Whether this is the default scoreboard shown. At most one per section should be `true`. |
| `featured` | `expr → bool` | no | — | Expression; units where this is `true` are highlighted. |
| `filter` | `expr → bool` | no | — | Expression; only units where this is `true` appear in the scoreboard. |
| `rank_by` | `RankByClause` | yes | — | How rows are ordered. See [rank_by](#rank_by). |
| `columns` | `Column[]` | yes | — | Column definitions. See [columns](#columns). |
| `row_styles` | `RowStyle[]` | no | `[]` | Visual decorations applied to rows. See [row_styles](#row_styles). |

---

## `rank_by`

Defines the primary sort and optional tiebreakers.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `rank_by.primary.expr` | `expr → number` | yes | — | Expression used to rank rows. |
| `rank_by.primary.direction` | `"ascending"` \| `"descending"` | yes | — | Sort direction. |
| `rank_by.tiebreakers` | `TiebreakerClause[]` | no | `[]` | Ordered list of tiebreakers applied when the primary expression ties. |

Each tiebreaker entry:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `expr` | `expr → number` | yes | — | Tiebreaker expression. |
| `direction` | `"ascending"` \| `"descending"` | yes | — | Sort direction for this tiebreaker. |
| `visible` | `expr → bool` | no | — | When to display this tiebreaker column. |

```yaml
rank_by:
  primary:
    expr: 'unit.score'
    direction: descending
  tiebreakers:
    - expr: 'unit.max_score_count'
      direction: descending
    - expr: 'unit.bdr'
      direction: ascending
```

---

## `columns`

Each column defines one data column in the scoreboard table.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `label` | `string` | yes | — | Column header text. |
| `value` | `expr` | yes | — | Expression evaluated per unit to produce the cell value. |
| `visible` | `expr → bool` | no | — | Expression; column is shown only when this is `true`. |
| `sortable` | `bool` | no | `false` | Whether the user can click the header to sort by this column. |
| `for_each` | `expr → array` | no | — | Repeats the column once per item in the array (e.g. once per slot). |

```yaml
columns:
  - label: Score
    value: 'unit.score'
    sortable: true
  - label: Games
    value: 'unit.game_count'
  - label: Slot
    value: 'item.score'
    for_each: 'unit.slots'
```

---

## `row_styles`

Visual decorations applied to rows that match a condition. Useful for highlighting promotion zones, relegation zones, or award recipients.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `predicate` | `expr → bool` | yes | — | Condition under which the style is applied. |
| `label` | `string` | yes | — | Text shown in the row ribbon. |
| `accent` | `ColourToken` | yes | — | Ribbon colour from the design system token set. |
| `when` | `expr → bool` | no | — | Additional guard for when the style is active (e.g. only after section closes). |
| `priority` | `number` | no | — | When multiple styles match, the one with the highest priority wins. |

```yaml
row_styles:
  - predicate: 'unit.rank <= 2'
    label: Promoted
    accent: pos-2
    priority: 10
  - predicate: 'unit.rank > unit.division_size - 2'
    label: Relegated
    accent: neg-2
    priority: 5
```
