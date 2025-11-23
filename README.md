# Hanabi Events

Backend + (future) frontend for running structured Hanabi event
instances (formerly called "challenges"), tracking teams, and recording game results.

## Project Structure

- backend/ – Node + TypeScript API (Express), PostgreSQL, Vitest tests
- tests/ – Unit tests live under backend/tests
- config/ – Database configuration and connection pool

(Frontend to be added later.)

## Development

### Prerequisites

- Node.js 20 (see `.nvmrc`)
- PostgreSQL running with the expected schema + sample_data.sql loaded

### Installing tools

From the repo root:

```bash
npm install            # tooling (lint, prettier, husky, lint-staged)
cd backend
npm install            # backend runtime + test dependencies
```

### Linting and formatting

From repo root:

```bash
npm run lint           # ESLint
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier check
npm run format:fix     # Prettier apply
```

### Running tests

From backend directory:

```bash
cd backend
npm test
```

## CI

GitHub Actions workflow runs on push/PR to main:

- Lint (npm run lint)
- Backend tests (npm test inside backend/)
