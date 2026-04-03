import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi } from '../lib/api';

export interface WorkOrderSummary {
  id: string;
  orderNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  plannedDate: string | null;
  plannedStartTime: string | null;
  plannedDurationMin: number | null;
  actualStart: string | null;
  actualEnd: string | null;
  actualDurationMin: number | null;
  completionNotes: string | null;
  property: {
    id: string;
    name: string;
    addressStreet: string;
    addressZip: string;
    addressCity: string;
    latitude: number | null;
    longitude: number | null;
  };
  customer: {
    id: string;
    companyName: string;
  };
  activityType: {
    id: string;
    name: string;
    icon: string;
    color: string;
    category: string;
  };
  photos: { id: string }[];
  timeEntries: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMin: number | null;
  }[];
}

interface PaginatedOrders {
  data: WorkOrderSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OrderFilters {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useMyOrders(filters: OrderFilters = {}) {
  return useQuery<PaginatedOrders>({
    queryKey: ['my-orders', filters],
    queryFn: async () => {
      const api = await getApi();
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      const { data } = await api.get(`/mobile/my-orders?${params.toString()}`);
      return data;
    },
  });
}

export function useMyOrder(orderId: string) {
  return useQuery<WorkOrderSummary>({
    queryKey: ['my-order', orderId],
    queryFn: async () => {
      const api = await getApi();
      const { data } = await api.get(`/mobile/my-orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
  });
}

export function useStartWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const api = await getApi();
      const { data } = await api.post(`/mobile/my-orders/${orderId}/start`, {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-order'] });
    },
  });
}

export function useStopWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      completionNotes,
      actualDurationMin,
    }: {
      orderId: string;
      completionNotes?: string;
      actualDurationMin?: number;
    }) => {
      const api = await getApi();
      const { data } = await api.post(`/mobile/my-orders/${orderId}/stop`, {
        completionNotes,
        actualDurationMin,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-order'] });
    },
  });
}

export function useSubmitTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      startedAt,
      endedAt,
      durationMin,
      notes,
    }: {
      orderId: string;
      startedAt: string;
      endedAt?: string;
      durationMin?: number;
      notes?: string;
    }) => {
      const api = await getApi();
      const { data } = await api.post(
        `/mobile/my-orders/${orderId}/time-entry`,
        { startedAt, endedAt, durationMin, notes },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-order'] });
    },
  });
}
