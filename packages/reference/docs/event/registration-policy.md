---
title: registration_policy
sidebar_label: registration_policy
---

# `registration_policy`

Controls how participants register for the event or a section. [Inheritable](./index#inheritance).

```yaml
registration_policy:
  implicit: true
  explicit: false
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `implicit` | `bool` | no | `true` | Automatically register a unit the first time it submits a game. |
| `explicit` | `bool` | no | `false` | Require participants to opt in via the registration UI before playing. |
| `transition` | `expr → bool` | no | — | When true, switches from `explicit` to `implicit` (or vice versa) mid-event. |
| `pool_units_allowed` | `bool` | no | `false` | Allow pool-unit registration — carrying a pre-formed team over from a previous event. |

---

## Root defaults

```yaml
registration_policy:
  implicit: true
  explicit: false
  pool_units_allowed: false
```

By default, any unit that plays a game is automatically registered. Explicit registration must be opted into.

---

## `implicit` vs `explicit`

These two modes are mutually exclusive in practice. Setting both to `true` is technically allowed but `explicit` takes precedence.

- **`implicit: true`** — suitable for open events where anyone can participate by playing.
- **`explicit: true`** — suitable for invite-only events or events where participants must declare their intent before playing (e.g. variant-based events where seeds are assigned upfront).

```yaml
# Open event — anyone can play
registration_policy:
  implicit: true

# Organised event — teams register first
registration_policy:
  explicit: true
```

---

## `pool_units_allowed`

Allows participants to register as a pre-formed team that played together in a previous event, rather than forming a new team for this one. Requires the event to use `scoring_unit_type: team`.

```yaml
registration_policy:
  explicit: true
  pool_units_allowed: true
```
