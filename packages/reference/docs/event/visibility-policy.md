---
title: visibility_policy
sidebar_label: visibility_policy
---

# `visibility_policy`

Controls when results and slot specs are visible to participants. [Inheritable](./index#inheritance).

```yaml
visibility_policy:
  results_visible: '"true"'
  specs_visible: '"true"'
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `results_visible` | `expr → bool` | no | `"true"` | Expression evaluated at render time; results are shown when this is `true`. |
| `specs_visible` | `expr → bool` | no | `"true"` | Expression evaluated at render time; slot specs (seeds) are shown when this is `true`. |

Both fields are expressions evaluated in the current event context. They default to the string literal `"true"`, meaning results and specs are always visible.

---

## Hiding results until the section closes

```yaml
visibility_policy:
  results_visible: 'event.section("Main").status == "closed"'
  specs_visible: '"true"'
```

---

## Hiding specs until a unit has registered

```yaml
visibility_policy:
  specs_visible: 'unit.registered'
```

---

## Root defaults

When no `visibility_policy` is declared anywhere in the hierarchy, both fields default to `"true"` — everything is always visible.
