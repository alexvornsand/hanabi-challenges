---
title: Lazy slots
sidebar_label: Lazy slots
---

# Lazy slots

A lazy slot is a slot whose game spec is not issued upfront. Instead, the spec is created when a trigger fires — either automatically on completion, at a participant's action, or when an organiser manually issues it.

Lazy slots are useful when the total number of games a unit will play is not known in advance: open-ended events, timed gauntlets, admin-paced sequences.

---

## Configuring a lazy slot

Set `assignment_trigger: lazy` on any slot. The `lazy_trigger` field controls what fires it.

```yaml
slots:
  - seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
    assignment_trigger: lazy
    lazy_trigger: completion
```

| `lazy_trigger` | Behaviour |
|---|---|
| `completion` | The next slot is issued automatically when the previous slot's game completes. Chains indefinitely. |
| `action` | Issued when a participant triggers it. _(Currently treated as `admin` in V1.)_ |
| `admin` | An organiser issues each slot manually via the admin panel. |

:::note
`lazy_trigger: action` (participant self-service) is a planned future feature. It currently behaves identically to `admin`.
:::

---

## Using `{slotIndex*}` in seed patterns

The `{slotIndex*}` token auto-increments across lazy trigger events for a given unit. Each time a new slot is issued for a unit, the token resolves to the next integer in that unit's sequence.

```yaml
# First issued slot → p2v0s42a1
# Second issued slot → p2v0s42a2
# ...
seed_pattern: 'p2v0s{eventID}a{slotIndex*}'
```

---

## `generator: on_trigger`

The `on_trigger` built-in generator is the generator-call equivalent of a lazy slot. It produces a deferred slot generator rather than a concrete slot at expand time.

```yaml
slots:
  - generator: on_trigger
    trigger: attempt_start
    slot:
      seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
```

`trigger` maps to the same values as `lazy_trigger`:

| Value | Description |
|---|---|
| `attempt_start` | Slot is issued when a unit starts a new attempt. |
| `bracket_activation` | Slot is issued when a bracket matchup becomes active. |
| `admin` | Slot is issued by an organiser action. |

---

## `generator: sequence` with `count: admin`

A `sequence` generator with `count: admin` creates an open-ended admin-paced sequence of slots. The organiser issues them one at a time via the admin panel.

```yaml
slots:
  - generator: sequence
    count: admin
    slot:
      seed_pattern: 'p2v0s{eventID}r{i}'
```

This is equivalent to a single lazy slot with `lazy_trigger: admin`, but allows a named template to be reused.

---

## Attempt modifier with lazy chaining

The most common pattern for a gauntlet-style event is to combine `attempt_modifier` on a section with `assignment_trigger: lazy` and `lazy_trigger: completion` — giving each unit an unbounded sequence of auto-chained attempts:

```yaml
sections:
  - name: Gauntlet
    aggregation_function:
      reduce: max
      over: attempts
      value: 'item.points'
    slots:
      - seed_pattern: 'p{playerCount}v{variantID}s{teamID}a{attemptID*}'
        assignment_trigger: lazy
        lazy_trigger: completion
        attempt_modifier:
          enabled: true
          count: unlimited
```
