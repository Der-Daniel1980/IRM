'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getKeycloak } from '@/lib/keycloak';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseUserFromToken(keycloak: import('keycloak-js').default): AuthUser | null {
  const parsed = keycloak.tokenParsed;
  if (!parsed) return null;

  const roles: string[] = (parsed['roles'] as string[]) ?? [];

  return {
    id: parsed.sub ?? '',
    username: (parsed['preferred_username'] as string) ?? '',
    email: (parsed['email'] as string) ?? '',
    firstName: (parsed['given_name'] as string) ?? '',
    lastName: (parsed['family_name'] as string) ?? '',
    fullName: (parsed['name'] as string) ?? '',
    roles,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  const startTokenRefresh = useCallback((keycloak: import('keycloak-js').default) => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    // Check token every 60 s, refresh if it expires within 70 s
    refreshIntervalRef.current = setInterval(() => {
      keycloak
        .updateToken(70)
        .then((refreshed) => {
          if (refreshed) {
            setToken(keycloak.token ?? null);
          }
        })
        .catch(() => {
          // Refresh failed — force re-login
          keycloak.login();
        });
    }, 60_000);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const kc = getKeycloak();

    kc.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    })
      .then((authenticated) => {
        if (authenticated) {
          setIsAuthenticated(true);
          setToken(kc.token ?? null);
          setUser(parseUserFromToken(kc));
          startTokenRefresh(kc);
        } else {
          // login-required should have redirected; this branch is a safety net
          kc.login();
        }
      })
      .catch((err) => {
        console.error('Keycloak init error:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Keep token state in sync with keycloak-js internal events
    kc.onAuthSuccess = () => {
      setIsAuthenticated(true);
      setToken(kc.token ?? null);
      setUser(parseUserFromToken(kc));
    };

    kc.onAuthRefreshSuccess = () => {
      setToken(kc.token ?? null);
    };

    kc.onAuthLogout = () => {
      setIsAuthenticated(false);
      setToken(null);
      setUser(null);
    };

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [startTokenRefresh]);

  const logout = useCallback(() => {
    const kc = getKeycloak();
    kc.logout({ redirectUri: window.location.origin });
  }, []);

  const hasRole = useCallback(
    (role: string) => user?.roles.includes(role) ?? false,
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, token, logout, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
