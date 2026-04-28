---
title: Bracket generators
sidebar_label: Bracket generators
---

# Bracket generators

The platform has four built-in bracket structures that expand into a full tree of matchup sections automatically. They are invoked by setting the `fn` field inside a generator's `value`.

---

## Common parameters

All bracket generators accept a shared set of parameters via `BracketParams`:

| Field | Type | Required | Description |
|---|---|---|---|
| `match_comparators` | `ComparatorInput[]` | yes | Criteria used to determine the winner of each matchup. See [comparator shorthands](../event/aggregation-function#comparator-shorthands). |
| `slots` | `number` \| `string` | yes | Number of game slots per matchup, or an expression for a dynamic count. |
| `assignment` | `number` \| `"dynamic"` \| `"admin"` | yes | How many matchups each unit plays per round, or `"dynamic"` / `"admin"` to defer. |

---

## `single_elimination`

Standard knock-out bracket. Losers are eliminated immediately; the undefeated unit wins.

```yaml
generators:
  knockout:
    returns: list[section]
    params:
      unit_count: number
    value:
      fn: single_elimination
      match_comparators:
        - points
      slots: 1
      assignment: 1
```

The generator produces `ceil(log2(unit_count))` rounds, each with the appropriate number of matchups. Section names follow the pattern `R{round}-M{matchup}`.

Routing is wired automatically:
- Winner advances to `R{round+1}-M{ceil(matchup/2)}`
- Loser is eliminated
- Final winner is assigned rank 1, runner-up rank 2

---

## `double_elimination`

Each unit must lose twice to be eliminated. Losers from the winners bracket drop to a losers bracket; the losers bracket winner meets the winners bracket winner in a grand final.

```yaml
generators:
  de_bracket:
    returns: list[section]
    value:
      fn: double_elimination
      match_comparators:
        - points
      slots: 1
      assignment: 1
```

Section naming: winners bracket sections are `W{round}-M{matchup}`, losers bracket sections are `L{round}-M{matchup}`, and the grand final is `Grand-Final`.

---

## `stepladder`

A N-1 chain of matches starting from the lowest seeds. The loser of each match is assigned a final rank; the winner plays the next-highest seed. Used for small final brackets (e.g. top 4 or top 6).

```yaml
generators:
  top4:
    returns: list[section]
    value:
      fn: stepladder
      match_comparators:
        - points
      slots: 1
      assignment: 1
```

Sections are named `Step1`, `Step2`, etc. The final step's winner is assigned rank 1.

---

## `round_robin`

Every unit plays every other unit exactly once. Standings are derived from match points accumulated across all matchups.

```yaml
generators:
  rr:
    returns: list[section]
    params:
      unit_count: number
    value:
      fn: round_robin
      match_comparators:
        - points
      slots: 1
      assignment: dynamic
      win_points: 3
      draw_points: 1
      loss_points: 0
      tiebreakers:
        - 'unit.match_wins'
```

In addition to `BracketParams`, `round_robin` accepts:

| Field | Type | Default | Description |
|---|---|---|---|
| `win_points` | `number` | `3` | Match points for a win. |
| `draw_points` | `number` | `1` | Match points for a draw. |
| `loss_points` | `number` | `0` | Match points for a loss. |
| `tiebreakers` | `string[]` | `["unit.match_wins"]` | Ordered tiebreaker expressions for the standings section. |

The generator produces one section per matchup (`RR-M1`, `RR-M2`, …) plus a final `RR-Standings` section that aggregates match points using `derived_ranking`.

---

## Deferred slot count

When `slots` is set to an expression string rather than a number, the generator records a `deferred_slot_count` on each matchup section. The platform resolves the actual count at runtime when the matchup activates.

```yaml
value:
  fn: single_elimination
  match_comparators:
    - points
  slots: 'unit.best_of'   # resolved per matchup at runtime
  assignment: 1
```
