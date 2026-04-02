'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardStats {
  todayOrdersTotal: number;
  todayByStatus: StatusCount[];
  availableStaffCount: number;
  activeStaffCount: number;
  openOrders: number;
  urgentOrders: number;
  absentToday: number;
  maintenanceDue: number;
}

export interface TodayOrderItem {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  priority: string;
  plannedStartTime: string | null;
  plannedDurationMin: number | null;
  assignedStaff: string[];
  property: {
    id: string;
    propertyNumber: string;
    name: string;
    addressStreet: string;
    addressCity: string;
  };
  activityType: {
    id: string;
    code: string;
    name: string;
    icon: string;
    color: string;
  };
}

export interface StaffStatusItem {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  color: string;
  status: 'AVAILABLE' | 'IN_PROGRESS' | 'ABSENT';
  absenceType?: string;
}

export interface MaintenanceDueItem {
  id: string;
  equipmentNumber: string;
  name: string;
  category: string;
  status: string;
  nextMaintenance: string | null;
  daysUntilDue: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  today: () => [...dashboardKeys.all, 'today'] as const,
  staffStatus: () => [...dashboardKeys.all, 'staff-status'] as const,
  maintenanceDue: () => [...dashboardKeys.all, 'maintenance-due'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Alle Kennzahlen in einem Call. Auto-Refresh alle 60 Sekunden. */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      const response = await api.get<DashboardStats>('/dashboard/stats');
      return response.data;
    },
    refetchInterval: 60_000,
  });
}

/** Heutige Aufträge mit Details. Auto-Refresh alle 60 Sekunden. */
export function useTodayOrders() {
  return useQuery<TodayOrderItem[]>({
    queryKey: dashboardKeys.today(),
    queryFn: async () => {
      const response = await api.get<TodayOrderItem[]>('/dashboard/today');
      return response.data;
    },
    refetchInterval: 60_000,
  });
}

/** Mitarbeiter-Status für heute. Auto-Refresh alle 60 Sekunden. */
export function useStaffStatus() {
  return useQuery<StaffStatusItem[]>({
    queryKey: dashboardKeys.staffStatus(),
    queryFn: async () => {
      const response = await api.get<StaffStatusItem[]>('/dashboard/staff-status');
      return response.data;
    },
    refetchInterval: 60_000,
  });
}

/** Fällige Wartungen innerhalb der nächsten 7 Tage. Auto-Refresh alle 60 Sekunden. */
export function useMaintenanceDue() {
  return useQuery<MaintenanceDueItem[]>({
    queryKey: dashboardKeys.maintenanceDue(),
    queryFn: async () => {
      const response = await api.get<MaintenanceDueItem[]>('/dashboard/maintenance-due');
      return response.data;
    },
    refetchInterval: 60_000,
  });
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Entwurf',
    PLANNED: 'Geplant',
    ASSIGNED: 'Zugeteilt',
    IN_PROGRESS: 'In Bearbeitung',
    COMPLETED: 'Abgeschlossen',
    CANCELLED: 'Storniert',
  };
  return labels[status] ?? status;
}

export function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    LOW: 'Niedrig',
    NORMAL: 'Normal',
    HIGH: 'Hoch',
    URGENT: 'Dringend',
  };
  return labels[priority] ?? priority;
}

export function absenceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    VACATION: 'Urlaub',
    SICK: 'Krank',
    TRAINING: 'Schulung',
    PERSONAL: 'Persönlich',
    COMP_TIME: 'Zeitausgleich',
  };
  return labels[type] ?? type;
}

export function formatMaintenanceDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatStartTime(timeStr: string | null): string {
  if (!timeStr) return '—';
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
