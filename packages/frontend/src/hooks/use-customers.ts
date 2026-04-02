'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  customerNumber: string;
  companyName: string;
  isCompany: boolean;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  addressCountry: string;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  notes: string | null;
  isInternal: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomersQuery {
  search?: string;
  isInternal?: boolean;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateCustomerData {
  companyName: string;
  isCompany: boolean;
  addressStreet?: string;
  addressZip?: string;
  addressCity?: string;
  addressCountry?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
  isInternal?: boolean;
}

export interface UpdateCustomerData extends Partial<CreateCustomerData> {
  isActive?: boolean;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (query: CustomersQuery) => [...customerKeys.lists(), query] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useCustomers(query: CustomersQuery = {}) {
  return useQuery<PaginatedCustomers>({
    queryKey: customerKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.isInternal !== undefined)
        params.set('isInternal', String(query.isInternal));
      if (query.isActive !== undefined)
        params.set('isActive', String(query.isActive));
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await api.get<PaginatedCustomers>(
        `/customers?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<Customer>(`/customers/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, CreateCustomerData>({
    mutationFn: async (data) => {
      const response = await api.post<Customer>('/customers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, UpdateCustomerData>({
    mutationFn: async (data) => {
      const response = await api.patch<Customer>(`/customers/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.setQueryData(customerKeys.detail(id), updated);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, string>({
    mutationFn: async (customerId) => {
      const response = await api.delete<Customer>(`/customers/${customerId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
