BEGIN;

-- Wipe existing data (and reset sequences)
TRUNCATE TABLE
  game_participants,
  games,
  team_enrollments,
  team_memberships,
  teams,
  challenge_seeds,
  challenges,
  users
RESTART IDENTITY CASCADE;

-- ================================
-- Users
-- ================================
-- Plaintext passwords (for testing):
-- alice: alicepw
-- bob: bobpw
-- carol: carolpw
-- dave: davepw
-- erin: erinpw
-- frank: frankpw
-- grace: gracepw

INSERT INTO users (display_name, password_hash, role)
VALUES
  ('alice', '$2b$12$ESRguBtodUUh8caZ2h0ba.BfGtRIY97/se6mLMoSp26Qhup3BBdCW', 'SUPERADMIN'),
  ('bob',   '$2b$12$y09lDIccPbJMERu9hYvm0O9hG.7WWpL9I8rZwEScZPB.EbN5gIcNS', 'ADMIN'),
  ('carol', '$2b$12$QeXC4Lo4/g2mT49hKchvBOuFCYJjnHp/FL/PUGatSQBt0zNerbxJu', 'ADMIN'),
  ('dave',  '$2b$12$zbwxFDvtarIc.IsvOWGziOisfCLNdVLqRwY0CaCDfVSqCeXcXlkL6', 'USER'),
  ('erin',  '$2b$12$Uz8Qu8zOkvEONJiAU4RtxeUukbx3GALrB9WqYsrZwnPo2W.XsjQSG', 'USER'),
  ('frank', '$2b$12$.JL5jF3Vo1SCMRlyIhxjweY1FSqqRdoIY6rGGjAY43PQuZqwEr37e', 'USER'),
  ('grace', '$2b$12$ZyHsfOg8mzQPvLMiLmWzveooadNZKx/MIstl0LS1p1wn5YNYWIQ1O', 'USER');

-- IDs after this are:
-- alice = 1, bob = 2, carol = 3, dave = 4, erin = 5, frank = 6, grace = 7


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
-- 1..5 -> 2025 seeds (1..5)
-- 6..10 -> 2026 seeds (1..5)


-- ================================
-- Teams
-- ================================
-- Two teams per challenge
INSERT INTO teams (challenge_id, name, created_by_user_id)
VALUES
  (1, 'Lanterns',      1), -- created by alice
  (1, 'Clue Crew',     2), -- created by bob
  (2, 'Faded Signals', 3), -- created by carol
  (2, 'Risky Fuses',   4); -- created by dave

-- team_ids:
-- 1 = Lanterns       (challenge 1)
-- 2 = Clue Crew      (challenge 1)
-- 3 = Faded Signals  (challenge 2)
-- 4 = Risky Fuses    (challenge 2)


-- ================================
-- Team memberships
-- ================================
-- Team 1: Lanterns
-- - Manager: alice (does NOT play)
-- - Players: bob, carol, dave
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (1, 1, 'MANAGER', true),
  (1, 2, 'PLAYER',  true),
  (1, 3, 'PLAYER',  true),
  (1, 4, 'PLAYER',  true);

-- Team 2: Clue Crew
-- - No manager, just players: bob, erin, frank
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (2, 2, 'PLAYER', true),
  (2, 5, 'PLAYER', true),
  (2, 6, 'PLAYER', true);

-- Team 3: Faded Signals
-- - Manager who also plays: carol
-- - Players: carol, erin, grace
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (3, 3, 'MANAGER', true),
  (3, 3, 'PLAYER',  true),
  (3, 5, 'PLAYER',  true),
  (3, 7, 'PLAYER',  true);

-- Team 4: Risky Fuses
-- - No manager, players: dave, erin, frank, grace
INSERT INTO team_memberships (team_id, user_id, role, is_listed)
VALUES
  (4, 4, 'PLAYER', true),
  (4, 5, 'PLAYER', true),
  (4, 6, 'PLAYER', true),
  (4, 7, 'PLAYER', true);


-- ================================
-- Team enrollments (team + player_count)
-- ================================
-- One enrollment per team, different player counts
INSERT INTO team_enrollments (team_id, player_count)
VALUES
  (1, 3), -- Lanterns: bob, carol, dave
  (2, 3), -- Clue Crew: bob, erin, frank
  (3, 3), -- Faded Signals: carol, erin, grace
  (4, 4); -- Risky Fuses: dave, erin, frank, grace

