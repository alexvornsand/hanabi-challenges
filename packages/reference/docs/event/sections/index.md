---
title: sections
sidebar_label: sections
---

# `sections`

A section is one phase of a competition — a named container that holds slots, awards, and scoreboards, and defines how its participants are scored. Sections live under `event` (or under other sections for multi-phase nesting).

```yaml
sections:
  - name: Qualifying
    scoring_unit_type: individual
    aggregation_function:
      reduce: sum
      over: slots
      value: 'item.points'
    slots:
      - seed_pattern: 'p2v0s{eventID}q{slotIndex*}'
```

---

## Fields

Sections share the same field set as [`event`](../index) — `event` is itself a section (the root section). All fields documented on the `event` page apply here too. The differences are:

| Difference | Detail |
|---|---|
| `name` is not strictly required | But should always be provided; the platform uses it for display and cross-references. |
| `slug` is optional | Sections do not require a URL-safe identifier the way events do. |
| Root-only fields are disallowed | `dimensions`, `absence_policy`, `promotion_relegation`, and `organisers` produce an error if placed on a child section. |

---

## Inheritance

Six fields cascade from parent to child automatically. If a section does not declare a field, it inherits the value from its parent (or from the event-level default if no ancestor sets it). See [Inheritance](../index#inheritance) for the full list.

```yaml
event:
  capture_policy:
    scrape: true        # inherited by all sections below
  sections:
    - name: Week 1      # inherits scrape: true
      ...
    - name: Finals
      capture_policy:
        submit: true    # overrides the inherited value
        scrape: false
```

---

## Nesting

Sections can contain other sections. This is how multi-phase events are expressed: the outer section acts as a container and the inner sections are the active competition phases.

```yaml
sections:
  - name: Group Stage
    sections:
      - name: Group A
        slots: [...]
      - name: Group B
        slots: [...]
  - name: Knockout
    sections:
      - name: Semifinals
        slots: [...]
      - name: Final
        slots: [...]
```

---

## Children

| Field | Description |
|---|---|
| [`slots`](./slots) | Game slot definitions for this section. |
| [`awards`](./awards) | Awards granted to units meeting defined criteria. |
| [`scoreboards`](./scoreboards) | Scoreboard view definitions. |

---

## Generator calls

Instead of writing a section explicitly, you can expand one from a [generator](../../generators/):

```yaml
sections:
  - generator: round_robin
    unit_count: 8
```

See [generators](../../generators/) for the full reference.
