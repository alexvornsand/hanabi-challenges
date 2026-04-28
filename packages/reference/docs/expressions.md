---
title: Expressions
sidebar_label: expressions
---

# Expressions

Many DSL fields accept an **expression** — a small inline formula evaluated by the platform at runtime. Expressions appear in predicates, aggregation values, guard conditions, visibility rules, and more.

```yaml
predicate: 'unit.score >= 25'
value: 'item.points * 2'
conditional_activation: 'unit.division == "A"'
```

Expressions are written as strings inside the YAML value. Use single or double quotes around the whole expression string within YAML.

---

## Syntax

### Literals

| Example | Type |
|---|---|
| `42` | number |
| `3.14` | number |
| `true` / `false` | boolean |
| `"hello"` | string |
| `null` | null |

### Arithmetic

```
unit.score + 10
item.points * 2
(a + b) / c
score % 5
```

### Comparison

```
unit.score >= 25
item.rank == 1
unit.division != "bottom"
```

### Logic

```
unit.score >= 10 and unit.participated
unit.score == 25 or unit.score == 0
not unit.eliminated
```

### Ternary

```
unit.score > 0 ? unit.score : 0
```

### Null coalescing

```
unit.override_score ?? unit.score
```

### Optional chaining

```
unit.team?.captain
```

### Membership (`in`)

```
unit.division in ["A", "B"]
```

---

## Context variables

The variables available depend on where the expression is evaluated.

### Unit context (`unit.*`)

Available in predicates, award conditions, scoreboard rank expressions, and row style predicates.

| Variable | Type | Description |
|---|---|---|
| `unit.score` | `number` | Unit's total section score. |
| `unit.rank` | `number` | Unit's rank within their division. |
| `unit.division` | `string` | Division label assigned to this unit. |
| `unit.participated` | `bool` | Whether the unit submitted at least one game. |
| `unit.participants` | `number[]` | User IDs of the unit's members. |
| `unit.parent_score` | `number` | Score inherited from the parent section (used in nested sections). |
| `unit.section_scores` | `Record<string, number>` | Scores per section, keyed by section name. |
| `unit.section_ranks` | `Record<string, number>` | Ranks per section, keyed by section name. |
| `unit.slot_results` | `SlotResult[]` | Per-slot result data. |
| `unit.promotion_status` | `string \| null` | `"promoted"`, `"relegated"`, `"stayed"`, or null. |

### Game/item context (`item.*`, `game.*`)

Available in aggregation `value` and `where` expressions.

| Variable | Type | Description |
|---|---|---|
| `item.points` | `number` | Raw points scored in this game. |
| `item.score` | `number` | Normalised score (0–25 for standard Hanabi). |
| `item.max_score` | `bool` | Whether the game was a perfect score. |
| `item.bdr` | `number` | Below-deck ratio. |
| `item.turn_count` | `number` | Number of turns taken. |
| `item.strikes` | `number` | Number of strikes. |
| `item.elapsed_time` | `number` | Wall-clock duration in milliseconds. |
| `item.slot_index` | `number` | Zero-based index of this slot in the section. |
| `item.variant` | `VariantInfo` | Variant metadata (id, name, suit_count, max_score). |

### Event context (`event.*`)

| Variable | Type | Description |
|---|---|---|
| `event.id` | `number` | Numeric event ID. |
| `event.slug` | `string` | Event slug. |
| `event.status` | `string` | Event status (`"draft"`, `"published"`, `"closed"`). |

---

## Built-in functions

### Math

| Function | Description |
|---|---|
| `abs(n)` | Absolute value. |
| `ceil(n)` | Round up. |
| `floor(n)` | Round down. |
| `min(a, b, ...)` | Minimum of arguments. |
| `max(a, b, ...)` | Maximum of arguments. |

### Time

| Function | Description |
|---|---|
| `now()` | Current time as Unix milliseconds. |
| `days(n)` | `n` days in milliseconds. |
| `hours(n)` | `n` hours in milliseconds. |
| `minutes(n)` | `n` minutes in milliseconds. |

```yaml
# Section closes 7 days after it opens
end: 'event.start + days(7)'
```

### Variants

| Function | Description |
|---|---|
| `variant(id)` | Look up a single variant by numeric ID. Returns a `VariantInfo` object. |
| `variants([id, ...])` | Look up multiple variants. |

### Division system

| Function | Description |
|---|---|
| `bottom_division()` | Sentinel for the lowest division in a P/R system. Use in `absence_policy.floor`. |

---

## Array methods

When an expression produces a list, you can chain these methods.

| Method | Description |
|---|---|
| `.where(x => ...)` | Filter items. Also `.filter(...)`. |
| `.map(x => ...)` | Transform each item. |
| `.any()` / `.any(x => ...)` | True if non-empty / any item matches. |
| `.all(x => ...)` | True if all items match. |
| `.count()` | Number of items. |
| `.sum()` | Sum of numeric items. |
| `.avg()` | Average of numeric items. |
| `.min()` / `.max()` | Minimum / maximum. |
| `.first()` / `.last()` | First / last item. |
| `.sort_by(x => ...)` | Sort ascending by expression. |
| `.distinct()` | Deduplicate. Also `.unique()`. |
| `.includes(v)` | True if value is present. Also `.contains(v)`. |
| `.flat()` | Flatten one level of nesting. |

```yaml
# True if any slot was a perfect score
predicate: 'unit.slot_results.any(s => s.score == 25)'

# Sum of the top 3 slot scores
value: 'unit.slot_results.map(s => s.score).sort_by(x => x).last(3).sum()'
```

---

## Named predicates

Instead of an expression string, some fields also accept a named predicate object for common patterns.

| Predicate | Description |
|---|---|
| `stable_partnership` | True when a unit's two participants played together in every submitted game. |

```yaml
awards:
  - name: Partners
    predicate:
      stable_partnership: true
    badge:
      primary_text: Partners
      colour: blue-5
```

---

## YAML control flow

For boolean fields like `conditional_activation`, you can also use structured YAML instead of an expression string:

```yaml
conditional_activation:
  all:
    - 'unit.score > 0'
    - 'event.stage == "finals"'

conditional_activation:
  any:
    - 'unit.rank == 1'
    - 'unit.max_score_count >= 3'

conditional_activation:
  not: 'unit.eliminated'
```
