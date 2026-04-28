---
id: generators
title: Generators
sidebar_position: 3
---

# Generators

Generators are reusable slot templates. Instead of listing every slot explicitly, you define a generator once and reference it from a section. The platform expands it into the full set of slot specifications at publish time.

---

## Defining a generator

Generators live under the top-level `generators` key.

```yaml
generators:
  - name: round_robin
    trigger_type: admin_sequence
    slot_template:
      seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
      variant_id: 1
      missing_score_default: 0
```

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Name used to reference this generator from a section. |
| `trigger_type` | `"attempt_start"` \| `"bracket_activation"` \| `"admin_sequence"` | How slots from this generator are triggered. |
| `slot_template` | `object` | Template for each generated slot. Accepts the same fields as a static slot. |

---

## Referencing a generator

In a section's `slots` list, use the `generator` field instead of `seed_pattern`.

```yaml
sections:
  - name: Finals
    slots:
      - generator: round_robin
```

---

## Trigger types

### `attempt_start`

A new slot is created each time a unit starts a game attempt. Used for open-ended events where participants can play as many games as they want.

### `bracket_activation`

Slots are created when a matchup bracket node becomes active. Used for single or double elimination brackets.

### `admin_sequence`

Slots are issued one at a time by an organiser pressing "Issue next slot" in the admin panel. Used for round-by-round competition where the organiser controls pacing.

---

## Bracket generators

For elimination bracket structures, the platform provides a built-in bracket expander.

```yaml
generators:
  - name: bracket
    trigger_type: bracket_activation
    bracket:
      format: single_elimination
      seeding: ranked
      size: 8
    slot_template:
      seed_pattern: 'p2v0s{eventID}m{matchID}g{gameIndex*}'
```

| Field | Type | Description |
|---|---|---|
| `bracket.format` | `"single_elimination"` \| `"double_elimination"` | Bracket format. |
| `bracket.seeding` | `"ranked"` \| `"random"` | How units are seeded into bracket positions. |
| `bracket.size` | `number` | Number of bracket positions (must be a power of 2). |

---

## Lazy slots

Individual slots (not just generator-based slots) can also be made lazy — issued on demand rather than all at once.

```yaml
slots:
  - seed_pattern: 'p2v0s{eventID}TB{slotIndex*}'
    assignment_trigger: lazy
    lazy_trigger: admin   # organiser presses a button
```

| `lazy_trigger` value | Behaviour |
|---|---|
| `completion` | Next slot is issued automatically when the previous one completes. |
| `action` | Next slot is issued when a participant triggers it. _(treated as `admin` in V1)_ |
| `admin` | Organiser manually issues each slot via the admin panel. |

:::note Deferred
`lazy_trigger: action` is treated identically to `admin` in the current version. Self-service triggering by participants is a planned future feature.
:::
