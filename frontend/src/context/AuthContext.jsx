import { createContext, useCallback, useMemo, useState } from 'react';

const STORAGE_KEY = 'chatapp:user';
const MAX_USERNAME_LENGTH = 50;

export const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback((rawUsername) => {
    const trimmed = String(rawUsername ?? '').trim();
    if (!trimmed) {
      throw new Error('Username cannot be empty');
    }
    if (trimmed.length > MAX_USERNAME_LENGTH) {
      throw new Error(`Username must be at most ${MAX_USERNAME_LENGTH} characters`);
    }
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // localStorage disabled — proceed without persistence
    }
    setUser(trimmed);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isAuthenticated: user !== null,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
