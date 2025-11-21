BEGIN;

-- Wipe existing data (and reset sequences)
TRUNCATE TABLE
  game_participants,
  games,
  team_memberships,
  teams,
  challenge_seeds,
  challenges,
  users
RESTART IDENTITY CASCADE;

-- ================================
-- Users
-- ================================
INSERT INTO users (display_name, password_hash, role)
VALUES
  ('alice',  '$2b$12$ESRguBtodUUh8caZ2h0ba.BfGtRIY97/se6mLMoSp26Qhup3BBdCW', 'SUPERADMIN'),
  ('bob',    '$2b$12$y09lDIccPbJMERu9hYvm0O9hG.7WWpL9I8rZwEScZPB.EbN5gIcNS', 'ADMIN'),
  ('cathy',  '$2b$12$QeXC4Lo4/g2mT49hKchvBOuFCYJjnHp/FL/PUGatSQBt0zNerbxJu', 'ADMIN'),
  ('donald', '$2b$12$zbwxFDvtarIc.IsvOWGziOisfCLNdVLqRwY0CaCDfVSqCeXcXlkL6', 'USER'),
  ('emily',  '$2b$12$Uz8Qu8zOkvEONJiAU4RtxeUukbx3GALrB9WqYsrZwnPo2W.XsjQSG', 'USER'),
  ('frank',  '$2b$12$.JL5jF3Vo1SCMRlyIhxjweY1FSqqRdoIY6rGGjAY43PQuZqwEr37e', 'USER'),
  ('grace',  '$2b$12$ZyHsfOg8mzQPvLMiLmWzveooadNZKx/MIstl0LS1p1wn5YNYWIQ1O', 'USER');

-- IDs:
-- 1 = alice, 2 = bob, 3 = cathy, 4 = donald, 5 = emily, 6 = frank, 7 = grace


-- ================================
-- Challenges
-- ================================
INSERT INTO challenges (
  name,
  slug,
  short_description,
  long_description,
  starts_at,
  ends_at
)
VALUES
  (
    'No Variant 2025',
    'no-var-2025',
    'No Variant Challenge 2025',
    $$Over the next wee while, we're going to play 100 games of No Var and aim to get the highest % of max score we can.\n\nTiers:\nover 70% max scores: 🥉\nBronze\nover 80% max scores: 🥈\nSilver\nover 90% max scores: 🥇\nGold\nover 95% max scores: 💎\nDiamond$$,
    '2025-01-01T00:00:00Z',
    '2025-12-31T23:59:59Z'
  ),
  (
    'No Variant 2026',
    'no-var-2026',
    'No Variant Challenge 2026',
    $$Over the next wee while, we're going to play 100 games of No Var and aim to get the highest % of max score we can.\n\nTiers:\nover 70% max scores: 🥉\nBronze\nover 80% max scores: 🥈\nSilver\nover 90% max scores: 🥇\nGold\nover 95% max scores: 💎\nDiamond$$,
    '2026-01-01T00:00:00Z',
    '2026-12-31T23:59:59Z'
  );

-- challenge_ids:
-- 1 = No Variant 2025
-- 2 = No Variant 2026


-- ================================
-- Challenge seeds
-- ================================
-- For challenge 1: seed_numbers 1..5
INSERT INTO challenge_seeds (challenge_id, seed_number, variant, seed_payload)
VALUES
  (1, 1, 'NO_VARIANT', 'NVC2025-1'),
  (1, 2, 'NO_VARIANT', 'NVC2025-2'),
  (1, 3, 'NO_VARIANT', 'NVC2025-3'),
  (1, 4, 'NO_VARIANT', 'NVC2025-4'),
  (1, 5, 'NO_VARIANT', 'NVC2025-5');

-- For challenge 2: seed_numbers 1..5
INSERT INTO challenge_seeds (challenge_id, seed_number, variant, seed_payload)
VALUES
  (2, 1, 'NO_VARIANT', 'NVC2026-1'),
  (2, 2, 'NO_VARIANT', 'NVC2026-2'),
  (2, 3, 'NO_VARIANT', 'NVC2026-3'),
  (2, 4, 'NO_VARIANT', 'NVC2026-4'),
  (2, 5, 'NO_VARIANT', 'NVC2026-5');

-- seed_ids:
-- 1..5  -> 2025 seeds (1..5)
-- 6..10 -> 2026 seeds (1..5)


-- ================================
-- Teams
-- ================================
-- team_size = number of players at the table (per game), not roster size.

INSERT INTO teams (challenge_id, name, team_size)
VALUES
  (1, 'Lanterns',      2), -- 2p team (roster 3 players + 1 staff)
  (1, 'Clue Crew',     3), -- 3p team
  (2, 'Faded Signals', 4), -- 4p team
  (2, 'Risky Fuses',   3); -- 3p team

-- team_ids:
-- 1 = Lanterns       (challenge 1)
-- 2 = Clue Crew      (challenge 1)
-- 3 = Faded Signals  (challenge 2)
-- 4 = Risky Fuses    (challenge 2)


-- ================================
-- Team memberships (roster)
-- ================================
-- Roles: 'PLAYER' (part of the team) and 'STAFF' (can edit, not counted as player).
-- Roster size must be >= team_size.

-- Team 1: Lanterns (2p team)
-- Staff:  alice
-- Players: bob, cathy, donald  (3-player roster, 2 play each game)
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (1, 1, 'STAFF',  true),  -- alice
  (1, 2, 'PLAYER', true),  -- bob
  (1, 3, 'PLAYER', true),  -- cathy
  (1, 4, 'PLAYER', true);  -- donald

