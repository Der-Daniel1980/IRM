'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Skill } from '@/hooks/use-skills';
import type { Equipment } from '@/hooks/use-equipment';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type RecurrenceInterval =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'SEASONAL';

export interface ActivityType {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  defaultDurationMin: number;
  isRecurring: boolean;
  recurrenceInterval: RecurrenceInterval | null;
  seasonStart: number | null;
  seasonEnd: number | null;
  icon: string;
  color: string;
  isActive: boolean;
  requiredSkills: Skill[];
  defaultEquipment: Equipment[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedActivityTypes {
  data: ActivityType[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityTypesQuery {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateActivityTypeData {
  code: string;
  name: string;
  category: string;
  description?: string;
  defaultDurationMin?: number;
  isRecurring?: boolean;
  recurrenceInterval?: RecurrenceInterval | null;
  seasonStart?: number | null;
  seasonEnd?: number | null;
  icon?: string;
  color?: string;
  isActive?: boolean;
  requiredSkillIds?: string[];
  defaultEquipmentIds?: string[];
}

export interface UpdateActivityTypeData extends Partial<CreateActivityTypeData> {}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const activityTypeKeys = {
  all: ['activity-types'] as const,
  lists: () => [...activityTypeKeys.all, 'list'] as const,
  list: (query: ActivityTypesQuery) => [...activityTypeKeys.lists(), query] as const,
  details: () => [...activityTypeKeys.all, 'detail'] as const,
  detail: (id: string) => [...activityTypeKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useActivityTypes(query: ActivityTypesQuery = {}) {
  return useQuery<PaginatedActivityTypes>({
    queryKey: activityTypeKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.category) params.set('category', query.category);
      if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await api.get<PaginatedActivityTypes>(
        `/activity-types?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useActivityType(id: string) {
  return useQuery<ActivityType>({
    queryKey: activityTypeKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<ActivityType>(`/activity-types/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateActivityType() {
  const queryClient = useQueryClient();

  return useMutation<ActivityType, Error, CreateActivityTypeData>({
    mutationFn: async (data) => {
      const response = await api.post<ActivityType>('/activity-types', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityTypeKeys.lists() });
    },
  });
}

export function useUpdateActivityType(id: string) {
  const queryClient = useQueryClient();

  return useMutation<ActivityType, Error, UpdateActivityTypeData>({
    mutationFn: async (data) => {
      const response = await api.patch<ActivityType>(`/activity-types/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: activityTypeKeys.lists() });
      queryClient.setQueryData(activityTypeKeys.detail(id), updated);
    },
  });
}

export function useDeleteActivityType() {
  const queryClient = useQueryClient();

  return useMutation<ActivityType, Error, string>({
    mutationFn: async (activityTypeId) => {
      const response = await api.delete<ActivityType>(`/activity-types/${activityTypeId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityTypeKeys.lists() });
    },
  });
}
