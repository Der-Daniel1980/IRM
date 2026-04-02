'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string | null;
  requiresCertification: boolean;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillsQuery {
  category?: string;
}

export interface CreateSkillData {
  name: string;
  category: string;
  description?: string;
  requiresCertification?: boolean;
  icon?: string;
}

export interface UpdateSkillData extends Partial<CreateSkillData> {}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const skillKeys = {
  all: ['skills'] as const,
  lists: () => [...skillKeys.all, 'list'] as const,
  list: (query: SkillsQuery) => [...skillKeys.lists(), query] as const,
  details: () => [...skillKeys.all, 'detail'] as const,
  detail: (id: string) => [...skillKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSkills(query: SkillsQuery = {}) {
  return useQuery<Skill[]>({
    queryKey: skillKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.category) params.set('category', query.category);

      const response = await api.get<Skill[]>(
        `/skills?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useSkill(id: string) {
  return useQuery<Skill>({
    queryKey: skillKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<Skill>(`/skills/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation<Skill, Error, CreateSkillData>({
    mutationFn: async (data) => {
      const response = await api.post<Skill>('/skills', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
    },
  });
}

export function useUpdateSkill(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Skill, Error, UpdateSkillData>({
    mutationFn: async (data) => {
      const response = await api.patch<Skill>(`/skills/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
      queryClient.setQueryData(skillKeys.detail(id), updated);
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation<Skill, Error, string>({
    mutationFn: async (skillId) => {
      const response = await api.delete<Skill>(`/skills/${skillId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
    },
  });
}
