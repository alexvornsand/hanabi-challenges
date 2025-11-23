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
  color_hex: string;
  text_color: string;
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
      color_hex: user.color_hex,
      text_color: user.text_color,
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
    SELECT id, display_name, password_hash, role, color_hex, text_color, created_at
    FROM users
    WHERE display_name = $1;
    `,
    [display_name],
  );

  // 2) User doesn't exist → create as USER
  if (result.rowCount === 0) {
    const passwordHash = await bcrypt.hash(password, 12);

    const color_hex = randomHexColor();
    const text_color = pickTextColor(color_hex);

    const insertResult = await pool.query(
      `
      INSERT INTO users (display_name, password_hash, color_hex, text_color)
      VALUES ($1, $2, $3, $4)
      RETURNING id, display_name, role, color_hex, text_color, created_at;
      `,
      [display_name, passwordHash, color_hex, text_color],
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
  const userRow = result.rows[0] as {
    id: number;
    display_name: string;
    password_hash: string;
    role: Role;
    color_hex: string | null;
    text_color: string | null;
    created_at: string;
  };

  const isMatch = await bcrypt.compare(password, userRow.password_hash);
  if (!isMatch) {
    throw new InvalidCredentialsError('Invalid credentials');
  }

  // Backfill missing colors for legacy accounts
  if (!userRow.color_hex || !userRow.text_color) {
    const newColor = randomHexColor();
    const newText = pickTextColor(newColor);
    await pool.query(
      `
      UPDATE users
      SET color_hex = $1, text_color = $2
      WHERE id = $3;
      `,
      [newColor, newText, userRow.id],
    );
    userRow.color_hex = newColor;
    userRow.text_color = newText;
  }

  const user: AuthUser = {
    id: userRow.id,
    display_name: userRow.display_name,
    role: userRow.role,
    color_hex: userRow.color_hex,
    text_color: userRow.text_color,
    created_at: userRow.created_at,
  };

  const token = createToken(user);

  return {
    mode: 'login',
    user,
    token,
  };
}

export function randomHexColor(): string {
  const n = Math.floor(Math.random() * 0xffffff);
  return `#${n.toString(16).padStart(6, '0')}`;
}

// WCAG contrast heuristic against white/black
export function pickTextColor(hex: string): '#000000' | '#ffffff' {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  const full = m ? m[1] : '777777';
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const [R, G, B] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;

  return luminance > 0.179 ? '#000000' : '#ffffff';
}
