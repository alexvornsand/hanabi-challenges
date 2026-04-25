import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import React from 'react';
import { apiGet, apiPost } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CurrentUser {
  id: number;
  displayName: string;
  isOrganiser: boolean;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  setUser: (user: CurrentUser | null) => void;
  logout: () => Promise<void>;
}

interface MeResponse {
  user: { id: number; display_name: string; isOrganiser: boolean } | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  setUser: () => undefined,
  logout: async () => undefined,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<MeResponse>('/api/auth/me')
      .then((data) => {
        if (data.user) {
          setUser({
            id: data.user.id,
            displayName: data.user.display_name,
            isOrganiser: data.user.isOrganiser,
          });
        }
      })
      .catch(() => {
        // Not logged in — leave user as null
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await apiPost('/api/auth/logout', {});
    setUser(null);
  }, []);

  return React.createElement(
    AuthContext.Provider,
    { value: { user, loading, setUser, logout } },
    children,
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  return useContext(AuthContext);
}
