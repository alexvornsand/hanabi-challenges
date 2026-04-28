---
title: Mix Gauntlet
sidebar_position: 3
---

# Example: Mix Gauntlet

Mix Gauntlet is a variant-based event where teams race to achieve the highest possible score across multiple attempts. Each attempt is automatically followed by the next — teams keep going until they're satisfied or time runs out.

**Key characteristics:**
- Explicit team registration
- Manual game submission (no scraping)
- Lazy-completion slot chaining
- Derived ranking aggregation (best attempt wins)

---

## Full config

```yaml
event:
  name: Mix Gauntlet
  slug: mix-gauntlet

  registration_policy:
    explicit: true

  capture_policy:
    submit: true

  scoring_unit_type: team

  aggregation_function:
    fn: derived_ranking
    score: 'unit.best_attempt_score'

  sections:
    - name: Gauntlet
      scoring_unit_type: team
      aggregation_function:
        reduce: max
        over: attempts
        value: 'item.total_points'
      slots:
        - seed_pattern: 'p{playerCount}v{variantID}s{teamID}a{attemptID*}'
          assignment_trigger: lazy
          lazy_trigger: completion
```

---

## Walkthrough

### Explicit registration

```yaml
registration_policy:
  explicit: true
```

Teams must register before participating. No implicit registration from game data.

### Manual submission only

```yaml
capture_policy:
  submit: true
```

No scraping — participants submit their game results manually via the platform. This is typical for variant events where game IDs can't be reliably scraped.

### Lazy-completion chaining

```yaml
assignment_trigger: lazy
lazy_trigger: completion
```

After a team submits a game, a new slot is automatically issued for their next attempt. Teams can play as many times as they want; each game feeds directly into the next without organiser intervention.

### Best attempt wins

```yaml
aggregation_function:
  reduce: max
  over: attempts
  value: 'item.total_points'
```

Only the team's highest-scoring attempt counts. They can improve their standing by playing again at any time.

### Derived ranking

```yaml
aggregation_function:
  fn: derived_ranking
  score: 'unit.best_attempt_score'
```

At the event level, teams are ranked by their best attempt score. `derived_ranking` is used when the ranking is computed from a custom expression rather than a direct point total.
