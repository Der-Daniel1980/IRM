'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ──────────────────────────────────────────────────────────────────

export type EquipmentCategory = 'MACHINE' | 'VEHICLE' | 'TOOL' | 'MATERIAL';
export type EquipmentStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'BROKEN';

export interface Equipment {
  id: string;
  equipmentNumber: string;
  name: string;
  category: EquipmentCategory;
  equipmentType: string;
  licensePlate: string | null;
  requiresLicense: boolean;
  requiredLicenseType: string | null;
  location: string | null;
  status: EquipmentStatus;
  nextMaintenance: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEquipment {
  data: Equipment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EquipmentQuery {
  search?: string;
  category?: EquipmentCategory;
  status?: EquipmentStatus;
  page?: number;
  limit?: number;
}

export interface CreateEquipmentData {
  name: string;
  category: EquipmentCategory;
  equipmentType: string;
  licensePlate?: string;
  requiresLicense?: boolean;
  requiredLicenseType?: string;
  location?: string;
  nextMaintenance?: string;
  notes?: string;
}

export interface UpdateEquipmentData extends Partial<CreateEquipmentData> {
  status?: EquipmentStatus;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const equipmentKeys = {
  all: ['equipment'] as const,
  lists: () => [...equipmentKeys.all, 'list'] as const,
  list: (query: EquipmentQuery) => [...equipmentKeys.lists(), query] as const,
  details: () => [...equipmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...equipmentKeys.details(), id] as const,
  available: () => [...equipmentKeys.all, 'available'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useEquipmentList(query: EquipmentQuery = {}) {
  return useQuery<PaginatedEquipment>({
    queryKey: equipmentKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.category) params.set('category', query.category);
      if (query.status) params.set('status', query.status);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await api.get<PaginatedEquipment>(
        `/equipment?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useEquipment(id: string) {
  return useQuery<Equipment>({
    queryKey: equipmentKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<Equipment>(`/equipment/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useAvailableEquipment() {
  return useQuery<Equipment[]>({
    queryKey: equipmentKeys.available(),
    queryFn: async () => {
      const response = await api.get<Equipment[]>('/equipment/available');
      return response.data;
    },
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();

  return useMutation<Equipment, Error, CreateEquipmentData>({
    mutationFn: async (data) => {
      const response = await api.post<Equipment>('/equipment', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.available() });
    },
  });
}

export function useUpdateEquipment(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Equipment, Error, UpdateEquipmentData>({
    mutationFn: async (data) => {
      const response = await api.patch<Equipment>(`/equipment/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.available() });
      queryClient.setQueryData(equipmentKeys.detail(id), updated);
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation<Equipment, Error, string>({
    mutationFn: async (equipmentId) => {
      const response = await api.delete<Equipment>(`/equipment/${equipmentId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.available() });
    },
  });
}
