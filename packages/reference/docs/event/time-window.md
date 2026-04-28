---
title: time_window
sidebar_label: time_window
---

# `time_window`

Defines the active time range during which a section accepts game submissions. Both fields are optional — omitting them leaves the window unbounded on that end.

`time_window` is [inheritable](./index#inheritance): set it on `event` and every section inherits it unless the section sets its own.

```yaml
time_window:
  start: '2024-06-01T00:00:00Z'
  end: '2024-06-07T23:59:59Z'
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `start` | `ISO8601` \| `"admin"` | no | — | The section opens at this datetime. `"admin"` defers the open time to an organiser action. |
| `end` | `ISO8601` \| `"admin"` | no | — | The section closes at this datetime. `"admin"` defers the close time to an organiser action. |

---

## The `"admin"` sentinel

Either field can be set to the string `"admin"` instead of a timestamp. This defers the value to an organiser, who can set it via the admin panel after the event is published.

```yaml
time_window:
  start: '2024-06-01T00:00:00Z'
  end: admin   # organiser closes the section manually
```

---

## Inheritance

If a child section does not declare `time_window`, it inherits the parent's value. If the event itself does not declare one, the root default is `{}` — no bounds on either end.

To restrict a specific section to a sub-window while the rest of the event uses a broader range, declare `time_window` directly on that section.

```yaml
event:
  time_window:
    start: '2024-06-01T00:00:00Z'
    end: '2024-06-30T23:59:59Z'
  sections:
    - name: Week 1
      time_window:
        start: '2024-06-01T00:00:00Z'
        end: '2024-06-07T23:59:59Z'
    - name: Week 2
      time_window:
        start: '2024-06-08T00:00:00Z'
        end: '2024-06-14T23:59:59Z'
```
