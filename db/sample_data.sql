BEGIN;

-- Wipe existing data (and reset sequences)
TRUNCATE TABLE
  pending_team_members,
  event_stage_team_statuses,
  game_participants,
  event_games,
  event_game_templates,
  team_memberships,
  event_teams,
  event_stages,
  events,
  users
RESTART IDENTITY CASCADE;

-- ================================
-- Users
-- ================================
INSERT INTO users (display_name, password_hash, role, color_hex, text_color)
VALUES
  ('alice',  '$2b$12$O1H7mQfsdGrTQZJ9u9DYF.wslBggsNktWnzr/EPLcBlagzDXF6Qi6', 'SUPERADMIN', '#7aa6ff', '#000000'),
  ('bob',    '$2b$12$f6kS7j/s2m0SQ6NeQ5XmueWyxwjJ/7zjpwIUpFCXNyG1XqGSevqK.', 'ADMIN', '#f6a5c0', '#000000'),
  ('cathy',  '$2b$12$3LAjRP5oRj34sTOv6PmVJui5Tw8uzAl317K4V8lZA5WWtTVdmY6PC', 'ADMIN', '#5fd0b8', '#000000'),
  ('donald', '$2b$12$CHDTGUSxfbxAuKv4jlX95ur1MFjNKBejDJyZQx60G7ICxdNpTkcEa', 'USER', '#ffcc80', '#000000'),
  ('emily',  '$2b$12$fN2p.HkwZPzF5eeh7mCDIOYxnzKMIXtmyJdj5DLk4Rl0lkqeSHV.m', 'USER', '#b388ff', '#ffffff'),
  ('frank',  '$2b$12$2SXylYSxmEPXZXtfhCzbTeDx3gNrhDeochghQNh8ukjUkSAVkQ8zm', 'USER', '#90caf9', '#000000'),
  ('grace',  '$2b$12$VJt0MxY2/lX5bYHQDBoHnOP5hMNpHpzTgLTCV/cAG.JsCJGIk/f/C', 'USER', '#ffab91', '#000000');

-- IDs:
-- 1 = alice, 2 = bob, 3 = cathy, 4 = donald, 5 = emily, 6 = frank, 7 = grace


-- ================================
-- Events
-- ================================
INSERT INTO events (
  name,
  slug,
  short_description,
  long_description,
  starts_at,
  ends_at
)
VALUES
  (
    'Spring Circuit 2025',
    'spring-circuit-2025',
    'Seasonal spring ladder',
    $$A seasonal circuit with mixed variants and rotating seeds.\nPlay clean, log your replays, and chase consistency across the whole stage.$$,
    '2025-03-01T00:00:00Z',
    '2025-06-01T00:00:00Z'
  ),
  (
    'Summer Sprint 2025',
    'summer-sprint-2025',
    'Fast-paced sprint event',
    $$Short sprint focused on quick plays. Mix of variants with fixed seeds for fairness.$$,
    '2025-07-01T00:00:00Z',
    '2025-09-01T00:00:00Z'
  );

-- event_ids:
-- 1 = Spring Circuit 2025
-- 2 = Summer Sprint 2025


-- ================================
-- Event stages
-- ================================
INSERT INTO event_stages (event_id, stage_index, label, stage_type, starts_at, ends_at)
VALUES
  (1, 1, 'Main Stage', 'SINGLE', '2025-03-01T00:00:00Z', '2025-06-01T00:00:00Z'),
  (2, 1, 'Main Stage', 'SINGLE', '2025-07-01T00:00:00Z', '2025-09-01T00:00:00Z');

-- event_stage_ids:
-- 1 = Event 1 Stage 1
-- 2 = Event 2 Stage 1


-- ================================
-- Event game templates
-- ================================
-- For event 1 stage 1: template_index 1..5
INSERT INTO event_game_templates (event_stage_id, template_index, variant, seed_payload, max_score)
VALUES
  (1, 1, 'No Variant', 'SC25-1', 25),
  (1, 2, 'No Variant', 'SC25-2', 25),
  (1, 3, 'No Variant', 'SC25-3', 25),
  (1, 4, 'No Variant', 'SC25-4', 25),
  (1, 5, 'No Variant', 'SC25-5', 25);

