'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type WorkOrderStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface WorkOrderProperty {
  id: string;
  propertyNumber: string;
  name: string;
  addressStreet: string;
  addressZip: string;
  addressCity: string;
}

export interface WorkOrderCustomer {
  id: string;
  customerNumber: string;
  companyName: string;
}

export interface WorkOrderActivityType {
  id: string;
  code: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  defaultDurationMin: number;
  requiredSkills: Array<{ id: string; name: string; icon: string }>;
  defaultEquipment: Array<{ id: string; name: string }>;
  timeFormulas: Array<{
    id: string;
    name: string;
    isActive: boolean;
    formula: Record<string, unknown>;
    variables: unknown[];
  }>;
}

export interface WorkOrderEquipmentItem {
  id: string;
  workOrderId: string;
  equipmentId: string;
  quantity: number;
  isCheckedOut: boolean;
  notes: string | null;
  equipment: {
    id: string;
    equipmentNumber: string;
    name: string;
    category: string;
  };
}

export interface CalculationParams {
  source: 'formula' | 'previous' | 'manual' | 'default';
  formulaId?: string;
  expression?: string;
  usedValues?: Record<string, number | null>;
  calculatedAt?: string;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;
  propertyId: string;
  customerId: string;
  activityTypeId: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  plannedDate: string | null;
  plannedStartTime: string | null;
  plannedDurationMin: number | null;
  actualStart: string | null;
  actualEnd: string | null;
  actualDurationMin: number | null;
  assignedStaff: string[];
  assignedStaffDetails: { id: string; staffNumber: string; firstName: string; lastName: string; color: string }[];
  assignedEquipment: string[];
  calculationParams: CalculationParams | null;
  previousOrderId: string | null;
  previousDurationMin: number | null;
  notes: string | null;
  completionNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  property: WorkOrderProperty;
  customer: WorkOrderCustomer;
  activityType: WorkOrderActivityType;
  equipment: WorkOrderEquipmentItem[];
}

export interface PreviousOrderInfo {
  id: string;
  orderNumber: string;
  plannedDate: string | null;
  actualDurationMin: number | null;
  plannedDurationMin: number | null;
  completionNotes: string | null;
}

export interface PaginatedWorkOrders {
  data: WorkOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WorkOrdersQuery {
  status?: WorkOrderStatus;
  propertyId?: string;
  assignedStaffId?: string;
  activityTypeId?: string;
  priority?: WorkOrderPriority;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateWorkOrderData {
  propertyId: string;
  activityTypeId: string;
  title: string;
  description?: string;
  priority?: WorkOrderPriority;
  plannedDate?: string;
  plannedStartTime?: string;
  plannedDurationMin?: number;
  assignedStaff?: string[];
  assignedEquipment?: string[];
  notes?: string;
}

export interface UpdateWorkOrderData extends Partial<CreateWorkOrderData> {
  status?: WorkOrderStatus;
  completionNotes?: string;
}

export interface CompleteWorkOrderData {
  completionNotes?: string;
  actualDurationMin?: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const workOrderKeys = {
  all: ['work-orders'] as const,
  lists: () => [...workOrderKeys.all, 'list'] as const,
  list: (query: WorkOrdersQuery) => [...workOrderKeys.lists(), query] as const,
  details: () => [...workOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...workOrderKeys.details(), id] as const,
  previous: (id: string) => [...workOrderKeys.all, 'previous', id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useWorkOrders(query: WorkOrdersQuery = {}) {
  return useQuery<PaginatedWorkOrders>({
    queryKey: workOrderKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.status) params.set('status', query.status);
      if (query.propertyId) params.set('propertyId', query.propertyId);
      if (query.assignedStaffId) params.set('assignedStaffId', query.assignedStaffId);
      if (query.activityTypeId) params.set('activityTypeId', query.activityTypeId);
      if (query.priority) params.set('priority', query.priority);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      if (query.search) params.set('search', query.search);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await api.get<PaginatedWorkOrders>(
        `/work-orders?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useWorkOrder(id: string) {
  return useQuery<WorkOrder>({
    queryKey: workOrderKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<WorkOrder>(`/work-orders/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function usePreviousWorkOrder(id: string) {
  return useQuery<PreviousOrderInfo | null>({
    queryKey: workOrderKeys.previous(id),
    queryFn: async () => {
      const response = await api.get<PreviousOrderInfo | null>(
        `/work-orders/${id}/previous`,
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation<WorkOrder, Error, CreateWorkOrderData>({
    mutationFn: async (data) => {
      const response = await api.post<WorkOrder>('/work-orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
    },
  });
}

export function useUpdateWorkOrder(id: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkOrder, Error, UpdateWorkOrderData>({
    mutationFn: async (data) => {
      const response = await api.patch<WorkOrder>(`/work-orders/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      queryClient.setQueryData(workOrderKeys.detail(id), updated);
    },
  });
}

export function useDeleteWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation<WorkOrder, Error, string>({
    mutationFn: async (workOrderId) => {
      const response = await api.delete<WorkOrder>(`/work-orders/${workOrderId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
    },
  });
}

export function useCompleteWorkOrder(id: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkOrder, Error, CompleteWorkOrderData>({
    mutationFn: async (data) => {
      const response = await api.post<WorkOrder>(`/work-orders/${id}/complete`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      queryClient.setQueryData(workOrderKeys.detail(id), updated);
    },
  });
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} Std ${m} min` : `${h} Std`;
}

export function formatPlannedDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatPlannedTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  // Backend gibt DateTime zurück — nur Uhrzeit extrahieren
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
