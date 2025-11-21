-- Enable extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- Drop tables in dependency order (children first)
DROP TABLE IF EXISTS game_participants CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS challenge_seeds CASCADE;
DROP TABLE IF EXISTS team_memberships CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS users CASCADE;

------------------------------------------------------------
-- USERS
------------------------------------------------------------

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  display_name CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER'
    CHECK (role IN ('SUPERADMIN', 'ADMIN', 'USER')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- CHALLENGES
-- Each row is a concrete run, e.g. "No Variant 2025"
------------------------------------------------------------

CREATE TABLE challenges (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  short_description TEXT,
  long_description TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- TEAMS (scoped to a single challenge)
------------------------------------------------------------

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  team_size INTEGER NOT NULL CHECK (team_size IN (2, 3, 4, 5, 6)),
  UNIQUE (challenge_id, name)
);

------------------------------------------------------------
-- TEAM MEMBERSHIPS (players + managers)
------------------------------------------------------------

CREATE TABLE team_memberships (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('PLAYER', 'STAFF')),
  is_listed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id, role)
);

------------------------------------------------------------
-- CHALLENGE SEEDS
-- Fixed seeds per challenge
------------------------------------------------------------

CREATE TABLE challenge_seeds (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  seed_number INTEGER NOT NULL,  -- typically 1..100 within the challenge
  variant TEXT NOT NULL DEFAULT 'No Variant',  -- e.g. 'No Variant', 'Rainbow', etc.
  -- seed_payload could contain the actual RNG seed or other identifying data later
  seed_payload TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (challenge_id, seed_number)
);

------------------------------------------------------------
-- GAMES
-- A single logged play of (team, seed)
------------------------------------------------------------

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed_id INTEGER NOT NULL REFERENCES challenge_seeds(id) ON DELETE CASCADE,
  game_id INTEGER,
  score INTEGER NOT NULL,
  zero_reason TEXT
    CHECK (zero_reason IN ('Strike Out', 'Time Out', 'VTK') OR zero_reason IS NULL),
  bottom_deck_risk INTEGER,
  notes TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, seed_id)
);

------------------------------------------------------------
-- GAME PARTICIPANTS
-- Which subset of the team actually played this game
------------------------------------------------------------

CREATE TABLE game_participants (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);
