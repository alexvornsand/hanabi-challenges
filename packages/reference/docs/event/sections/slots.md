---
title: slots
sidebar_label: slots
---

# `slots`

Slots are the individual game assignments within a section. Each slot produces one seed — a hanab.live game specification — that participants play.

```yaml
slots:
  - seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
  - seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `seed_pattern` | `string` | yes | — | Template for the hanab.live seed. See [seed pattern tokens](#seed-pattern-tokens). |
| `assignment_trigger` | `"eager"` \| `"lazy"` | no | `"eager"` | `"eager"` assigns the spec immediately; `"lazy"` defers it until the trigger fires. |
| `lazy_trigger` | `"completion"` \| `"action"` \| `"admin"` | no | `"completion"` | How a lazy slot is triggered. Only relevant when `assignment_trigger: lazy`. |
| `missing_score_default` | `number` | no | — | Score used when no game is recorded for this slot. |
| `validity_rules` | `ValidityRule[]` | no | `[]` | Rules that must all pass for a submitted game to be accepted. |
| `time_window` | [`TimeWindow`](../time-window) | no | — | Slot-level time restriction. Overrides the section's time window for this slot only. |
| `attempt_modifier` | `object` | no | — | Configures multiple attempts per slot. See [attempt modifier](#attempt-modifier). |

---

## Seed pattern tokens

The `seed_pattern` is a string with `{token}` placeholders that the platform substitutes when generating specs.

| Token | Resolves to |
|---|---|
| `{eventID}` | Numeric event ID |
| `{sectionID}` | Numeric section ID |
| `{slotIndex}` | Zero-based slot index (fixed per slot definition) |
| `{slotIndex*}` | One-based slot index, auto-incremented across lazy triggers |
| `{unitID}` | Scoring unit ID |
| `{teamID}` | Team ID (alias for `unitID` in team events) |
| `{playerCount}` | Number of players derived from registration |
| `{variantID}` | Variant ID (set via `variant_id` field or resolved from dimensions) |
| `{attemptID}` | Attempt number (only valid when `attempt_modifier` is active) |
| `{attemptID*}` | Auto-incrementing attempt number across lazy triggers |

Tokens that are not relevant to the slot's context are left as-is in the seed string.

---

## Lazy slots

A lazy slot is not assigned to participants upfront. Instead, the spec is issued when a trigger fires.

```yaml
slots:
  - seed_pattern: 'p2v0s{eventID}TB{slotIndex*}'
    assignment_trigger: lazy
    lazy_trigger: admin
```

| `lazy_trigger` | Behaviour |
|---|---|
| `completion` | The next slot is issued automatically when the previous slot's game completes. |
| `action` | Issued when a participant triggers it. _(Currently treated as `admin` in V1.)_ |
| `admin` | An organiser manually issues each slot via the admin panel. |

:::note
`lazy_trigger: action` (participant self-service) is a planned future feature. In the current version it behaves identically to `admin`.
:::

---

## Validity rules

Rules that must all pass for a submitted game to count. Each rule has a single field:

| Field | Type | Required | Description |
|---|---|---|---|
| `predicate` | `expr → bool` | yes | Expression evaluated against the submitted game. The submission is rejected if this is `false`. |

```yaml
validity_rules:
  - predicate: 'game.variant.suit_count == 5'
  - predicate: 'game.participants.length == 2'
```

---

## Attempt modifier

Allows a unit to make multiple attempts at a slot. The attempts themselves use the slot's aggregation rules (or a custom aggregation defined here).

```yaml
slots:
  - seed_pattern: 'p2v0s{eventID}g{slotIndex*}'
    attempt_modifier:
      enabled: true
      count: unlimited
      aggregation:
        reduce: max
        over: attempts
        value: 'item.points'
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `enabled` | `bool` | yes | — | Whether multiple attempts are active for this slot. |
| `count` | `number` \| `"unlimited"` | no | `1` | Maximum number of attempts allowed. |
| `aggregation` | [`AggregationFunction`](../aggregation-function) | no | — | How multiple attempt scores are combined. Defaults to the section's aggregation function. |

---

## Generator calls

Instead of defining slots explicitly, you can expand them from a [generator](../../generators/):

```yaml
slots:
  - generator: sequence
    count: 5
    slot:
      seed_pattern: 'p2v0s{eventID}g{i}'
```

See [generators](../../generators/) for the full reference.
