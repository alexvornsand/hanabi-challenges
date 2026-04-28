---
id: expressions
title: Expression Language
sidebar_position: 2
---

# Expression Language

Many DSL fields accept an **expression** — a small inline formula that the platform evaluates at runtime. Expressions appear in predicates, computed values, and guard conditions.

```yaml
# A predicate expression
predicate: 'unit.score >= 10'

# A computed value expression
value: 'item.points * 2'

# A guard condition
conditional_activation: 'unit.division == "A"'
```

---

## Syntax

Expressions use a simple infix syntax. Strings must be quoted with single or double quotes inside the YAML value.

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

The variables available depend on where the expression is used.

### Unit context (`unit.*`)

Available in predicates and award conditions.

| Variable | Type | Description |
|---|---|---|
| `unit.score` | `number` | Unit's total section score. |
| `unit.rank` | `number` | Unit's current rank in their division. |
| `unit.division` | `string` | Division label assigned to this unit. |
| `unit.participated` | `bool` | Whether the unit submitted at least one game. |
| `unit.participants` | `number[]` | User IDs of the unit's members. |

### Slot/item context (`item.*`)

Available in aggregation `value` and `where` expressions.

| Variable | Type | Description |
|---|---|---|
| `item.points` | `number` | Raw points scored in this game. |
| `item.score` | `number` | Normalised score (0–25 for standard Hanabi). |
| `item.max_score` | `bool` | Whether the game was a perfect score. |
| `item.bdr` | `number` | Below-deck ratio. |
| `item.slot_index` | `number` | Zero-based index of this slot in the section. |

### Event context (`event.*`)

| Variable | Type | Description |
|---|---|---|
| `event.id` | `number` | Numeric event ID. |
| `event.slug` | `string` | Event slug. |
| `event.now` | `number` | Current timestamp in milliseconds. |

---

## Built-in functions

### Math

| Function | Description |
|---|---|
| `abs(n)` | Absolute value. |
| `ceil(n)` | Round up to nearest integer. |
| `floor(n)` | Round down to nearest integer. |
| `min(a, b, ...)` | Minimum of arguments. |
| `max(a, b, ...)` | Maximum of arguments. |

### Time

| Function | Description |
|---|---|
| `now()` | Current time as Unix milliseconds. |
| `days(n)` | `n` days expressed in milliseconds. |
| `hours(n)` | `n` hours expressed in milliseconds. |
| `minutes(n)` | `n` minutes expressed in milliseconds. |

```yaml
# Section closes 7 days after it opens
end: 'event.start + days(7)'
```

### Variants

| Function | Description |
|---|---|
| `variant(id)` | Look up a single variant by numeric ID. |
| `variants([id, ...])` | Look up multiple variants. |

### Special values

| Function | Description |
|---|---|
| `bottom_division()` | Sentinel for the lowest division in a P/R system. |

---

## Array methods

When an expression produces an array, you can chain these methods.

| Method | Description |
|---|---|
| `.where(x => ...)` | Filter items by predicate. Also: `.filter(...)`. |
| `.map(x => ...)` | Transform each item. |
| `.any()` / `.any(x => ...)` | True if array is non-empty / any item matches. |
| `.all(x => ...)` | True if all items match predicate. |
| `.count()` | Number of items. |
| `.sum()` | Sum of numeric items. |
| `.avg()` | Average of numeric items. |
| `.min()` / `.max()` | Minimum / maximum of numeric items. |
| `.first()` / `.last()` | First / last item. |
| `.sort()` / `.sort_by(x => ...)` | Sort ascending. |
| `.distinct()` | Deduplicate. Also: `.unique()`. |
| `.includes(v)` | True if value is present. Also: `.contains(v)`. |
| `.flat()` | Flatten one level of nesting. |

```yaml
# True if any slot was perfect
predicate: 'unit.slots.any(s => s.score == 25)'

# Sum of top-3 scores
value: 'unit.slots.map(s => s.score).sort().last(3).sum()'
```

---

## Predicates

The DSL also supports a set of named predicates for common conditions.

| Predicate | Description |
|---|---|
| `stable_partnership` | True when a unit's two participants played together in all submitted games. |

```yaml
classification_rule: 'stable_partnership'
```

---

## YAML control flow

For `conditional_activation` and similar fields, you can also use the YAML control flow form instead of an inline expression string.

```yaml
conditional_activation:
  all:
    - 'unit.score > 0'
    - 'event.stage == "finals"'

conditional_activation:
  any:
    - 'tie_exists_at_rank(1)'
    - 'tie_exists_at_rank(2)'

conditional_activation:
  not: 'unit.eliminated'
```
