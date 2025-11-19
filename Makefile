# Root-level Makefile for Hanabi Challenges

# Install dependencies at root and in backend/
install:
	npm install
	cd backend && npm install

# Run ESLint across the repo
lint:
	npm run lint

# Auto-fix lint and format issues (ESLint + Prettier)
fmt:
	npm run lint:fix
	npm run format:fix

# Run backend unit tests
test:
	cd backend && npm test

# Start backend in dev mode (once you add a dev script)
dev-backend:
	cd backend && npm run dev

# Run the same checks CI does (lint + backend tests)
ci:
	npm run lint
	cd backend && npm test
