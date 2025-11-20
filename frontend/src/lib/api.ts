// src/lib/api.ts
const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ignore JSON parse errors; body stays null
  }

  if (!res.ok) {
    throw new ApiError(`Request failed with status ${res.status}`, res.status, body);
  }

  // If JSON parsing failed above, body will be null and this will throw,
  // but for our use case we expect JSON from the API.
  return body as T;
}
