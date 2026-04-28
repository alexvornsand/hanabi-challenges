---
id: boom-and-bloom
title: Boom and Bloom
sidebar_position: 2
---

# Example: Boom and Bloom

Boom and Bloom is a weekly partnership event. Players pair up each week, and their classification as a "stable partnership" is inferred from game data. A tiebreaker section activates only when needed.

**Key characteristics:**
- Inferred scoring units (partnerships detected automatically)
- Weekly time-windowed sections
- Conditionally activated tiebreaker with admin-triggered lazy slots
- Matchmaking for the tiebreaker round

---

## Full config

```yaml
event:
  name: Boom and Bloom
  slug: boom-and-bloom

  dimensions:
    - axis: player_count_class
      values: ['2p']
      registration_cardinality: multiple

  registration_policy:
    implicit: true

  capture_policy:
    scrape: true
    scrape_schedule: daily

  scoring_unit_type: inferred

  sections:
    - name: Week 1
      scoring_unit_type: inferred
      classification_rule: 'stable_partnership'
      aggregation_function:
        reduce: sum
        over: slots
        value: 'item.points'
      time_window:
        start: '2024-01-01T00:00:00Z'
        end: '2024-01-07T23:59:59Z'
      slots:
        - seed_pattern: 'p2v0s{eventID}s1g1'
          missing_score_default: 0
        - seed_pattern: 'p2v0s{eventID}s1g2'
          missing_score_default: 0
        - seed_pattern: 'p2v0s{eventID}s1g3'
          missing_score_default: 0
        - seed_pattern: 'p2v0s{eventID}s1g4'
          missing_score_default: 0

    - name: Week 2
      scoring_unit_type: inferred
      classification_rule: 'stable_partnership'
      aggregation_function:
        reduce: sum
        over: slots
        value: 'item.points'
      time_window:
        start: '2024-01-08T00:00:00Z'
        end: '2024-01-14T23:59:59Z'
      slots:
        - seed_pattern: 'p2v0s{eventID}s2g1'
          missing_score_default: 0
        - seed_pattern: 'p2v0s{eventID}s2g2'
          missing_score_default: 0
        - seed_pattern: 'p2v0s{eventID}s2g3'
          missing_score_default: 0
        - seed_pattern: 'p2v0s{eventID}s2g4'
          missing_score_default: 0

    - name: Tiebreaker
      scoring_unit_type: team
      aggregation_function:
        fn: match_aggregate
        match_comparators:
          - points
        sequence_by: slot_index
      matchmaking:
        type: algorithmic
        assignment: dynamic
      conditional_activation: >
        tie_exists_at_rank(1) or tie_exists_at_rank(2) or tie_exists_at_rank(3)
      slots:
        - seed_pattern: 'p2v0s{eventID}TBg{slotIndex*}'
          assignment_trigger: lazy
          lazy_trigger: admin
```

---

## Walkthrough

### Inferred scoring units

```yaml
scoring_unit_type: inferred
classification_rule: 'stable_partnership'
```

Rather than requiring explicit team registration, the platform examines game participation data and classifies pairs who played consistently together as a `stable_partnership`. Each such pair becomes a scoring unit automatically.

### Time windows

```yaml
time_window:
  start: '2024-01-01T00:00:00Z'
  end: '2024-01-07T23:59:59Z'
```

Each weekly section captures only games played within its window. The scraper runs daily to pull in new results.

### Conditional tiebreaker

```yaml
conditional_activation: >
  tie_exists_at_rank(1) or tie_exists_at_rank(2) or tie_exists_at_rank(3)
```

The Tiebreaker section only becomes active if there are tied units at the top three places. Participants are not notified of or shown this section until it activates.

### Admin-triggered lazy slots

```yaml
assignment_trigger: lazy
lazy_trigger: admin
```

The organiser manually issues each tiebreaker game slot as the round progresses. This gives full control over pacing without needing to pre-define the number of games.

### Match aggregate scoring

```yaml
aggregation_function:
  fn: match_aggregate
  match_comparators:
    - points
  sequence_by: slot_index
```

In the tiebreaker, head-to-head results are compared game by game. The unit that wins the majority of games wins the match.
