---
title: Introduction
sidebar_position: 1
slug: /
---

# Hanabi Challenges — Reference

Event configuration is written in YAML using the Hanabi DSL. Every event config has two possible top-level keys:

```yaml
event:   # required — defines the event
  ...

generators:  # optional — reusable slot templates
  ...
```

## Minimal example

```yaml
event:
  name: My Event
  slug: my-event
  sections:
    - name: Main
      aggregation_function:
        reduce: sum
        over: slots
        value: 'item.points'
      slots:
        - seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
```

## Navigation

- **[event](event/)** — the root config object; all fields, sub-objects, and children
- **[generators](generators/)** — reusable slot and section templates
- **[Expressions](expressions)** — the expression language used in predicates, aggregations, and computed values
- **[Examples](examples/nvc)** — annotated real-world event configs
