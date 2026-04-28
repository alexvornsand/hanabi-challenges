---
title: absence_policy
sidebar_label: absence_policy
---

# `absence_policy`

Defines how the platform handles units that miss a round in an event with a [promotion/relegation](./promotion-relegation) system. Root-only.

```yaml
absence_policy:
  demotion: '1'
  floor: bottom
  overflow: waiting_list
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `demotion` | `string` | yes | — | Expression or constant: number of divisions to demote an absent unit. |
| `floor` | `string` \| `"bottom"` \| `null` | no | — | The lowest division an absence penalty can push a unit to. `"bottom"` means the absolute lowest division. `null` means no floor. |
| `overflow` | `"waiting_list"` \| `"unranked"` \| `"discard"` | no | — | What happens to units that would be demoted below the floor. |

---

## `overflow` values

| Value | Description |
|---|---|
| `waiting_list` | Units pushed below the floor are placed on a waiting list and re-enter if a spot opens. |
| `unranked` | Units are retained but removed from the ranked ladder. |
| `discard` | Units are removed from the event entirely. |

---

## Example

```yaml
absence_policy:
  demotion: '2'         # absent units drop two divisions
  floor: Division 5     # no unit can be demoted below Division 5
  overflow: waiting_list
```
