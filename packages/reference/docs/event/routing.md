---
title: routing
sidebar_label: routing
---

# `routing`

Fine-grained rules that control where each unit goes after a section concludes. More expressive than [`advancement`](./advancement): routing can send different units to different sections, assign explicit final ranks, or eliminate units from the competition.

`routing` is a map of named rules. Keys are arbitrary labels; the platform evaluates each rule's `when` condition (or applies it unconditionally) to determine which rule applies to a given unit.

```yaml
routing:
  winner:
    proceeds_to: Grand Final
  eliminated:
    eliminated: true
```

---

## Rule variants

### `proceeds_to`

Sends the unit to a named section.

```yaml
routing:
  advance:
    proceeds_to: Semifinals
```

| Field | Type | Required | Description |
|---|---|---|---|
| `proceeds_to` | `string` | yes | Name of the destination section. Must match a section defined in the event. |

---

### `eliminated`

Removes the unit from the competition. No further sections are played.

```yaml
routing:
  out:
    eliminated: true
```

---

### `assigned_rank`

Assigns the unit a specific final rank rather than routing it to another section.

```yaml
routing:
  third_place:
    assigned_rank: 3
```

| Field | Type | Required | Description |
|---|---|---|---|
| `assigned_rank` | `number` \| `string` | yes | The rank to assign. Can be a number or an expression string. |

---

### `assigned_to`

Places the unit at a specific position in a named section (e.g. a seeded bracket position).

```yaml
routing:
  seeded:
    assigned_to:
      section: Finals Bracket
      position: 'unit.rank'
```

| Field | Type | Required | Description |
|---|---|---|---|
| `assigned_to.section` | `string` | yes | Name of the destination section. |
| `assigned_to.position` | `string` | yes | Expression determining the unit's position within that section. |

---

### Conditional routing (`when`)

Any rule can be made conditional with a `when` field. The platform evaluates rules in order and applies the first one whose `when` is `true`. An `otherwise` clause handles the fallthrough case.

```yaml
routing:
  top_cut:
    when: 'unit.rank <= 4'
    proceeds_to: Top 4
  consolation:
    when: 'unit.rank <= 8'
    proceeds_to: Consolation
  out:
    eliminated: true
```

| Field | Type | Required | Description |
|---|---|---|---|
| `when` | `expr → bool` | yes | Condition under which this rule applies. |
| `proceeds_to` | `string` | no | Destination section if `when` is `true`. |
| `assigned_rank` | `number` \| `string` | no | Rank to assign if `when` is `true`. |
| `otherwise` | `RoutingRule` | no | Rule to apply if `when` is `false`. Can itself be conditional. |

---

## Validation

The platform validates that all `proceeds_to` and `assigned_to.section` values reference sections that exist in the event tree. An `unresolved_reference` error is emitted if they do not.
