import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgres://localhost:5432/hanabi_test',
      SESSION_SECRET: 'test-secret-that-is-long-enough-for-validation',
      NODE_ENV: 'test',
    },
  },
});