-- For event 2 stage 1: template_index 1..5
INSERT INTO event_game_templates (event_stage_id, template_index, variant, seed_payload, max_score)
VALUES
  (2, 1, 'Rainbow', 'SS25-1', 25),
  (2, 2, 'Rainbow', 'SS25-2', 25),
  (2, 3, 'No Variant', 'SS25-3', 25),
  (2, 4, 'No Variant', 'SS25-4', 25),
  (2, 5, 'No Variant', 'SS25-5', 25);

-- event_game_template_ids:
-- 1..5  -> Spring Circuit 2025 templates (index 1..5)
-- 6..10 -> Summer Sprint 2025 templates (index 1..5)


-- ================================
-- Event teams
-- ================================
-- team_size = number of players at the table (per game), not roster size.

INSERT INTO event_teams (event_id, name, team_size, table_password)
VALUES
  (1, 'Lanterns',      2, 'team1234'), -- 2p team
  (1, 'Clue Crew',     3, 'team1234'), -- 3p team
  (2, 'Faded Signals', 4, 'team1234'), -- 4p team
  (2, 'Risky Fuses',   3, 'team1234'); -- 3p team

-- event_team_ids:
-- 1 = Lanterns       (event 1)
-- 2 = Clue Crew      (event 1)
-- 3 = Faded Signals  (event 2)
-- 4 = Risky Fuses    (event 2)


-- ================================
-- Team memberships (roster)
-- ================================
-- Roles: 'PLAYER' (part of the team) and 'STAFF' (can edit, not counted as player).
-- Roster size must be >= team_size.

-- Team 1: Lanterns (2p team)
-- Staff:  alice
-- Players: bob, cathy, donald  (3-player roster, 2 play each game)
INSERT INTO team_memberships (event_team_id, user_id, role, is_listed)
VALUES
  (1, 1, 'STAFF',  true),  -- alice
  (1, 2, 'PLAYER', true),  -- bob
  (1, 3, 'PLAYER', true),  -- cathy
  (1, 4, 'PLAYER', true);  -- donald

-- Team 2: Clue Crew (3p team)
-- Players: bob, emily, frank
INSERT INTO team_memberships (event_team_id, user_id, role, is_listed)
VALUES
  (2, 2, 'PLAYER', true),  -- bob
  (2, 5, 'PLAYER', true),  -- emily
  (2, 6, 'PLAYER', true);  -- frank

-- Team 3: Faded Signals (4p team)
-- Staff:   cathy
-- Players: alice, emily, frank, grace
INSERT INTO team_memberships (event_team_id, user_id, role, is_listed)
VALUES
  (3, 3, 'STAFF',  true),  -- cathy
  (3, 1, 'PLAYER', true),  -- alice
  (3, 5, 'PLAYER', true),  -- emily
  (3, 6, 'PLAYER', true),  -- frank
  (3, 7, 'PLAYER', true);  -- grace

-- Team 4: Risky Fuses (3p team)
-- Players: donald, emily, grace (3 players, all play each game)
INSERT INTO team_memberships (event_team_id, user_id, role, is_listed)
VALUES
  (4, 4, 'PLAYER', true),  -- donald
  (4, 5, 'PLAYER', true),  -- emily
  (4, 7, 'PLAYER', true);  -- grace


-- ================================
-- Event games (results)
-- ================================
-- Assumes event_games(event_team_id, event_game_template_id, game_id, score, zero_reason, bottom_deck_risk, notes, played_at).
-- Each team:
-- - plays templates 1,2,3 for its event (no games for templates 4,5)
-- - If template 3 exists, 1 and 2 also exist.

-- Event 1 templates: ids 1,2,3
-- Event 2 templates: ids 6,7,8