-- Team 2: Clue Crew (3p team)
-- Players: bob, emily, frank
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (2, 2, 'PLAYER', true),  -- bob
  (2, 5, 'PLAYER', true),  -- emily
  (2, 6, 'PLAYER', true);  -- frank

-- Team 3: Faded Signals (4p team)
-- Staff:   cathy
-- Players: alice, emily, frank, grace
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (3, 3, 'STAFF',  true),  -- cathy
  (3, 1, 'PLAYER', true),  -- alice
  (3, 5, 'PLAYER', true),  -- emily
  (3, 6, 'PLAYER', true),  -- frank
  (3, 7, 'PLAYER', true);  -- grace

-- Team 4: Risky Fuses (3p team)
-- Players: donald, emily, grace (3 players, all play each game)
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (4, 4, 'PLAYER', true),  -- donald
  (4, 5, 'PLAYER', true),  -- emily
  (4, 7, 'PLAYER', true);  -- grace


-- ================================
-- Games (results)
-- ================================
-- Assumes games(team_id, seed_id, game_id, score, zero_reason, bottom_deck_risk, notes, played_at).
-- Each team:
-- - plays seeds 1,2,3 for its challenge (no games for seeds 4,5)
-- - If seed 3 exists, 1 and 2 also exist.

-- Challenge 1 seeds: seed_ids 1,2,3
-- Challenge 2 seeds: seed_ids 6,7,8

-- Lanterns (team_id 1, 2p, challenge 1)
INSERT INTO games (
  team_id,
  seed_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (1, 1, 1001, 25, NULL,         2, 'Lanterns 2p – seed 1, clean',      '2025-02-01T20:00:00Z'),
  (1, 2, 1002, 23, NULL,         4, 'Lanterns 2p – seed 2, minor risk', '2025-02-08T20:00:00Z'),
  (1, 3, 1003,  0, 'Strike Out', 7, 'Lanterns 2p – seed 3, strike out', '2025-02-15T20:00:00Z');

-- Clue Crew (team_id 2, 3p, challenge 1)
INSERT INTO games (
  team_id,
  seed_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (2, 1, 1004, 24, NULL,        3, 'Clue Crew 3p – seed 1, solid',    '2025-03-01T19:30:00Z'),
  (2, 2, 1005, 21, NULL,        5, 'Clue Crew 3p – seed 2, messy',    '2025-03-08T19:30:00Z'),
  (2, 3, 1006,  0, 'Time Out',  6, 'Clue Crew 3p – seed 3, time out', '2025-03-15T19:30:00Z');

-- Faded Signals (team_id 3, 4p, challenge 2)
INSERT INTO games (
  team_id,
  seed_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (3, 6, 2001, 26, NULL,       1, 'Faded Signals 4p – seed 1, near-perfect', '2026-01-10T21:00:00Z'),
  (3, 7, 2002, 24, NULL,       3, 'Faded Signals 4p – seed 2, good',         '2026-01-17T21:00:00Z'),
  (3, 8, 2003,  0, 'VTK',      8, 'Faded Signals 4p – seed 3, VTK loss',     '2026-01-24T21:00:00Z');

-- Risky Fuses (team_id 4, 3p, challenge 2) – only seeds 1 & 2 (6 & 7)
INSERT INTO games (
  team_id,
  seed_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (4, 6, 2004, 22, NULL,       4, 'Risky Fuses 3p – seed 1, okay',    '2026-02-05T20:15:00Z'),
  (4, 7, 2005, 18, NULL,       5, 'Risky Fuses 3p – seed 2, shaky',   '2026-02-12T20:15:00Z');

-- After these INSERTs, game_ids (PK) should be:
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
-- Faded 4p:      alice(1), emily(5), frank(6), grace(7)  [all 4 play]
-- Risky 3p:      donald(4), emily(5), grace(7)       [all 3 play]

-- Lanterns games (game_ids 1,2,3) – 2 players per game
INSERT INTO game_participants (game_id, user_id)
VALUES
  -- game 1: bob + cathy
  (1, 2),
  (1, 3),
  -- game 2: bob + donald
  (2, 2),
  (2, 4),
  -- game 3: cathy + donald
  (3, 3),
  (3, 4);

-- Clue Crew games (game_ids 4,5,6) – 3 players per game
INSERT INTO game_participants (game_id, user_id)
VALUES
  -- game 4
  (4, 2),
  (4, 5),
  (4, 6),
  -- game 5
  (5, 2),
  (5, 5),
  (5, 6),
  -- game 6
  (6, 2),
  (6, 5),
  (6, 6);

-- Faded Signals games (game_ids 7,8,9) – 4 players per game
INSERT INTO game_participants (game_id, user_id)
VALUES
  -- game 7
  (7, 1),
  (7, 5),
  (7, 6),
  (7, 7),
  -- game 8
  (8, 1),
  (8, 5),
  (8, 6),
  (8, 7),
  -- game 9
  (9, 1),
  (9, 5),
  (9, 6),
  (9, 7);

-- Risky Fuses games (game_ids 10,11) – 3 players per game
INSERT INTO game_participants (game_id, user_id)
VALUES
  -- game 10
  (10, 4),
  (10, 5),
  (10, 7),
  -- game 11
  (11, 4),
  (11, 5),
  (11, 7);

COMMIT;
