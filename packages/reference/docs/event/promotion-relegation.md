---
title: promotion_relegation
sidebar_label: promotion_relegation
---

# `promotion_relegation`

Configures the division promotion and relegation system for a ladder-style event. Root-only.

```yaml
promotion_relegation:
  fn: carry_balanced
  target_size: 8
  standard_promotions: 2
  standard_relegations: 2
  bottom_division: dynamic
  clamp: false
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `fn` | `"carry_balanced"` \| `string` | yes | — | The P/R algorithm to use. `"carry_balanced"` is the built-in balanced carry algorithm. |
| `target_size` | `number` | yes | — | Target number of units per division after promotion/relegation. |
| `standard_promotions` | `number` \| `string` | yes | — | Number of units promoted each season under normal conditions. Can be an expression. |
| `standard_relegations` | `number` \| `string` | yes | — | Number of units relegated each season under normal conditions. Can be an expression. |
| `bottom_division` | `string` \| `"dynamic"` | yes | — | Name of the lowest division. `"dynamic"` lets the platform determine it based on participation. |
| `clamp` | `bool` | no | `false` | When `true`, prevents units at the top division from over-promoting (their promotion is capped). |

---

## `carry_balanced`

The built-in algorithm balances division sizes across seasons by adjusting the number of promotions and relegations when divisions are over- or under-sized relative to `target_size`.

---

## `bottom_division: "dynamic"`

When set to `"dynamic"`, the lowest division is determined at runtime based on how many units are registered. Use this when the number of divisions is not known in advance.

Alternatively, reference the special `bottom_division()` function in [expressions](../expressions) to target the bottom division symbolically:

```yaml
absence_policy:
  floor: 'bottom_division()'
```
