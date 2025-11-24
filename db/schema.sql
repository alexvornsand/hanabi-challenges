-- Enable extensions
CREATE EXTENSION IF NOT EXISTS citext;

DROP TABLE IF EXISTS pending_team_members CASCADE;
DROP TABLE IF EXISTS event_stage_team_statuses CASCADE;
DROP TABLE IF EXISTS game_participants CASCADE;
DROP TABLE IF EXISTS event_games CASCADE;
DROP TABLE IF EXISTS event_game_templates CASCADE;
DROP TABLE IF EXISTS team_memberships CASCADE;
DROP TABLE IF EXISTS event_teams CASCADE;
DROP TABLE IF EXISTS event_stages CASCADE;
DROP TABLE IF EXISTS events CASCADE;
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
  color_hex TEXT NOT NULL DEFAULT '#777777',
  text_color TEXT NOT NULL DEFAULT '#ffffff'
    CHECK (text_color IN ('#000000', '#ffffff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EVENTS
-- Each row is a concrete run, e.g. "No Variant 2025"
------------------------------------------------------------

CREATE TABLE events (
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
-- EVENT TEAMS (scoped to a single event)
------------------------------------------------------------

CREATE TABLE event_teams (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  team_size INTEGER NOT NULL CHECK (team_size IN (2, 3, 4, 5, 6)),
  table_password TEXT,
  UNIQUE (event_id, name)
);

------------------------------------------------------------
-- TEAM MEMBERSHIPS (players + managers)
------------------------------------------------------------

CREATE TABLE team_memberships (
  id SERIAL PRIMARY KEY,
  event_team_id INTEGER NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('PLAYER', 'STAFF')),
  is_listed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_team_id, user_id, role)
);

------------------------------------------------------------
-- PENDING TEAM MEMBERS (not yet linked to a user)
------------------------------------------------------------
CREATE TABLE pending_team_members (
  id SERIAL PRIMARY KEY,
  event_team_id INTEGER NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PLAYER', 'STAFF')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EVENT STAGES
-- Ordered collection of stages for an event
------------------------------------------------------------

CREATE TABLE event_stages (
  event_stage_id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  stage_type TEXT NOT NULL CHECK (stage_type IN ('SINGLE', 'ROUND_ROBIN', 'BRACKET', 'GAUNTLET')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  config_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, stage_index)
);

------------------------------------------------------------
-- EVENT GAME TEMPLATES
-- Fixed templates per event stage
------------------------------------------------------------

CREATE TABLE event_game_templates (
  id SERIAL PRIMARY KEY,
  event_stage_id INTEGER NOT NULL REFERENCES event_stages(event_stage_id) ON DELETE CASCADE,
  template_index INTEGER NOT NULL,
  variant TEXT NOT NULL DEFAULT 'No Variant',  -- e.g. 'No Variant', 'Rainbow', etc.
  max_score INTEGER NOT NULL DEFAULT 25,
  seed_payload TEXT, -- payload for this template
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_stage_id, template_index)
);

------------------------------------------------------------
-- EVENT GAMES
-- A single logged play of (event_team, event_game_template)
------------------------------------------------------------

CREATE TABLE event_games (
  id SERIAL PRIMARY KEY,
  event_team_id INTEGER NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  event_game_template_id INTEGER NOT NULL REFERENCES event_game_templates(id) ON DELETE CASCADE,
  game_id INTEGER,
  score INTEGER NOT NULL,
  zero_reason TEXT
    CHECK (zero_reason IN ('Strike Out', 'Time Out', 'VTK') OR zero_reason IS NULL),
  bottom_deck_risk INTEGER,
  notes TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_team_id, event_game_template_id)
);

------------------------------------------------------------
-- GAME PARTICIPANTS
-- Which subset of the team actually played this game
------------------------------------------------------------

CREATE TABLE game_participants (
  id SERIAL PRIMARY KEY,
  event_game_id INTEGER NOT NULL REFERENCES event_games(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_game_id, user_id)
);

------------------------------------------------------------
-- EVENT STAGE TEAM STATUSES
-- Per-team progress through a stage
------------------------------------------------------------

CREATE TABLE event_stage_team_statuses (
  event_stage_id INTEGER NOT NULL REFERENCES event_stages(event_stage_id) ON DELETE CASCADE,
  event_team_id INTEGER NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'complete', 'eliminated')),
  completed_at TIMESTAMPTZ,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_stage_id, event_team_id)
);
