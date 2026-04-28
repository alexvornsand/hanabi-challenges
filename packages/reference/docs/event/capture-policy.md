---
title: capture_policy
sidebar_label: capture_policy
---

# `capture_policy`

Controls which game capture methods the platform accepts for this section. [Inheritable](./index#inheritance).

```yaml
capture_policy:
  submit: true
  scrape: false
```

---

## Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `submit` | `bool` | no | `true` | Accept manually submitted game results. |
| `scrape` | `bool` | no | `false` | Accept games automatically scraped from hanab.live. |
| `scrape_schedule` | `"daily"` \| `"hourly"` \| `"on_demand"` | no | — | How often the scraper runs when `scrape: true`. |
| `transition` | `expr → bool` | no | — | When this expression evaluates to `true`, capture mode switches from `scrape` to `submit`. |

---

## Root defaults

When no `capture_policy` is set anywhere in the hierarchy, the platform defaults to:

```yaml
capture_policy:
  submit: true
  scrape: false
```

Scraping is **off** by default. You must explicitly opt in.

---

## Transition

The `transition` field lets an event start with scraping and switch to manual submission once a condition is met — typically when the event reaches a later stage.

```yaml
capture_policy:
  scrape: true
  submit: false
  transition: 'event.stage == "finals"'
```

Once the expression becomes `true`, the platform treats the section as `submit: true, scrape: false` going forward.

---

## Inheritance

Set `capture_policy` on `event` to apply it to all sections. Override it on any individual section to change behaviour for just that section.

```yaml
event:
  capture_policy:
    scrape: true       # most sections scrape
  sections:
    - name: Finals
      capture_policy:
        submit: true   # finals are submitted manually
        scrape: false
```
