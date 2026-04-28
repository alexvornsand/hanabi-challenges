---
id: fields
title: Field Reference
sidebar_position: 1
---

# Field Reference

All YAML fields recognised by the DSL. Fields marked **required** have no default.

---

## Event / Section level

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | required | Display name of the event or section. |
| `slug` | `string` | required | URL-safe identifier. Must be unique across all events. |
| `scoring_unit_type` | `"individual"` \| `"team"` \| `"inferred"` | `individual` | How scoring units are determined. |
| `organisers` | `string[]` | `[]` | Platform display names of users who can manage this event. |
| `classification_rule` | `expr → string` | — | Expression evaluated per unit to assign a classification label. |
| `conditional_activation` | `expr → bool` | — | Guard expression; section activates only when true. |
| `non_participant_result` | `expr → number` | `0` | Score used for units that did not participate. |

---

## Aggregation function

Controls how individual game results are combined into a section score.

| Field | Type | Default | Description |
|---|---|---|---|
| `aggregation_function` | `object` | required | Aggregation configuration block. |
| `reduce` | `"sum"` \| `"count"` \| `"avg"` \| `"max"` \| `"min"` | required | Reduction operation applied over the set of slot results. |
| `over` | `"slots"` \| `"games"` | `slots` | What to iterate over. |
| `value` | `expr` | — | Expression evaluated per item to extract a numeric value. |
| `where` | `expr → bool` | — | Filter applied before reduction. |
| `fn` | `"match_aggregate"` \| `"elo"` \| `"derived_ranking"` | — | Alternative: named aggregation algorithm. |
| `rank_by` | `string` | — | Expression or field name used for ranking (with `fn`). |
| `tiebreak` | `string[]` | `[]` | Ordered list of tiebreaker expressions. |

```yaml
# Simple sum of slot scores
aggregation_function:
  reduce: sum
  over: slots
  value: 'item.points'

# Count of perfect scores
aggregation_function:
  reduce: count
  over: slots
  where: 'item.score == 25'

# Match-based head-to-head
aggregation_function:
  fn: match_aggregate
  match_comparators:
    - points
  sequence_by: slot_index
```

---

## Capture policy

| Field | Type | Default | Description |
|---|---|---|---|
| `capture_policy` | `object` | — | Controls which game capture methods are accepted. |
| `submit` | `bool` | `true` | Allow manual game submission. |
| `scrape` | `bool` | `true` | Allow automatic scraping from hanab.live. |
| `scrape_schedule` | `"daily"` \| `"on_demand"` | — | How often scraping runs. |
| `transition` | `expr → bool` | — | When true, switches capture mode from scrape to submit. |

---

## Registration policy

| Field | Type | Default | Description |
|---|---|---|---|
| `registration_policy` | `object` | — | Controls how players register for a section. |
| `implicit` | `bool` | `true` | Auto-register players on first game submission. |
| `explicit` | `bool` | `false` | Require explicit opt-in registration. |
| `pool_units_allowed` | `bool` | `false` | Allow pool-unit registration (carry-over teams). |

---

## Time window

| Field | Type | Default | Description |
|---|---|---|---|
| `time_window` | `object` | — | Active time window for this section. |
| `start` | `ISO8601` \| `"admin"` | `"admin"` | Section opens at this datetime. `"admin"` defers to organiser. |
| `end` | `ISO8601` \| `"admin"` | — | Section closes at this datetime. `"admin"` defers to organiser. |

```yaml
time_window:
  start: '2024-01-01T00:00:00Z'
  end: '2024-01-07T23:59:59Z'
```

---

## Dimensions

Dimensions let an event track multiple parallel registration categories (e.g. player count classes).

| Field | Type | Default | Description |
|---|---|---|---|
| `dimensions` | `Dimension[]` | `[]` | List of dimension axes. |
| `axis` | `string` | required | Identifier for this dimension (e.g. `player_count_class`). |
| `values` | `string[]` | required | Allowed values for this axis. |
| `registration_cardinality` | `"single"` \| `"multiple"` | `single` | Whether a unit can register under multiple values. |

---

## Matchmaking

