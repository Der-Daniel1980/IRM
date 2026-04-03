export type WorkOrderStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TimeEntrySource = 'MOBILE' | 'WEB' | 'MANUAL';

export interface WorkOrderSummary {
  id: string;
  orderNumber: string;
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
  completionNotes: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
