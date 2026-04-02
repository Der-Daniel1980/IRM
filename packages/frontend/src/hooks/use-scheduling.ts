'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface ScheduleSuggestion {
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  distanceKm: number | null;
  score: number;
  isRecommended: boolean;
  reason: string;
}

export interface SuggestScheduleResponse {
  suggestions: ScheduleSuggestion[];
}

export interface SuggestScheduleInput {
  workOrderId?: string;
  activityTypeId: string;
  propertyId: string;
  durationMin: number;
  preferredDate?: string;
  maxSuggestions?: number;
}

export interface ReplanInput {
  staffId: string;
  fromDate: string;
  toDate: string;
}

export interface ReplanAffectedOrder {
  orderId: string;
  orderNumber: string;
  title: string;
  plannedDate: string | null;
  suggestion: ScheduleSuggestion | null;
}

export interface ReplanResponse {
  affectedOrders: ReplanAffectedOrder[];
}

export interface DayAvailability {
  date: string;
  isAvailable: boolean;
  reason: string | null;
  ordersCount: number;
}

export interface AvailabilityResponse {
  staffId: string;
  days: DayAvailability[];
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const schedulingKeys = {
  all: ['scheduling'] as const,
  availability: (staffId: string, from: string, to: string) =>
    [...schedulingKeys.all, 'availability', staffId, from, to] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSchedulingSuggest() {
  return useMutation<SuggestScheduleResponse, Error, SuggestScheduleInput>({
    mutationFn: async (data) => {
      const response = await api.post<SuggestScheduleResponse>(
        '/scheduling/suggest',
        data,
      );
      return response.data;
    },
  });
}

export function useSchedulingReplan() {
  return useMutation<ReplanResponse, Error, ReplanInput>({
    mutationFn: async (data) => {
      const response = await api.post<ReplanResponse>(
        '/scheduling/replan',
        data,
      );
      return response.data;
    },
  });
}

export function useStaffAvailability(
  staffId: string,
  from: string,
  to: string,
) {
  return useQuery<AvailabilityResponse>({
    queryKey: schedulingKeys.availability(staffId, from, to),
    queryFn: async () => {
      const params = new URLSearchParams({ staffId, from, to });
      const response = await api.get<AvailabilityResponse>(
        `/scheduling/availability?${params.toString()}`,
      );
      return response.data;
    },
    enabled: Boolean(staffId) && Boolean(from) && Boolean(to),
  });
}
