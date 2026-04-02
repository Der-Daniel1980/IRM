'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  emailVerified: boolean;
  createdTimestamp: number;
  realmRoles?: string[];
}

export interface KeycloakRole {
  id: string;
  name: string;
  description?: string;
  composite: boolean;
  clientRole: boolean;
  containerId: string;
}

export interface SystemSettings {
  workDayStart: string;
  workDayEnd: string;
  bufferBetweenOrdersMin: number;
  companyName: string;
  companyAddress: string;
  defaultMowRateSqmPerHour: number;
  defaultClearRateSqmPerHour: number;
}

export interface CreateUserData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  initialPassword?: string;
  roles?: string[];
  enabled?: boolean;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

export type UpdateSettingsData = Partial<SystemSettings>;

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: string) => [...adminKeys.users(), id] as const,
  roles: () => [...adminKeys.all, 'roles'] as const,
  settings: () => [...adminKeys.all, 'settings'] as const,
};

// ─── User-Hooks ───────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery<KeycloakUser[]>({
    queryKey: adminKeys.users(),
    queryFn: async () => {
      const response = await api.get<KeycloakUser[]>('/admin/users');
      return response.data;
    },
    retry: 1,
  });
}

export function useAdminUser(id: string) {
  return useQuery<KeycloakUser>({
    queryKey: adminKeys.user(id),
    queryFn: async () => {
      const response = await api.get<KeycloakUser>(`/admin/users/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
    retry: 1,
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation<KeycloakUser, Error, CreateUserData>({
    mutationFn: async (data) => {
      const response = await api.post<KeycloakUser>('/admin/users', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useUpdateAdminUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation<KeycloakUser, Error, UpdateUserData>({
    mutationFn: async (data) => {
      const response = await api.patch<KeycloakUser>(`/admin/users/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.setQueryData(adminKeys.user(id), updated);
    },
  });
}

export function useDeactivateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation<KeycloakUser, Error, string>({
    mutationFn: async (userId) => {
      const response = await api.delete<KeycloakUser>(`/admin/users/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useAssignAdminRoles(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<KeycloakUser, Error, string[]>({
    mutationFn: async (roles) => {
      const response = await api.post<KeycloakUser>(
        `/admin/users/${userId}/roles`,
        { roles },
      );
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.setQueryData(adminKeys.user(userId), updated);
    },
  });
}

// ─── Rollen-Hooks ─────────────────────────────────────────────────────────────

export function useAdminRoles() {
  return useQuery<KeycloakRole[]>({
    queryKey: adminKeys.roles(),
    queryFn: async () => {
      const response = await api.get<KeycloakRole[]>('/admin/roles');
      return response.data;
    },
    retry: 1,
  });
}

// ─── Settings-Hooks ──────────────────────────────────────────────────────────

export function useSystemSettings() {
  return useQuery<SystemSettings>({
    queryKey: adminKeys.settings(),
    queryFn: async () => {
      const response = await api.get<SystemSettings>('/admin/settings');
      return response.data;
    },
    retry: 1,
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  return useMutation<SystemSettings, Error, UpdateSettingsData>({
    mutationFn: async (data) => {
      const response = await api.patch<SystemSettings>('/admin/settings', data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.settings(), updated);
    },
  });
}