| Field | Type | Default | Description |
|---|---|---|---|
| `matchmaking` | `object` | — | Controls how units are paired for slots. |
| `type` | `"none"` \| `"manual"` \| `"algorithmic"` | `none` | Matchmaking strategy. |
| `assignment` | `"static"` \| `"dynamic"` | — | Whether assignments are fixed or computed on demand. |

---

## Advancement

| Field | Type | Default | Description |
|---|---|---|---|
| `advancement` | `object` | — | Controls how units advance to the next section. |
| `predicate` | `expr → bool` \| `"admin"` | — | Evaluated per unit to determine if they advance. `"admin"` defers. |
| `proceeds_to` | `string` | — | Name of the section units advance into. |

---

## Promotion / relegation

| Field | Type | Default | Description |
|---|---|---|---|
| `promotion_relegation` | `object` | — | Division system configuration. |
| `clamp` | `bool` | `false` | Prevent units from promoting beyond the top division. |

---

## Row styles

Visual decorations applied to scoreboard rows.

| Field | Type | Default | Description |
|---|---|---|---|
| `row_styles` | `RowStyle[]` | `[]` | List of conditional row decorations. |
| `predicate` | `expr → bool` | required | Condition under which this style is applied. |
| `accent` | `ColourToken` | required | Colour token for the row ribbon. |
| `label` | `string` | — | Text label shown inside the ribbon. |

---

## Awards

| Field | Type | Default | Description |
|---|---|---|---|
| `awards` | `Award[]` | `[]` | Awards granted to units meeting defined criteria. |
| `name` | `string` | required | Display name of the award. |
| `predicate` | `expr → bool` | required | Condition under which the award is issued. |
| `badge` | `object` | — | Badge visual configuration. |
| `primary_text` | `string` | — | Main text displayed on the badge. |
| `secondary_text` | `string` | — | Smaller supporting text. |
| `shape` | `"circle"` \| `"shield"` \| `"star"` \| `"ribbon"` \| `"hex"` | `circle` | Badge shape. |
| `colour` | `ColourToken` | — | Badge fill colour token. |
| `icon` | `string` | — | Material Icons name displayed on the badge. |

```yaml
awards:
  - name: Perfect Score
    predicate: 'unit.score == 25'
    badge:
      primary_text: 25!
      shape: star
      colour: gold
```

---

## Slots

| Field | Type | Default | Description |
|---|---|---|---|
| `slots` | `SlotDef[]` | required | Game slot definitions for this section. |
| `seed_pattern` | `string` | required | Seed formula. Tokens: `{eventID}`, `{sectionID}`, `{slotIndex}`, `{slotIndex*}`, `{unitID}`. |
| `variant_id` | `number` | — | Hanab.live variant ID for this slot. |
| `missing_score_default` | `number` | — | Score used when no game is recorded for this slot. |
| `validity_rules` | `ValidityRule[]` | `[]` | Rules that must pass for a submission to be accepted. |
| `assignment_trigger` | `"eager"` \| `"lazy"` | `eager` | Whether the slot spec is assigned immediately or on demand. |
| `lazy_trigger` | `"completion"` \| `"action"` \| `"admin"` | `completion` | How a lazy slot is triggered. |

### Seed pattern tokens

| Token | Resolves to |
|---|---|
| `{eventID}` | Numeric event ID |
| `{sectionID}` | Numeric section ID |
| `{slotIndex}` | Zero-based slot index (fixed) |
| `{slotIndex*}` | One-based slot index (auto-incremented across lazy triggers) |
| `{unitID}` | Scoring unit ID |
| `{playerCount}` | Number of players derived from registration |

---

## Scoreboards

| Field | Type | Default | Description |
|---|---|---|---|
| `scoreboards` | `Scoreboard[]` | `[]` | Scoreboard view definitions. |
| `name` | `string` | required | Display name of this scoreboard. |
| `scope` | `string` | — | Section name whose results this scoreboard displays. |
| `is_primary` | `bool` | `false` | Whether this is the default scoreboard shown. |
| `filter` | `expr → bool` | — | Filters which units appear in this scoreboard. |
| `featured` | `expr → bool` | — | Marks units for highlighted display. |
| `columns` | `Column[]` | — | Custom column definitions. |
