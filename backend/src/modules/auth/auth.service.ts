// src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import type { UserRole } from '../../middleware/authMiddleware';

class InvalidCredentialsError extends Error {
  code = 'INVALID_CREDENTIALS';
}

export type Role = UserRole; // "SUPERADMIN" | "ADMIN" | "USER"

export interface AuthUser {
  id: number;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface LoginResult {
  mode: 'created' | 'login';
  user: AuthUser;
  token: string;
}

function createToken(user: AuthUser): string {
  return jwt.sign(
    {
      userId: user.id,
      displayName: user.display_name,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

/**
 * Log in an existing user by display_name + password,
 * or create a new user if none exists.
 */
export async function loginOrCreateUser(
  display_name: string,
  password: string,
): Promise<LoginResult> {
  // 1) Look up the user
  const result = await pool.query(
    `
    SELECT id, display_name, password_hash, role, created_at
    FROM users
    WHERE display_name = $1;
    `,
    [display_name],
  );

  // 2) User doesn't exist → create as USER
  if (result.rowCount === 0) {
    const passwordHash = await bcrypt.hash(password, 12);

    const insertResult = await pool.query(
      `
      INSERT INTO users (display_name, password_hash)
      VALUES ($1, $2)
      RETURNING id, display_name, role, created_at;
      `,
      [display_name, passwordHash],
    );

    const newUser: AuthUser = insertResult.rows[0];
    const token = createToken(newUser);

    return {
      mode: 'created',
      user: newUser,
      token,
    };
  }

  // 3) User exists → check password
  const userRow = result.rows[0];

  const isMatch = await bcrypt.compare(password, userRow.password_hash);
  if (!isMatch) {
    throw new InvalidCredentialsError('Invalid credentials');
  }

  const user: AuthUser = {
    id: userRow.id,
    display_name: userRow.display_name,
    role: userRow.role,
    created_at: userRow.created_at,
  };

  const token = createToken(user);

  return {
    mode: 'login',
    user,
    token,
  };
}
