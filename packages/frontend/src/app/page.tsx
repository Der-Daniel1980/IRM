'use client';

import {
  FileText,
  UserCog,
  CalendarOff,
  Truck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Circle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  useDashboardStats,
  useTodayOrders,
  useStaffStatus,
  useMaintenanceDue,
  statusLabel,
  priorityLabel,
  absenceTypeLabel,
  formatMaintenanceDate,
  formatStartTime,
  type StatusCount,
} from '@/hooks/use-dashboard';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className ?? ''}`}
    />
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: number | undefined;
  isLoading: boolean;
  icon: React.ReactNode;
  description?: string;
  accent?: 'default' | 'destructive' | 'warning' | 'success';
  badge?: { label: string; variant: 'destructive' | 'warning' | 'success' | 'secondary' };
  breakdown?: StatusCount[];
}

function StatCard({
  title,
  value,
  isLoading,
  icon,
  description,
  accent = 'default',
  badge,
  breakdown,
}: StatCardProps) {
  const accentColors: Record<string, string> = {
    default: 'text-primary',
    destructive: 'text-destructive',
    warning: 'text-amber-600',
    success: 'text-green-600',
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span className={accentColors[accent]}>{icon}</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold ${accentColors[accent]}`}>
            {value ?? 0}
          </span>
          {badge && (
            <Badge variant={badge.variant} className="mb-1">
              {badge.label}
            </Badge>
          )}
        </div>
      )}

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Mini-Breakdown für heutige Aufträge */}
      {breakdown && breakdown.length > 0 && !isLoading && (
        <div className="flex flex-wrap gap-1 pt-1">
          {breakdown.map((item) => (
            <span
              key={item.status}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
            >
              <StatusDot status={item.status} />
              {statusLabel(item.status)}: {item.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StatusDot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-400',
    PLANNED: 'bg-blue-500',
    ASSIGNED: 'bg-indigo-500',
    IN_PROGRESS: 'bg-amber-500',
    COMPLETED: 'bg-green-500',
    CANCELLED: 'bg-red-400',
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? 'bg-gray-300'}`}
    />
  );
}

// ─── StaffStatusBadge ─────────────────────────────────────────────────────────

function StaffStatusBadge({ status }: { status: 'AVAILABLE' | 'IN_PROGRESS' | 'ABSENT' }) {
  if (status === 'AVAILABLE') {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Verfügbar
      </Badge>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <Badge variant="warning">
        <Clock className="mr-1 h-3 w-3" />
        Im Einsatz
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <CalendarOff className="mr-1 h-3 w-3" />
      Abwesend
    </Badge>
  );
}

// ─── Prioritäts-Badge ─────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'URGENT') {
    return <Badge variant="destructive">{priorityLabel(priority)}</Badge>;
  }
  if (priority === 'HIGH') {
    return <Badge variant="warning">{priorityLabel(priority)}</Badge>;
  }
  return (
    <Badge variant="secondary">{priorityLabel(priority)}</Badge>
  );
}

// ─── Auftrags-Status-Badge ────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'default'> = {
    COMPLETED: 'success',
    IN_PROGRESS: 'warning',
    CANCELLED: 'destructive',
    ASSIGNED: 'default',
    PLANNED: 'secondary',
    DRAFT: 'secondary',
  };
  return (
    <Badge variant={variantMap[status] ?? 'secondary'}>
      <StatusDot status={status} />
      <span className="ml-1">{statusLabel(status)}</span>
    </Badge>
  );
}

// ─── Dashboard-Seite ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, dataUpdatedAt: statsUpdated } = useDashboardStats();
  const { data: todayOrders, isLoading: ordersLoading } = useTodayOrders();
  const { data: staffStatus, isLoading: staffLoading } = useStaffStatus();
  const { data: maintenanceDue, isLoading: maintenanceLoading } = useMaintenanceDue();

  const lastUpdated = statsUpdated
    ? new Date(statsUpdated).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Willkommen im IRM — Immobilien &amp; Ressourcenmanagement
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <RefreshCw className="h-3 w-3" />
            <span>Aktualisiert: {lastUpdated}</span>
          </div>
        )}
      </div>

      {/* StatCards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Heutige Aufträge"
          value={stats?.todayOrdersTotal}
          isLoading={statsLoading}
          icon={<FileText className="h-5 w-5" />}
          description="Alle für heute geplanten Aufträge"
          breakdown={stats?.todayByStatus}
        />
        <StatCard
          title="Verfügbare Mitarbeiter"
          value={stats?.availableStaffCount}
          isLoading={statsLoading}
          icon={<UserCog className="h-5 w-5" />}
          accent="success"
          description="Aktiv, keine Abwesenheit heute"
        />
        <StatCard
          title="Offene Aufträge"
          value={stats?.openOrders}
          isLoading={statsLoading}
          icon={<Circle className="h-5 w-5" />}
          accent={stats?.urgentOrders && stats.urgentOrders > 0 ? 'warning' : 'default'}
          description="Entwurf oder Geplant"
          badge={
            stats?.urgentOrders && stats.urgentOrders > 0
              ? { label: `${stats.urgentOrders} dringend`, variant: 'destructive' }
              : undefined
          }
        />
        <StatCard
          title="Abwesende Mitarbeiter"
          value={stats?.absentToday}
          isLoading={statsLoading}
          icon={<CalendarOff className="h-5 w-5" />}
          accent={stats?.absentToday && stats.absentToday > 0 ? 'warning' : 'default'}
          description="Genehmigte Abwesenheiten heute"
        />
      </div>

      {/* Heutige Aufträge — Tabelle */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Heutige Aufträge</h2>
          <p className="text-sm text-muted-foreground">
            Alle für heute geplanten Einsätze
          </p>
        </div>

        {ordersLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !todayOrders || todayOrders.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">Keine Aufträge für heute geplant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Zeit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Auftrag</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Immobilie</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tätigkeit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mitarbeiter</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priorität</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {formatStartTime(order.plannedStartTime)}
                      {order.plannedDurationMin != null && (
                        <span className="ml-1 text-muted-foreground">
                          ({order.plannedDurationMin} min)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.title}</div>
                      <div className="text-xs text-muted-foreground">{order.orderNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.property.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.property.addressStreet}, {order.property.addressCity}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        {order.activityType.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.assignedStaff.length > 0 ? (
                        <span className="text-xs">
                          {order.assignedStaff.length} Mitarbeiter
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nicht zugeteilt</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={order.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Untere Sektionen: Mitarbeiter-Status + Wartungs-Warnungen */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Mitarbeiter-Status */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Mitarbeiter-Status heute</h2>
            <p className="text-sm text-muted-foreground">
              Verfügbarkeit aller aktiven Mitarbeiter
            </p>
          </div>

          {staffLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !staffStatus || staffStatus.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">Keine aktiven Mitarbeiter gefunden.</p>
            </div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {staffStatus.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Farbpunkt des Mitarbeiters */}
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: member.color }}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.staffNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.absenceType && (
                      <span className="text-xs text-muted-foreground">
                        {absenceTypeLabel(member.absenceType)}
                      </span>
                    )}
                    <StaffStatusBadge status={member.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Wartungs-Warnungen */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Wartungs-Warnungen</h2>
              <p className="text-sm text-muted-foreground">
                Geräte mit Wartungstermin in den nächsten 7 Tagen
              </p>
            </div>
            {stats?.maintenanceDue != null && stats.maintenanceDue > 0 && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats.maintenanceDue}
              </Badge>
            )}
          </div>

          {maintenanceLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !maintenanceDue || maintenanceDue.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm">Alle Geräte sind auf dem aktuellen Wartungsstand.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {maintenanceDue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Truck
                      className={`h-4 w-4 flex-shrink-0 ${
                        item.daysUntilDue <= 0
                          ? 'text-destructive'
                          : item.daysUntilDue <= 3
                          ? 'text-amber-600'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.equipmentNumber} &bull; {item.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        item.daysUntilDue <= 0
                          ? 'text-destructive'
                          : item.daysUntilDue <= 3
                          ? 'text-amber-600'
                          : 'text-foreground'
                      }`}
                    >
                      {item.daysUntilDue <= 0
                        ? 'Überfällig'
                        : item.daysUntilDue === 1
                        ? 'Morgen'
                        : `In ${item.daysUntilDue} Tagen`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMaintenanceDate(item.nextMaintenance)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