-- Lanterns (event_team_id 1, 2p, event 1)
INSERT INTO event_games (
  event_team_id,
  event_game_template_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (1, 1, 1001, 25, NULL,         2, 'Lanterns 2p – template 1, clean',      '2025-02-01T20:00:00Z'),
  (1, 2, 1002, 23, NULL,         4, 'Lanterns 2p – template 2, minor risk', '2025-02-08T20:00:00Z'),
  (1, 3, 1003,  0, 'Strike Out', 7, 'Lanterns 2p – template 3, strike out', '2025-02-15T20:00:00Z');

-- Clue Crew (event_team_id 2, 3p, event 1)
INSERT INTO event_games (
  event_team_id,
  event_game_template_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (2, 1, 1004, 24, NULL,        3, 'Clue Crew 3p – template 1, solid',    '2025-03-01T19:30:00Z'),
  (2, 2, 1005, 21, NULL,        5, 'Clue Crew 3p – template 2, messy',    '2025-03-08T19:30:00Z'),
  (2, 3, 1006,  0, 'Time Out',  6, 'Clue Crew 3p – template 3, time out', '2025-03-15T19:30:00Z');

-- Faded Signals (event_team_id 3, 4p, event 2)
INSERT INTO event_games (
  event_team_id,
  event_game_template_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (3, 6, 2001, 26, NULL,       1, 'Faded Signals 4p – template 1, near-perfect', '2026-01-10T21:00:00Z'),
  (3, 7, 2002, 24, NULL,       3, 'Faded Signals 4p – template 2, good',         '2026-01-17T21:00:00Z'),
  (3, 8, 2003,  0, 'VTK',      8, 'Faded Signals 4p – template 3, VTK loss',     '2026-01-24T21:00:00Z');

-- Risky Fuses (event_team_id 4, 3p, event 2) – only templates 1 & 2 (6 & 7)
INSERT INTO event_games (
  event_team_id,
  event_game_template_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (4, 6, 2004, 22, NULL,       4, 'Risky Fuses 3p – template 1, okay',    '2026-02-05T20:15:00Z'),
  (4, 7, 2005, 18, NULL,       5, 'Risky Fuses 3p – template 2, shaky',   '2026-02-12T20:15:00Z');

-- After these INSERTs, event_game ids (PK) should be:
-- 1..3   -> Lanterns games
-- 4..6   -> Clue Crew games
-- 7..9   -> Faded Signals games
-- 10..11 -> Risky Fuses games


-- ================================
-- Game participants
-- ================================
-- Enrollment pattern now inferred from team_memberships + team_size.
-- Lanterns 2p:   bob(2), cathy(3), donald(4)         [2 play each game]
-- Clue Crew 3p:  bob(2), emily(5), frank(6)          [all 3 play]
-- Faded Signals 4p: alice(1), emily(5), frank(6), grace(7) [all 4 play]
-- Risky Fuses 3p: donald(4), emily(5), grace(7)      [all 3 play]

-- Lanterns games (game_ids 1,2,3) – 2 players per game
INSERT INTO game_participants (event_game_id, user_id)
VALUES
  (1, 2), (1, 3),
  (2, 2), (2, 3),
  (3, 3), (3, 4);

-- Clue Crew games (game_ids 4,5,6) – 3 players per game
INSERT INTO game_participants (event_game_id, user_id)
VALUES
  (4, 2), (4, 5), (4, 6),
  (5, 2), (5, 5), (5, 6),
  (6, 2), (6, 5), (6, 6);

-- Faded Signals games (game_ids 7,8,9) – 4 players per game
INSERT INTO game_participants (event_game_id, user_id)
VALUES
  (7, 1), (7, 5), (7, 6), (7, 7),
  (8, 1), (8, 5), (8, 6), (8, 7),
  (9, 1), (9, 5), (9, 6), (9, 7);

-- Risky Fuses games (game_ids 10,11) – 3 players per game
INSERT INTO game_participants (event_game_id, user_id)
VALUES
  (10, 4), (10, 5), (10, 7),
  (11, 4), (11, 5), (11, 7);

COMMIT;
