---
title: advancement
sidebar_label: advancement
---

# `advancement`

Determines whether and how units advance out of a section when it concludes. Used in multi-section events where progression between phases is conditional.

```yaml
advancement:
  predicate: 'unit.rank <= 8'
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `predicate` | `expr → bool` \| `"admin"` | yes | — | Expression evaluated per unit. Units where this is `true` advance; others do not. `"admin"` defers the advancement decision to an organiser. |

---

## How it relates to `routing`

`advancement` is a simple binary gate: a unit either advances or it doesn't. For more complex outcomes — sending different units to different sections, assigning explicit ranks, or handling conditional branching — use [`routing`](./routing) instead.

```yaml
# Simple advancement: top 8 proceed
advancement:
  predicate: 'unit.rank <= 8'

# Conditional routing: top 4 to semifinals, 5-8 to consolation
routing:
  top_4:
    when: 'unit.rank <= 4'
    proceeds_to: Semifinals
  consolation:
    when: 'unit.rank <= 8'
    proceeds_to: Consolation
  eliminated:
    eliminated: true
```

---

## The `"admin"` sentinel

Setting `predicate: admin` lets an organiser make advancement decisions manually for each unit via the admin panel after the section closes.

```yaml
advancement:
  predicate: admin
```
