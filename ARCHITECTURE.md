# Hanabi Challenges – Architecture Overview

This document describes the high-level architecture of the Hanabi Challenges
application, covering the backend structure, database relationships, API layer,
testing strategy, and upcoming frontend plans.

---

## 1. High-Level System Overview

The system provides:

- A way to define Hanabi “challenges” (e.g., No Variant Cup 2025)
- Seeds within each challenge (e.g., specific shuffled decks or scenarios)
- Teams participating in a challenge
- Team members (players)
- Game results (scores, zero-reason metadata, notes, etc.)
- A set of API routes for managing all of the above
- (Future) A React frontend for interacting with challenges and results

It is built for clarity, correctness, and extensibility rather than raw throughput.

---

## 2. Backend Overview

The backend is a Node.js + TypeScript service using:

- Express for request routing
- PostgreSQL (`pg` library) for persistence
- Vitest for unit tests
- ESLint (flat config) + Prettier for code correctness and formatting

Directory structure (backend):

```
backend/
src/
config/ — database connection
middleware/ — auth, admin guards
modules/
auth/ — login / JWT creation / user mgmt
challenges/ — challenge + seed logic
teams/ — team + membership logic
results/ — game result creation + hydration
tests/
unit/
*.test.ts — service tests (DB-backed)
```

---

## 3. Database Overview

The system uses PostgreSQL. Core tables include:

- `users`
- `challenges`
- `challenge_seeds`
- `teams`
- `team_memberships`
- `team_enrollments` (team + challenge participation)
- `games`
- `game_participants`

### 3.1 Relationships (Simplified)

- **Challenge** has many **Seeds**
- **Team** belongs to a **Challenge**
- **Team** has many **TeamMemberships** (users)
- **TeamEnrollment** associates a team with a challenge instance
- **GameResult (games)** belongs to a TeamEnrollment + Seed pair
- **GameParticipants** links users to a specific game result

### 3.2 Uniqueness Constraints

Important uniqueness constraints enforced at DB level:

- `challenges.name` is unique
- `(challenge_id, seed_number)` is unique in `challenge_seeds`
- `(team_enrollment_id, seed_id)` is unique in `games`
- `(team_id, user_id, role)` is unique in `team_memberships`

Service code maps PG error codes (`23505`) to domain error codes
(e.g., `CHALLENGE_NAME_EXISTS`).

---

## 4. Backend Modules

### 4.1 Auth Module

Responsibilities:

- Login or create user (`loginOrCreateUser`)
- Verify password hash
- Issue JWT tokens
- Middleware:
  - `authRequired`
  - `requireAdmin` and `requireSuperAdmin`

### 4.2 Challenges Module

Responsibilities:

- List challenges
- Create challenges
- List seeds for a challenge
- Create seeds
- List teams associated with a challenge

Domain objects:

- `Challenge`
- `ChallengeSeed`
- `ChallengeTeam`

### 4.3 Teams Module

Responsibilities:

- Create a team and auto-create MANAGER membership
- Add team members
- List team members
- List membership candidates (users not on team)
- Enforce unique membership constraints

Domain objects:

- `Team`
- `TeamMember`
- `MemberCandidate`

### 4.4 Results Module

Responsibilities:

- Insert game results (with error-handling on duplicates)
- Fetch _hydrated_ game results:
  - Seed
  - Team
  - Team player count
  - Players in seat order

### 4.5 Error Handling

Pattern:

- Database unique violations → `23505`
- Services catch errors
- Service translates to domain errors (e.g., `GAME_RESULT_EXISTS`)
- Routes perform HTTP translation (409 conflict, 401 unauthorized, etc.)

---

## 5. Testing Strategy

Unit tests exist in:

```
backend/tests/unit/*.test.ts
```

Testing style:

- Each service method tested against a _real_ test database
- Cleanup performed before/after each test suite
- Domain errors asserted via `toMatchObject({ code: … })`
- Hydrated results checked for correct joining logic

Future additions:

- Integration tests for routes
- Mocked tests where DB is not needed

---

## 6. Future Frontend Architecture

The planned frontend will be a React app (likely Vite or Next.js).

Planned architecture:

- React + TypeScript
- React Query for data caching
- Fetch wrapper or Axios client
- Protected pages for team editing
- Public leaderboard / results pages
- Strong typing shared via generated API types or manual TS interfaces

Planned pages:

- Overview (all challenges)
- Challenge detail (seeds + teams)
- Team detail (roster editing)
- Results summary (2–6p versions)
- Result detail (hydrated game result)

---

## 7. CI/CD Architecture

Current:

- GitHub Actions CI runs:
  - root lint
  - backend test suite

Future expansions:

- Add DB migrations in CI
- Add type-checking (`tsc --noEmit`)
- Add integration tests
- Deployment pipeline to chosen hosting

---

## 8. Secrets & Environment Configuration

Environment variables not committed to version control:

- Database URL
- JWT secret
- Hashing salt rounds
- Deployment config

An `.env.example` is provided to document required variables.

---

## 9. Deployment Strategy (Planned)

Backend:

- Docker image
- Possibly Docker Compose for local dev
- Hosted Postgres (e.g., Supabase, RDS, Railway, Neon)

Frontend:

- Deploy to Vercel / Netlify / Cloudflare

---

## 10. Roadmap Snapshot

Immediate next steps:

- Add .env.example
- Add Makefile with dev shortcuts
- Begin API refinement + type tightening
- Begin frontend scaffolding

Longer-term:

- Leaderboards
- Player profiles
- Season summaries
- Advanced game analytics

---
