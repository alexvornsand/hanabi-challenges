# TODO for Hanabi Challenges

A living document outlining all major workstreams for the project.
Completed items are marked with ~~strikethrough~~.

---

## 0. Repository Setup (Completed)

### Tooling & Quality Gates
- ~~Initialize root-level package.json~~
- ~~Set up ESLint (flat config)~~
- ~~Eliminate all `any` linter violations in backend code~~
- ~~Install & configure Prettier~~
- ~~Add lint and format npm scripts~~
- ~~Set up lint-staged for staged-file lint/format~~
- ~~Set up Husky v9 pre-commit hook~~
- ~~Add GitHub Actions CI (lint + backend tests)~~

### Repo Hygiene
- ~~Add .gitignore~~
- ~~Add .nvmrc pinned to Node 20~~
- ~~Add .editorconfig~~
- ~~Add README.md~~

---

## 1. Backend: API Foundation

### 1.1 Architecture / Project Structure
- [ ] Add clear folder structure documentation in README or a separate ARCHITECTURE.md
- [ ] Introduce request/response type definitions for each endpoint
- [ ] Add error classes for every domain error (currently partially implemented)

### 1.2 Auth Module
- [ ] Add password hashing config (salt rounds, etc.)
- [ ] Add JWT expiration strategy (configurable)
- [ ] Add route-level authorization helpers (admin/superadmin)

### 1.3 Challenges Module
- [ ] Define business rules for challenge lifecycle (active/inactive/upcoming)
- [ ] Add validation layer (Zod or custom guards)
- [ ] Add pagination to list endpoints (optional)
- [ ] Add update/delete routes if needed

### 1.4 Seeds Module
- [ ] Decide whether `seed_payload` should remain TEXT or become JSONB
- [ ] Add seed update/delete endpoints
- [ ] Add seed validation (payload schema?)

### 1.5 Teams Module
- [ ] Add team update/delete
- [ ] Add team enrollment logic (auto-enroll? manually enroll?)
- [ ] Add membership role elevation/demotion
- [ ] Add guard rails around duplicate memberships (currently minimized)

### 1.6 Results Module
- [ ] Decide whether `zero_reason` should be an enum in DB
- [ ] Add update/delete game result endpoints
- [ ] Add summary queries (team score history, challenge leaderboard, etc.)
- [ ] Add seat-order / player-order rules if future extensions need it

### 1.7 Database / SQL
- [ ] Add a top-level `schema/` directory containing:
    - schema.sql
    - sample_data.sql
    - migrations/ (once chosen migration tool)
- [ ] Select DB migration tool (options: Liquibase, DBMate, Prisma Migrate, node-pg-migrate)
- [ ] Automate setup for local dev DB

### 1.8 Testing
- [ ] Add integration tests hitting a real PostgreSQL test DB
- [ ] Add service-level mocks where appropriate
- [ ] Add route-level tests once frontend API is frozen
- [ ] Add test utilities for creating clean fixtures (teams, seeds, etc.)

---

## 2. Frontend (React, likely next major phase)

### 2.1 Setup
- [ ] Initialize React app using Vite or Next.js
- [ ] Add TypeScript and ESLint config mirroring backend rules
- [ ] Add component structure for pages (Overview → Challenge → Team → Result detail)

### 2.2 Pages
- [ ] Overview page listing all challenges with metadata
- [ ] Challenge page listing seeds + teams
- [ ] Team page showing roster, allow edits if owned by user
- [ ] Results page (2–6p versions) showing summary results
- [ ] Single result detail page (players, replay link, notes)

### 2.3 API Integration
- [ ] Add typed API client (Axios or fetch wrapper)
- [ ] Add React Query for data caching
- [ ] Add auth token persistence, refresh strategy

### 2.4 UI/UX
- [ ] Choose design system (Chakra? Tailwind? MUI?)
- [ ] Add reusable components (tables, forms, banners)
- [ ] Handle error states + loading skeletons

---

## 3. Deployment & Environments

### 3.1 Backend
- [ ] Dockerfile for backend
- [ ] Docker Compose for local dev (backend + db)
- [ ] Production image hardening
- [ ] Add environment variable schema validation

### 3.2 Frontend
- [ ] Build pipeline for static export or server-side deploy
- [ ] Production hosting (Vercel? Netlify? Cloudflare?)

### 3.3 Database
- [ ] Managed DB or hosted Postgres
- [ ] Automated migrations via CI/CD
- [ ] Backups + restore plan

---

## 4. Project Management & Documentation

- [ ] Add CONTRIBUTING.md
- [ ] Add CODE_OF_CONDUCT.md
- [ ] Add issue templates + PR templates
- [ ] Create milestone breakdowns for backend MVP
- [ ] Create frontend MVP milestones
- [ ] Add high-level architecture diagram
- [ ] Add API contract documentation in `docs/api/`

---

## 5. Future Feature Ideas / Stretch Goals

- [ ] Real-time challenge leaderboards
- [ ] Team performance analytics (graphs, aggregates)
- [ ] Public/Private challenge modes
- [ ] Multi-challenge seasons
- [ ] Hanab.live replay embedding or linking
- [ ] Player statistics & profile pages

---

## 6. Completed Items

- ~~Initialize repo-level lint/format tooling~~
- ~~Fix all `any` usage across backend~~
- ~~Add Prettier config + scripts~~
- ~~Install lint-staged + Husky v9 with pre-commit hook~~
- ~~Add GitHub Actions workflow (CI for lint + backend tests)~~
- ~~Add .gitignore, .nvmrc, .editorconfig~~
- ~~Add initial README.md~~

