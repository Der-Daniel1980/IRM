'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Skill } from './use-skills';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'MINI_JOB' | 'FREELANCER';
export type SkillLevel = 'BASIC' | 'INTERMEDIATE' | 'EXPERT';

export interface StaffSkill {
  staffId: string;
  skillId: string;
  level: SkillLevel;
  certifiedUntil: string | null;
  createdAt: string;
  skill: Pick<Skill, 'id' | 'name' | 'category' | 'icon' | 'requiresCertification'>;
  warningExpiringSoon: boolean;
}

export interface Staff {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  employmentType: EmploymentType;
  weeklyHours: string | null;
  color: string;
  isActive: boolean;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  skills: StaffSkill[];
}

export interface PaginatedStaff {
  data: Staff[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StaffQuery {
  search?: string;
  isActive?: boolean;
  employmentType?: EmploymentType;
  skillId?: string;
  page?: number;
  limit?: number;
}

export interface CreateStaffData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  employmentType?: EmploymentType;
  weeklyHours?: number;
  color?: string;
  userId?: string;
}

export interface UpdateStaffData extends Partial<CreateStaffData> {
  isActive?: boolean;
}

export interface AssignSkillData {
  skillId: string;
  level: SkillLevel;
  certifiedUntil?: string;
}

export interface StaffCalendar {
  absences: StaffAbsence[];
  workOrders: StaffWorkOrder[];
}

export interface StaffAbsence {
  id: string;
  staffId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
}

export interface StaffWorkOrder {
  id: string;
  orderNumber: string;
  title: string;
  plannedDate: string | null;
  plannedStartTime: string | null;
  plannedDurationMin: number | null;
  status: string;
  property?: {
    id: string;
    name: string;
    addressStreet: string;
    addressCity: string;
  };
  activityType?: {
    id: string;
    name: string;
  };
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const staffKeys = {
  all: ['staff'] as const,
  lists: () => [...staffKeys.all, 'list'] as const,
  list: (query: StaffQuery) => [...staffKeys.lists(), query] as const,
  details: () => [...staffKeys.all, 'detail'] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
  calendar: (id: string, from: string, to: string) => [...staffKeys.all, 'calendar', id, from, to] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useStaffList(query: StaffQuery = {}) {
  return useQuery<PaginatedStaff>({
    queryKey: staffKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
      if (query.employmentType) params.set('employmentType', query.employmentType);
      if (query.skillId) params.set('skillId', query.skillId);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await api.get<PaginatedStaff>(`/staff?${params.toString()}`);
      return response.data;
    },
  });
}

export function useStaff(id: string) {
  return useQuery<Staff>({
    queryKey: staffKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<Staff>(`/staff/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation<Staff, Error, CreateStaffData>({
    mutationFn: async (data) => {
      const response = await api.post<Staff>('/staff', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
    },
  });
}

export function useUpdateStaff(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Staff, Error, UpdateStaffData>({
    mutationFn: async (data) => {
      const response = await api.patch<Staff>(`/staff/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.setQueryData(staffKeys.detail(id), updated);
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation<Staff, Error, string>({
    mutationFn: async (staffId) => {
      const response = await api.delete<Staff>(`/staff/${staffId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
    },
  });
}

export function useAssignSkill(staffId: string) {
  const queryClient = useQueryClient();

  return useMutation<Staff, Error, AssignSkillData>({
    mutationFn: async (data) => {
      const response = await api.post<Staff>(`/staff/${staffId}/skills`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(staffKeys.detail(staffId), updated);
    },
  });
}

export function useRemoveSkill(staffId: string) {
  const queryClient = useQueryClient();

  return useMutation<Staff, Error, string>({
    mutationFn: async (skillId) => {
      const response = await api.delete<Staff>(`/staff/${staffId}/skills/${skillId}`);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(staffKeys.detail(staffId), updated);
    },
  });
}

export function useStaffCalendar(staffId: string, from: string, to: string) {
  return useQuery<StaffCalendar>({
    queryKey: staffKeys.calendar(staffId, from, to),
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const response = await api.get<StaffCalendar>(`/staff/${staffId}/calendar?${params.toString()}`);
      return response.data;
    },
    enabled: Boolean(staffId) && Boolean(from) && Boolean(to),
  });
}