-- team_enrollment_ids:
-- 1 -> Lanterns 3p
-- 2 -> Clue Crew 3p
-- 3 -> Faded Signals 3p
-- 4 -> Risky Fuses 4p


-- ================================
-- Games (results live here)
-- ================================
-- Each enrollment:
-- - plays seeds 1,2,3 for its challenge (no games for seeds 4,5)
-- - If seed 3 exists, 1 and 2 also exist (for each enrollment)

-- Challenge 1 seeds: seed_ids 1,2,3
-- Challenge 2 seeds: seed_ids 6,7,8

-- Lanterns (team_enrollment 1, challenge 1)
INSERT INTO games (
  team_enrollment_id,
  seed_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (1, 1, 1001, 25, NULL,         2, 'Lanterns 3p – seed 1, clean',      '2025-02-01T20:00:00Z'),
  (1, 2, 1002, 23, NULL,         4, 'Lanterns 3p – seed 2, minor risk', '2025-02-08T20:00:00Z'),
  (1, 3, 1003,  0, 'Strike Out', 7, 'Lanterns 3p – seed 3, strike out', '2025-02-15T20:00:00Z');

-- Clue Crew (team_enrollment 2, challenge 1)
INSERT INTO games (
  team_enrollment_id,
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

-- Faded Signals (team_enrollment 3, challenge 2)
INSERT INTO games (
  team_enrollment_id,
  seed_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (3, 6, 2001, 26, NULL,       1, 'Faded Signals 3p – seed 1, near-perfect', '2026-01-10T21:00:00Z'),
  (3, 7, 2002, 24, NULL,       3, 'Faded Signals 3p – seed 2, good',         '2026-01-17T21:00:00Z'),
  (3, 8, 2003,  0, 'VTK',      8, 'Faded Signals 3p – seed 3, VTK loss',     '2026-01-24T21:00:00Z');

-- Risky Fuses (team_enrollment 4, challenge 2) – only seeds 1 & 2 (6 & 7)
INSERT INTO games (
  team_enrollment_id,
  seed_id,
  game_id,
  score,
  zero_reason,
  bottom_deck_risk,
  notes,
  played_at
)
VALUES
  (4, 6, 2004, 22, NULL,       4, 'Risky Fuses 4p – seed 1, okay',    '2026-02-05T20:15:00Z'),
  (4, 7, 2005, 18, NULL,       5, 'Risky Fuses 4p – seed 2, shaky',   '2026-02-12T20:15:00Z');

-- After these INSERTs, game_ids (primary key) should be:
-- 1..3  -> Lanterns games
-- 4..6  -> Clue Crew games
-- 7..9  -> Faded Signals games
-- 10..11 -> Risky Fuses games


-- ================================
-- Game participants
-- ================================
-- Define enrollment rosters:
-- Enrollment 1 (Lanterns 3p): bob(2), carol(3), dave(4)
-- Enrollment 2 (Clue Crew 3p): bob(2), erin(5), frank(6)
-- Enrollment 3 (Faded Signals 3p): carol(3), erin(5), grace(7)
-- Enrollment 4 (Risky Fuses 4p): dave(4), erin(5), frank(6), grace(7)

-- Lanterns games (game_ids 1,2,3)
INSERT INTO game_participants (game_id, user_id)
VALUES
  -- game 1
  (1, 2),
  (1, 3),
  (1, 4),
  -- game 2
  (2, 2),
  (2, 3),
  (2, 4),
  -- game 3
  (3, 2),
  (3, 3),
  (3, 4);

-- Clue Crew games (game_ids 4,5,6)
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

-- Faded Signals games (game_ids 7,8,9)
INSERT INTO game_participants (game_id, user_id)
VALUES
  -- game 7
  (7, 3),
  (7, 5),
  (7, 7),
  -- game 8
  (8, 3),
  (8, 5),
  (8, 7),
  -- game 9
  (9, 3),
  (9, 5),
  (9, 7);

-- Risky Fuses games (game_ids 10,11)
INSERT INTO game_participants (game_id, user_id)
VALUES
  -- game 10
  (10, 4),
  (10, 5),
  (10, 6),
  (10, 7),
  -- game 11
  (11, 4),
  (11, 5),
  (11, 6),
  (11, 7);

COMMIT;
