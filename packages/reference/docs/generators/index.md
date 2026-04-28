---
title: generators
sidebar_label: generators
---

# `generators`

The `generators` key defines reusable named templates that can be expanded into slots or sections. Instead of listing every slot or section explicitly, you define a generator once and reference it from a section with a generator call.

```yaml
generators:
  round_robin:
    returns: list[section]
    params:
      unit_count: number
    value:
      fn: round_robin
      slots: 1
      match_comparators:
        - points

event:
  sections:
    - name: Main
      sections:
        - generator: round_robin
          unit_count: 8
```

---

## Defining a generator

Each key under `generators` is the generator's name. The value is a `GeneratorDeclaration`:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `returns` | `"slot"` \| `"list[slot]"` \| `"section"` \| `"list[section]"` \| `"scoreboard"` \| `"badge"` | yes | — | The type of thing this generator produces. |
| `params` | `Record<string, string>` | no | — | Named parameters accepted by this generator. Keys are param names, values are type hints. |
| `value` | `object` | yes | — | The generator body. Shape depends on `returns` and the generator function. |

---

## Calling a generator

To use a generator, replace an item in `slots` or `sections` with a generator call:

```yaml
sections:
  - generator: my_generator
    param_name: value
```

The `generator` key names the generator to expand. All other keys are passed as parameters.

---

## Built-in generators

The platform includes two built-in generator functions that do not need to be declared under `generators` — they are invoked directly by name in a generator call.

### `sequence`

Expands a fixed number of identical slots, with loop variable substitution.

```yaml
slots:
  - generator: sequence
    count: 5
    slot:
      seed_pattern: 'p2v0s{eventID}g{i}'
```

| Field | Type | Description |
|---|---|---|
| `count` | `number` \| `"admin"` | Number of slots to generate. `"admin"` defers to an admin sequence trigger. |
| `slot` / `template` | `SlotConfig` | Slot template. `{i}` and `{index}` are substituted with the loop index. |

### `on_trigger`

Creates a deferred slot that is issued when a trigger fires at runtime.

```yaml
slots:
  - generator: on_trigger
    trigger: attempt_start
    slot:
      seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
```

| Field | Type | Description |
|---|---|---|
| `trigger` | `"attempt_start"` \| `"bracket_activation"` \| `"admin"` | The event that causes the slot to be issued. |
| `slot` / `template` | `SlotConfig` | Template for the issued slot. |

---

## Bracket and structured generators

For elimination brackets, round-robins, and stepladders, see [bracket generators](./bracket-generators).

For lazy slot chaining, see [lazy slots](./lazy-slots).
