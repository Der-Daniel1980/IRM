'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type AbsenceType = 'VACATION' | 'SICK' | 'TRAINING' | 'PERSONAL' | 'COMP_TIME';
export type AbsenceStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  VACATION: 'Urlaub',
  SICK: 'Krankheit',
  TRAINING: 'Fortbildung',
  PERSONAL: 'Persönlich',
  COMP_TIME: 'Überstunden',
};

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  REQUESTED: 'Beantragt',
  APPROVED: 'Genehmigt',
  REJECTED: 'Abgelehnt',
  CANCELLED: 'Storniert',
};

export const ABSENCE_TYPE_COLORS: Record<AbsenceType, string> = {
  VACATION: 'orange',
  SICK: 'red',
  TRAINING: 'blue',
  PERSONAL: 'purple',
  COMP_TIME: 'gray',
};

export interface AbsenceStaff {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  color: string;
}

export interface Absence {
  id: string;
  staffId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  status: AbsenceStatus;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  staff: AbsenceStaff;
}

export interface PaginatedAbsences {
  data: Absence[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AbsencesQuery {
  staffId?: string;
  type?: AbsenceType;
  status?: AbsenceStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface CreateAbsenceData {
  staffId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface UpdateAbsenceData {
  type?: AbsenceType;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface ApproveRejectData {
  notes?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const absenceKeys = {
  all: ['absences'] as const,
  lists: () => [...absenceKeys.all, 'list'] as const,
  list: (query: AbsencesQuery) => [...absenceKeys.lists(), query] as const,
  details: () => [...absenceKeys.all, 'detail'] as const,
  detail: (id: string) => [...absenceKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAbsences(query: AbsencesQuery = {}) {
  return useQuery<PaginatedAbsences>({
    queryKey: absenceKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.staffId) params.set('staffId', query.staffId);
      if (query.type) params.set('type', query.type);
      if (query.status) params.set('status', query.status);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await api.get<PaginatedAbsences>(`/absences?${params.toString()}`);
      return response.data;
    },
  });
}

export function useAbsence(id: string) {
  return useQuery<Absence>({
    queryKey: absenceKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<Absence>(`/absences/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateAbsence() {
  const queryClient = useQueryClient();

  return useMutation<Absence, Error, CreateAbsenceData>({
    mutationFn: async (data) => {
      const response = await api.post<Absence>('/absences', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: absenceKeys.lists() });
    },
  });
}

export function useUpdateAbsence(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Absence, Error, UpdateAbsenceData>({
    mutationFn: async (data) => {
      const response = await api.patch<Absence>(`/absences/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: absenceKeys.lists() });
      queryClient.setQueryData(absenceKeys.detail(id), updated);
    },
  });
}

export function useCancelAbsence() {
  const queryClient = useQueryClient();

  return useMutation<Absence, Error, string>({
    mutationFn: async (absenceId) => {
      const response = await api.delete<Absence>(`/absences/${absenceId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: absenceKeys.lists() });
    },
  });
}

export function useApproveAbsence() {
  const queryClient = useQueryClient();

  return useMutation<Absence, Error, { id: string; data: ApproveRejectData }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.post<Absence>(`/absences/${id}/approve`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: absenceKeys.lists() });
      queryClient.setQueryData(absenceKeys.detail(updated.id), updated);
    },
  });
}

export function useRejectAbsence() {
  const queryClient = useQueryClient();

  return useMutation<Absence, Error, { id: string; data: ApproveRejectData }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.post<Absence>(`/absences/${id}/reject`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: absenceKeys.lists() });
      queryClient.setQueryData(absenceKeys.detail(updated.id), updated);
    },
  });
}
