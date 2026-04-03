import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  setStaffId,
  clearAll,
  getServerUrl,
} from '../lib/storage';
import { getApi, resetApi } from '../lib/api';

interface StaffProfile {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  color: string;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isServerConfigured: boolean;
  staff: StaffProfile | null;
  todayOrderCount: number;
  inProgressCount: number;
}

interface AuthContextType extends AuthState {
  signIn: (accessToken: string, refreshToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isServerConfigured: false,
    staff: null,
    todayOrderCount: 0,
    inProgressCount: 0,
  });

  const fetchProfile = useCallback(async (): Promise<boolean> => {
    try {
      const api = await getApi();
      const { data } = await api.get('/mobile/me');
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        staff: data.staff,
        todayOrderCount: data.todayOrderCount,
        inProgressCount: data.inProgressCount,
      }));
      await setStaffId(data.staff.id);
      return true;
    } catch (error: any) {
      if (error.response?.status === 403) {
        Alert.alert(
          'Kein Zugriff',
          'Ihr Benutzerkonto ist keinem Mitarbeiterprofil zugeordnet. Bitte kontaktieren Sie die Administration.',
        );
      }
      return false;
    }
  }, []);

  // Initiale Prüfung
  useEffect(() => {
    (async () => {
      const serverUrl = await getServerUrl();
      if (!serverUrl) {
        setState((prev) => ({ ...prev, isLoading: false, isServerConfigured: false }));
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isServerConfigured: true,
        }));
        return;
      }

      const success = await fetchProfile();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isServerConfigured: true,
        isAuthenticated: success,
      }));
    })();
  }, [fetchProfile]);

  const signIn = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      await setAccessToken(accessToken);
      if (refreshToken) {
        await setRefreshToken(refreshToken);
      }
      resetApi();

      const success = await fetchProfile();
      if (!success) {
        await clearAll();
        resetApi();
      }
    },
    [fetchProfile],
  );

  const signOut = useCallback(async () => {
    await clearAll();
    resetApi();
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      staff: null,
      todayOrderCount: 0,
      inProgressCount: 0,
    }));
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  }
  return context;
}
