# Contributing to Hanabi Challenges

Thanks for your interest in contributing! This document outlines the basic
workflow and expectations for contributing to the project.

This project is still early in development, so contribution guidelines may
evolve over time.

---

## Project Structure

- backend/ – Node + TypeScript, Express API, PostgreSQL, Vitest tests
- tests/ – Unit tests under backend/tests
- .github/workflows/ – CI configuration
- Root tooling:
  - ESLint (flat config)
  - Prettier
  - Husky + lint-staged
  - Node 20 (.nvmrc)

---

## Development Setup

Prerequisites:

- Node 20+
- PostgreSQL running with schema + sample data

Install dependencies:

```bash
npm install
cd backend
npm install
```

Lint and format:

```bash
npm run lint
npm run format
```

Run backend tests:

```bash
cd backend
npm test
```

---

## Branching Model

- main — stable branch, CI must pass before merging
- feature branches — use naming like:

feature/<short-description>  
fix/<short-description>  
refactor/<short-description>

Example:

feature/add-team-update-endpoint

---

## Before Opening a Pull Request

Please ensure:

- ESLint passes (`npm run lint`)
- Prettier formatting is applied (`npm run format:fix`)
- Backend tests pass (`cd backend && npm test`)
- All new or changed logic includes unit tests
- If DB schema or queries change, update relevant tests

---

## Pull Request Guidelines

A PR should include:

- Clear description of problem + solution
- Relevant tests for new behavior
- One logical change per PR (small > large)
- No unrelated formatting changes—lint-staged handles those
- Resolve merge conflicts before requesting review

Commit/PR naming style:

feat: add endpoint for event updates  
fix: correct constraint in addTeamMember service  
refactor: split seed routes into separate controller  
docs: update README with setup instructions

---

## Code Style

We follow:

- ESLint (flat config)
- Prettier
- TypeScript strict mode (no `any` unless justified)
- Strong typing for DB responses
- Error classes for domain errors (when appropriate)

When unsure, match surrounding code.

---

## Commit Hooks

Husky + lint-staged run on commit:

- ESLint autofix
- Prettier autofix

If commit is rejected, resolve issues then retry.

---

## Thank You

Your contributions help shape the project and make the Hanabi Challenge
infrastructure better for everyone. Thanks for being part of it!
