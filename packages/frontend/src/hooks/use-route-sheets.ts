'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type RouteSheetStatus = 'DRAFT' | 'ISSUED' | 'IN_PROGRESS' | 'COMPLETED';

export const ROUTE_SHEET_STATUS_LABELS: Record<RouteSheetStatus, string> = {
  DRAFT: 'Entwurf',
  ISSUED: 'Ausgegeben',
  IN_PROGRESS: 'In Bearbeitung',
  COMPLETED: 'Abgeschlossen',
};

export const ROUTE_SHEET_STATUS_COLORS: Record<RouteSheetStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export interface RouteSheetWorkOrder {
  id: string;
  orderNumber: string;
  title: string;
  description: string | null;
  plannedDate: string | null;
  plannedStartTime: string | null;
  plannedDurationMin: number | null;
  property: {
    id: string;
    propertyNumber: string;
    name: string;
    addressStreet: string;
    addressZip: string;
    addressCity: string;
    latitude: number | null;
    longitude: number | null;
    units: Array<{
      id: string;
      unitNumber: string;
      floor: string;
      tenantName: string | null;
      tenantPhone: string | null;
    }>;
  };
  activityType: {
    id: string;
    code: string;
    name: string;
    category: string;
    color: string;
  };
  customer: {
    id: string;
    customerNumber: string;
    companyName: string;
  };
}

export interface RouteSheetItem {
  id: string;
  routeSheetId: string;
  workOrderId: string;
  position: number;
  travelTimeMin: number | null;
  distanceKm: string | null;
  workOrder: RouteSheetWorkOrder;
}

export interface RouteSheet {
  id: string;
  sheetNumber: string;
  staffId: string;
  vehicleId: string | null;
  date: string;
  status: RouteSheetStatus;
  totalDurationMin: number | null;
  totalDistanceKm: string | null;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
  items: RouteSheetItem[];
}

export interface PaginatedRouteSheets {
  data: RouteSheet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RouteSheetsQuery {
  staffId?: string;
  date?: string;
  status?: RouteSheetStatus;
  page?: number;
  limit?: number;
}

export interface CreateRouteSheetData {
  staffId: string;
  vehicleId?: string;
  date: string;
  workOrderIds: string[];
}

export interface UpdateRouteSheetData {
  vehicleId?: string | null;
  workOrderIds?: string[];
  status?: RouteSheetStatus;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const routeSheetKeys = {
  all: ['route-sheets'] as const,
  lists: () => [...routeSheetKeys.all, 'list'] as const,
  list: (query: RouteSheetsQuery) => [...routeSheetKeys.lists(), query] as const,
  detail: (id: string) => [...routeSheetKeys.all, 'detail', id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useRouteSheets(query: RouteSheetsQuery = {}) {
  return useQuery({
    queryKey: routeSheetKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.staffId) params.set('staffId', query.staffId);
      if (query.date) params.set('date', query.date);
      if (query.status) params.set('status', query.status);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      const { data } = await api.get<PaginatedRouteSheets>(
        `/route-sheets?${params.toString()}`,
      );
      return data;
    },
    staleTime: 30_000,
  });
}

export function useRouteSheet(id: string) {
  return useQuery({
    queryKey: routeSheetKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<RouteSheet>(`/route-sheets/${id}`);
      return data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateRouteSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateRouteSheetData) => {
      const { data } = await api.post<RouteSheet>('/route-sheets', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: routeSheetKeys.lists() });
    },
  });
}

export function useUpdateRouteSheet(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateRouteSheetData) => {
      const { data } = await api.patch<RouteSheet>(`/route-sheets/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: routeSheetKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: routeSheetKeys.lists() });
    },
  });
}

export function useDeleteRouteSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/route-sheets/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: routeSheetKeys.lists() });
    },
  });
}
