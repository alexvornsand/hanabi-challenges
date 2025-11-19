# Hanabi Challenges – Project TODO

A sequential, hierarchical outline of work for the project, starting from a blank repo.  
Items that are already done are marked with [x].  
Items not yet done are marked with [ ].

---

## 0. Foundations & Repository Setup

### 0.1 Initialize Repository & Version Control
- [x] Create Git repository for `hanabi-challenges`
- [x] Initialize root-level `package.json`
- [x] Commit initial repository structure

### 0.2 Core Tooling & Quality Gates
- [x] Add ESLint (flat-config) at repo root
- [x] Configure ESLint to lint backend TypeScript sources and unit tests
- [x] Add Prettier at root
- [x] Add lint, lint:fix, format, and format:fix scripts
- [x] Integrate ESLint + Prettier cleanly

### 0.3 Commit Hooks & Local Dev Workflow
- [x] Install Husky v9
- [x] Install lint-staged
- [x] Configure lint-staged for TS/JS/JSON/MD/YAML
- [x] Add Husky pre-commit hook using lint-staged

### 0.4 Repo Hygiene & Metadata
- [x] Add .gitignore
- [x] Add .nvmrc
- [x] Add .editorconfig
- [x] Add README.md
- [x] Add CONTRIBUTING.md
- [x] Add MIT LICENSE
- [x] Add ARCHITECTURE.md
- [x] Add TODO.md
- [x] Add .env.example
- [x] Add Makefile with shortcuts

---

## 1. Database & Schema

### 1.1 Schema Files & Structure
- [x] Maintain db/schema.sql defining all tables
- [x] Maintain db/sample_data.sql with initial users, challenges, seeds, teams, enrollments, and game data

### 1.2 DB Access Layer
- [x] backend/src/config/db.ts uses DATABASE_URL
- [ ] Optional: SSL config for production
- [ ] Optional: Pool tuning
- [ ] Optional: Health checks

### 1.3 Future DB Enhancements
- [ ] Introduce migration tooling
- [x] Create db/migrations directory
- [ ] Replace raw schema loading in CI with migrations

---

## 2. Environment Configuration

### 2.1 Env Validation
- [ ] backend/src/config/env.ts should validate:
  - DATABASE_URL
  - JWT_SECRET
  - NODE_ENV
  - future vars (JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS)

### 2.2 .env.example Alignment
- [x] Add DATABASE_URL
- [x] Add JWT_SECRET
- [x] Add NODE_ENV
- [ ] Keep aligned as new envs added

---

## 3. Backend: Auth Module

### 3.1 Current Functionality
- [x] loginOrCreateUser
- [x] createToken with JWT_SECRET
- [x] POST /api/login
- [x] GET /api/me

### 3.2 Improvements
- [ ] Consider JWT_EXPIRES_IN env support
- [ ] Consider BCRYPT_SALT_ROUNDS env support

### 3.3 Future Features
- [ ] Password reset/change
- [ ] Email identity (optional)
- [ ] Session invalidation (optional)

---

## 4. Backend: Core Modules

### 4.1 Challenges Module
- [x] listChallenges
- [x] createChallenge (+ conflict mapping)
- [x] listChallengeSeeds
- [x] createChallengeSeed (+ conflict mapping)
- [x] listChallengeTeams

#### Future Improvements
- [ ] Challenge status field (Upcoming/Active/Completed)
- [ ] PATCH /api/challenges/:id
- [ ] DELETE or archive challenges

### 4.2 Teams Module
- [x] listTeamMembers
- [x] createTeamWithCreator
- [x] addTeamMember
- [x] listMemberCandidates

#### Future Improvements
- [ ] PATCH team metadata
- [ ] DELETE or archive team
- [ ] PATCH team member role/listing
- [ ] Ensure at least one MANAGER always exists

### 4.3 Results Module
- [x] createGameResult
- [x] getGameResultById (hydrated)

#### Future Improvements
- [ ] POST /api/results
- [ ] GET /api/results/:id
- [ ] PATCH /api/results/:id
- [ ] Add leaderboards
- [ ] Add statistics endpoints

---

## 5. Middleware & Error Handling

### 5.1 Middleware
- [x] authRequired
- [x] requireAdmin
- [x] requireSuperAdmin

### 5.2 Error Handling
- [x] Map PG 23505 conflicts to domain errors
- [ ] Create central error utility for consistency

---

## 6. Testing Strategy

### 6.1 Unit Tests
- [x] auth.service.test.ts
- [x] challenge.service.test.ts
- [x] result.service.test.ts
- [x] team.service.test.ts
- [x] Confirm tests pass locally and in CI

### 6.2 Enhancements
- [ ] Add edge-case tests
- [ ] Add integration tests using supertest

---

## 7. CI & Automation

### 7.1 CI Pipeline
- [x] GitHub Actions workflow
- [x] Postgres service container
- [x] Schema + sample data loading
- [x] Lint + backend tests
- [x] Set JWT_SECRET + DATABASE_URL + NODE_ENV for CI

### 7.2 Future Enhancements
- [ ] Add tsc type-checking step
- [ ] Cache node_modules
- [ ] Add coverage report
- [ ] Add integration test job

---

## 8. Frontend (Future)

### 8.1 Setup
- [ ] Select stack (Vite+React or Next.js)
- [ ] Initialize frontend/
- [ ] Add linting + formatting

### 8.2 Core Pages
- [ ] Overview page
- [ ] Challenge detail page
- [ ] Team page with roster editing
- [ ] Results overviews
- [ ] Result detail page

### 8.3 API Integration
- [ ] Create API client
- [ ] Add React Query
- [ ] Auth token handling

---

## 9. Deployment

### 9.1 Hosting
- [ ] Choose backend hosting
- [ ] Choose managed Postgres
- [ ] Choose frontend hosting

### 9.2 Deployment Pipeline
- [ ] Add Dockerfile
- [ ] Add migrations
- [ ] Backend deploy workflow
- [ ] Frontend deploy workflow

---

## 10. Stretch Features

- [ ] Leaderboards
- [ ] Player profiles
- [ ] Advanced statistics
- [ ] hanab.live integration
- [ ] Notifications
