'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface FormulaVariable {
  label: string;
  type: string;
  source?: string;
  default?: number;
}

export interface Formula {
  id: string;
  name: string;
  activityTypeId: string;
  formula: { expression: string };
  variables: Record<string, FormulaVariable>;
  defaultValues: Record<string, number> | null;
  resultUnit: string;
  description: string | null;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activityType: {
    id: string;
    name: string;
    code: string;
    color: string;
  };
}

export interface PaginatedFormulas {
  data: Formula[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FormulasQuery {
  activityTypeId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateFormulaData {
  name: string;
  activityTypeId: string;
  formulaExpression: string;
  variables: Record<string, FormulaVariable>;
  defaultValues?: Record<string, number>;
  description?: string;
  isActive?: boolean;
}

export interface UpdateFormulaData extends Partial<CreateFormulaData> {}

export interface CalculateFormulaRequest {
  formulaId: string;
  propertyId?: string;
  overrides?: Record<string, number>;
}

export interface CalculateFormulaResult {
  result: number;
  unit: string;
  usedValues: Record<string, number>;
  expression: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const formulaKeys = {
  all: ['formulas'] as const,
  lists: () => [...formulaKeys.all, 'list'] as const,
  list: (query: FormulasQuery) => [...formulaKeys.lists(), query] as const,
  details: () => [...formulaKeys.all, 'detail'] as const,
  detail: (id: string) => [...formulaKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useFormulas(query: FormulasQuery = {}) {
  return useQuery<PaginatedFormulas>({
    queryKey: formulaKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.activityTypeId) params.set('activityTypeId', query.activityTypeId);
      if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      const response = await api.get<PaginatedFormulas>(`/formulas?${params.toString()}`);
      return response.data;
    },
  });
}

export function useFormula(id: string) {
  return useQuery<Formula>({
    queryKey: formulaKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<Formula>(`/formulas/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateFormula() {
  const queryClient = useQueryClient();

  return useMutation<Formula, Error, CreateFormulaData>({
    mutationFn: async (data) => {
      const response = await api.post<Formula>('/formulas', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formulaKeys.lists() });
    },
  });
}

export function useUpdateFormula(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Formula, Error, UpdateFormulaData>({
    mutationFn: async (data) => {
      const response = await api.patch<Formula>(`/formulas/${id}`, data);
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: formulaKeys.lists() });
      queryClient.setQueryData(formulaKeys.detail(id), updated);
    },
  });
}

export function useDeleteFormula() {
  const queryClient = useQueryClient();

  return useMutation<Formula, Error, string>({
    mutationFn: async (formulaId) => {
      const response = await api.delete<Formula>(`/formulas/${formulaId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formulaKeys.lists() });
    },
  });
}

export function useCalculateFormula(formulaId: string) {
  return useMutation<CalculateFormulaResult, Error, Omit<CalculateFormulaRequest, 'formulaId'>>({
    mutationFn: async (data) => {
      const response = await api.post<CalculateFormulaResult>(
        `/formulas/${formulaId}/calculate`,
        { formulaId, ...data },
      );
      return response.data;
    },
  });
}
