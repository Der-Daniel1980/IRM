'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useWorkOrders,
  useDeleteWorkOrder,
  formatDuration,
  formatPlannedDate,
  formatPlannedTime,
  WorkOrderStatus,
  WorkOrderPriority,
} from '@/hooks/use-work-orders';

// ─── Status-Badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: 'Entwurf',
  PLANNED: 'Geplant',
  ASSIGNED: 'Zugewiesen',
  IN_PROGRESS: 'In Arbeit',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
};

const STATUS_CLASSES: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PLANNED: 'bg-blue-100 text-blue-700',
  ASSIGNED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Prioritäts-Badge ─────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  LOW: 'Niedrig',
  NORMAL: 'Normal',
  HIGH: 'Hoch',
  URGENT: 'Dringend',
};

const PRIORITY_CLASSES: Record<WorkOrderPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_CLASSES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

// ─── Mitarbeiter-Farbpunkte ───────────────────────────────────────────────────

type StaffDetail = { id: string; firstName: string; lastName: string; color: string };

function StaffDots({ staff }: { staff: StaffDetail[] }) {
  if (staff.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {staff.slice(0, 3).map((s) => (
        <span
          key={s.id}
          className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium text-white"
          style={{ backgroundColor: s.color }}
          title={`${s.firstName} ${s.lastName}`}
        >
          {s.firstName[0]}{s.lastName[0]}
        </span>
      ))}
      {staff.length > 3 && (
        <span className="text-xs text-muted-foreground">+{staff.length - 3}</span>
      )}
    </span>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const query = {
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    search: searchTerm || undefined,
    page,
    limit: 20,
  };

  const { data, isLoading, isError } = useWorkOrders(query);
  const deleteMutation = useDeleteWorkOrder();

  function handleDelete(id: string, orderNumber: string) {
    if (confirm(`Auftrag ${orderNumber} wirklich löschen?`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Aufträge</h1>
            <p className="text-muted-foreground">
              {data ? `${data.total} ${data.total === 1 ? 'Auftrag' : 'Aufträge'} gesamt` : 'Lade...'}
            </p>
          </div>
        </div>
        <Link href="/orders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Auftrag
          </Button>
        </Link>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Status-Filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v as WorkOrderStatus | 'ALL'); setPage(1); }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            <SelectItem value="DRAFT">Entwurf</SelectItem>
            <SelectItem value="PLANNED">Geplant</SelectItem>
            <SelectItem value="ASSIGNED">Zugewiesen</SelectItem>
            <SelectItem value="IN_PROGRESS">In Arbeit</SelectItem>
            <SelectItem value="COMPLETED">Abgeschlossen</SelectItem>
            <SelectItem value="CANCELLED">Storniert</SelectItem>
          </SelectContent>
        </Select>

        {/* Prioritäts-Filter */}
        <Select
          value={priorityFilter}
          onValueChange={(v) => { setPriorityFilter(v as WorkOrderPriority | 'ALL'); setPage(1); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Prioritäten</SelectItem>
            <SelectItem value="LOW">Niedrig</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="HIGH">Hoch</SelectItem>
            <SelectItem value="URGENT">Dringend</SelectItem>
          </SelectContent>
        </Select>

        {/* Datumsbereich */}
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          className="w-36"
          placeholder="Von"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          className="w-36"
          placeholder="Bis"
        />

        {/* Freitextsuche */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Suchen nach Titel oder Nr..."
            className="pl-8"
          />
        </div>

        {/* Filter zurücksetzen */}
        {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || fromDate || toDate || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
              setFromDate('');
              setToDate('');
              setSearchTerm('');
              setPage(1);
            }}
          >
            Zurücksetzen
          </Button>
        )}
      </div>

      {/* Tabelle */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Auftrags-Nr.</TableHead>
              <TableHead>Immobilie</TableHead>
              <TableHead>Tätigkeit</TableHead>
              <TableHead>Datum / Uhrzeit</TableHead>
              <TableHead className="w-24">Dauer</TableHead>
              <TableHead className="w-28">Mitarbeiter</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Priorität</TableHead>
              <TableHead className="w-28 text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  Lade Aufträge...
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-destructive">
                  Fehler beim Laden der Aufträge.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  Keine Aufträge gefunden.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs font-medium">
                  {order.orderNumber}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{order.property.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.property.addressCity}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{order.activityType.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.activityType.category}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatPlannedDate(order.plannedDate)}</div>
                  {order.plannedStartTime && (
                    <div className="text-xs text-muted-foreground">
                      {formatPlannedTime(order.plannedStartTime)} Uhr
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDuration(order.plannedDurationMin)}
                </TableCell>
                <TableCell>
                  <StaffDots staff={order.assignedStaffDetails ?? []} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={order.priority} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">
                        Details
                      </Button>
                    </Link>
                    {order.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(order.id, order.orderNumber)}
                        disabled={deleteMutation.isPending}
                      >
                        Löschen
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {data.page} von {data.totalPages} ({data.total} Einträge)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
