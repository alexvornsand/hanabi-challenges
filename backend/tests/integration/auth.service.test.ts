// backend/tests/unit/auth.service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/config/db';
import { loginOrCreateUser } from '../../src/modules/auth/auth.service';

describe('loginOrCreateUser', () => {
  const TEST_DISPLAY_NAME = 'unit_test_user';

  // Make sure we start clean for our test user
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE display_name = $1', [TEST_DISPLAY_NAME]);
  });

  // And clean up afterward so repeated runs don't fail on unique constraint
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE display_name = $1', [TEST_DISPLAY_NAME]);
  });

  it('creates a new user when display_name does not exist', async () => {
    const result = await loginOrCreateUser(TEST_DISPLAY_NAME, 'secretpw');

    expect(result.mode).toBe('created');
    expect(result.user.display_name).toBe(TEST_DISPLAY_NAME);
    expect(result.user.role).toBe('USER'); // default role from your schema
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);

    // Optionally, verify it really hit the DB
    const dbCheck = await pool.query(
      'SELECT display_name, role FROM users WHERE display_name = $1',
      [TEST_DISPLAY_NAME],
    );
    expect(dbCheck.rowCount).toBe(1);
    expect(dbCheck.rows[0].role).toBe('USER');
  });

  it('logs in an existing user with correct password', async () => {
    // alice is in sample_data.sql with password "alicepw"
    const result = await loginOrCreateUser('alice', 'alicepw');

    expect(result.mode).toBe('login');
    expect(result.user.display_name).toBe('alice');
    expect(result.user.role).toBe('SUPERADMIN'); // from sample_data.sql
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('throws INVALID_CREDENTIALS error when password is wrong', async () => {
    // alice exists, but we pass the wrong password
    await expect(loginOrCreateUser('alice', 'wrong-password')).rejects.toMatchObject({
      message: 'Invalid credentials',
      // our service sets error.code = "INVALID_CREDENTIALS"
      // but TS doesn't know about it; we still assert it here:
      code: 'INVALID_CREDENTIALS',
    } as { message: string; code: string });
  });
});
