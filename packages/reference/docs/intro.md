---
id: intro
title: Introduction
sidebar_position: 1
slug: /
---

# Hanabi Challenges — Reference

This reference covers everything you need to configure and run events on the Hanabi Challenges platform.

## What is the DSL?

Event configuration is written in YAML using the Hanabi DSL — a declarative format for describing how an event is structured, scored, and displayed.

A minimal event looks like this:

```yaml
event:
  name: My Event
  slug: my-event
  scoring_unit_type: individual
  sections:
    - name: Main
      aggregation_function:
        reduce: sum
        over: slots
        value: 'item.points'
      slots:
        - seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
```

## Structure

An event config has three top-level concerns:

| Section | Purpose |
|---|---|
| **`event`** | Identity, dimensions, registration and capture policies |
| **`sections`** | One or more competition phases, each with their own scoring and slots |
| **`generators`** | Reusable slot templates for bracket or ladder structures |

## Navigation

- **[Fields](dsl/fields)** — every YAML field, its type, and its default
- **[Expressions](dsl/expressions)** — the expression language used in predicates and computed values
- **[Generators](dsl/generators)** — how bracket and sequence generators work
- **[Examples](examples/nvc)** — annotated real-world event configs
