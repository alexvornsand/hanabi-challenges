---
title: aggregation_function
sidebar_label: aggregation_function
---

# `aggregation_function`

Defines how game results within a section are combined into a single score per unit. It sits on `event` or any `section`.

`aggregation_function` is a discriminated union. The shape you choose depends on the `fn` field (for named algorithms) or the presence of `reduce` (for absolute aggregation).

---

## Absolute aggregation

Combines slot results using a reduction operation. Use this for points-based events.

```yaml
aggregation_function:
  reduce: sum
  over: slots
  value: 'item.points'
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `reduce` | `"sum"` \| `"count"` \| `"avg"` \| `"min"` \| `"max"` \| `"first"` \| `"latest"` | yes | — | Reduction operation applied over the result set. |
| `over` | `"slots"` \| `"games"` \| `"attempts"` | no | `"slots"` | What to iterate over when reducing. |
| `value` | `expr → number` | no | `"item.points"` | Expression evaluated per item to extract a numeric value. |
| `where` | `expr → bool` | no | — | Filter applied before reduction; only matching items are included. |
| `sort_by` | `expr` | no | — | Sort items by this expression before applying `take`/`skip`. |
| `sort_direction` | `"ascending"` \| `"descending"` | no | `"descending"` | Direction for `sort_by`. |
| `take` | `number` \| `"unlimited"` | no | `"unlimited"` | Keep only the first N items after sorting. |
| `skip` | `number` | no | `0` | Skip the first N items after sorting. |

```yaml
# Count how many perfect games a unit played
aggregation_function:
  reduce: count
  over: games
  where: 'item.score == 25'

# Best 3 scores out of all slots
aggregation_function:
  reduce: sum
  over: slots
  value: 'item.points'
  sort_by: 'item.points'
  sort_direction: descending
  take: 3
```

---

## `match_aggregate`

Head-to-head scoring: units earn points based on how their game result compares to their opponent's.

```yaml
aggregation_function:
  fn: match_aggregate
  match_comparators:
    - points
  win_points: 3
  draw_points: 1
  loss_points: 0
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `fn` | `"match_aggregate"` | yes | — | Selects this algorithm. |
| `match_comparators` | `ComparatorInput[]` | yes | — | Ordered list of criteria used to determine the winner of each matchup. |
| `win_points` | `number` | no | `3` | Points awarded to the winner. |
| `draw_points` | `number` | no | `1` | Points awarded to each unit in a draw. |
| `loss_points` | `number` | no | `0` | Points awarded to the loser. |
| `tiebreakers` | `string[]` | no | `[]` | Ordered tiebreaker expressions for the final standings. |
| `sequence_by` | `"slot_index"` \| `"timestamp"` \| `"section_position"` | no | — | How matchups are ordered when there are multiple rounds. |

### Comparator shorthands

The following shorthands can be used in `match_comparators` instead of a full comparator object:

| Shorthand | Compares by |
|---|---|
| `points` | Raw points (higher is better) |
| `max_score` | Whether a perfect score was achieved |
| `points_star` | Points starred metric |
| `bdr` | Below-deck ratio (lower is better) |
| `turn_count` | Number of turns taken (lower is better) |
| `strikes` | Number of strikes (lower is better) |
| `elapsed_time` | Wall-clock game duration (lower is better) |

A full comparator object lets you use a custom expression:

```yaml
match_comparators:
  - expr: 'item.score - item.strikes * 3'
    direction: higher
```

---

## `elo`

ELO rating system. Units gain and lose rating based on match outcomes.

```yaml
aggregation_function:
  fn: elo
  initial_rating: 1000
  k_factor: 32
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `fn` | `"elo"` | yes | — | Selects this algorithm. |
| `initial_rating` | `number` | no | `1000` | Starting ELO rating for all units. |
| `k_factor` | `number` | no | `32` | How strongly each result affects the rating. |
| `sequence_by` | `"slot_index"` \| `"timestamp"` \| `"section_position"` | no | — | Order in which games are processed for ELO updates. |

---

## `derived_ranking`

Computes a rank from an expression rather than a raw point total. Use this when the event-level score is derived from section results.

```yaml
aggregation_function:
  fn: derived_ranking
  score: 'unit.best_attempt_score'
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `fn` | `"derived_ranking"` | yes | — | Selects this algorithm. |
| `score` | `expr → number` | yes | — | Expression used to compute the unit's score for ranking. |
| `rank_by` | `string[]` | no | — | Ordered list of expressions used to break ties. |
| `rank_directions` | `("descending"` \| `"ascending")[]` | no | — | Direction for each `rank_by` expression. |
| `sequence_by` | `"slot_index"` \| `"timestamp"` \| `"section_position"` | no | — | Ordering applied when iterating over sub-section results. |

:::note non_participant_result
When `derived_ranking` is used, `non_participant_result` automatically defaults to `"unit.parent_score"` (the unit's inherited score from the parent section) unless explicitly overridden.
:::
