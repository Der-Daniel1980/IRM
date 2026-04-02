'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Route,
  ArrowLeft,
  Download,
  Clock,
  MapPin,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useRouteSheet,
  useUpdateRouteSheet,
  ROUTE_SHEET_STATUS_LABELS,
  ROUTE_SHEET_STATUS_COLORS,
  formatMinutes,
  type RouteSheetStatus,
} from '@/hooks/use-route-sheets';
import { useStaffList } from '@/hooks/use-staff';
import { useEquipmentList } from '@/hooks/use-equipment';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const STATUS_TRANSITIONS: Record<RouteSheetStatus, RouteSheetStatus[]> = {
  DRAFT: ['ISSUED'],
  ISSUED: ['IN_PROGRESS', 'DRAFT'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function RouteSheetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: sheet, isLoading, isError } = useRouteSheet(id);
  const updateRouteSheet = useUpdateRouteSheet(id);

  const { data: staffData } = useStaffList({ isActive: true, limit: 200 });
  const { data: vehicleData } = useEquipmentList({ category: 'VEHICLE', limit: 100 });

  // Lokale Reihenfolge-Bearbeitung
  const [editOrder, setEditOrder] = useState<string[] | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Laden...
      </div>
    );
  }

  if (isError || !sheet) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-destructive">Laufzettel nicht gefunden.</p>
        <Button variant="outline" onClick={() => router.push('/route-sheets')}>
          Zurück zur Liste
        </Button>
      </div>
    );
  }

  const staff = staffData?.data.find((s) => s.id === sheet.staffId);
  const staffName = staff ? `${staff.firstName} ${staff.lastName}` : '—';

  const vehicle = sheet.vehicleId
    ? vehicleData?.data.find((v) => v.id === sheet.vehicleId)
    : null;
  const vehicleName = vehicle
    ? `${vehicle.name}${vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ''}`
    : '—';

  const orderedItems = [...sheet.items].sort((a, b) => a.position - b.position);
  const currentOrder = editOrder ?? orderedItems.map((i) => i.workOrderId);

  const totalTravel = orderedItems.reduce((s, i) => s + (i.travelTimeMin ?? 0), 0);
  const allowedTransitions = STATUS_TRANSITIONS[sheet.status] ?? [];

  // Reihenfolge verschieben
  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...currentOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setEditOrder(next);
  }

  function moveDown(idx: number) {
    if (idx === currentOrder.length - 1) return;
    const next = [...currentOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setEditOrder(next);
  }

  async function saveOrder() {
    if (!editOrder) return;
    try {
      await updateRouteSheet.mutateAsync({ workOrderIds: editOrder });
      setEditOrder(null);
    } catch {
      // Fehler wird global behandelt
    }
  }

  async function changeStatus(newStatus: RouteSheetStatus) {
    setStatusLoading(true);
    try {
      await updateRouteSheet.mutateAsync({ status: newStatus });
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/route-sheets')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Zurück
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Route className="h-6 w-6" />
            Laufzettel {sheet.sheetNumber}
          </h1>
          <p className="text-muted-foreground text-sm">{formatDate(sheet.date)}</p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => window.open(`${API_BASE}/route-sheets/${id}/pdf`, '_blank')}
        >
          <Download className="h-4 w-4 mr-1" />
          PDF herunterladen
        </Button>
      </div>

      {/* Kopfdaten */}
      <div className="border rounded-lg p-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Mitarbeiter</span>
            <p className="font-medium">{staffName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Datum</span>
            <p className="font-medium">{formatDate(sheet.date)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Fahrzeug</span>
            <p className="font-medium">{vehicleName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <div className="mt-0.5">
              <Badge className={ROUTE_SHEET_STATUS_COLORS[sheet.status]}>
                {ROUTE_SHEET_STATUS_LABELS[sheet.status]}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="border rounded-lg p-5 bg-muted/20">
        <h2 className="font-semibold text-sm mb-3">Zusammenfassung</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Aufträge</p>
              <p className="font-medium">{orderedItems.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Gesamtdauer</p>
              <p className="font-medium">{formatMinutes(sheet.totalDurationMin)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Strecke</p>
              <p className="font-medium">
                {sheet.totalDistanceKm
                  ? `${Number(sheet.totalDistanceKm).toFixed(1)} km`
                  : '-'}
              </p>
            </div>
          </div>
        </div>
        {totalTravel > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            davon Fahrzeit: {formatMinutes(totalTravel)}
          </p>
        )}
      </div>

      {/* Auftrags-Reihenfolge */}
      <div className="border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Aufträge in Reihenfolge</h2>
          {editOrder && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOrder(null)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={saveOrder} disabled={updateRouteSheet.isPending}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Speichern
              </Button>
            </div>
          )}
        </div>

        {currentOrder.map((workOrderId, idx) => {
          const item = orderedItems.find((i) => i.workOrderId === workOrderId);
          if (!item) return null;
          const wo = item.workOrder;
          const prop = wo.property;

          return (
            <div key={workOrderId}>
              {/* Fahrzeit-Trennlinie */}
              {idx > 0 && item.travelTimeMin && (
                <div className="flex items-center justify-center gap-2 my-2 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full">
                    <ArrowRight className="h-3 w-3" />
                    {formatMinutes(item.travelTimeMin)}
                    {item.distanceKm
                      ? ` · ${Number(item.distanceKm).toFixed(1)} km`
                      : ''}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              {/* Auftrags-Karte */}
              <div className="flex items-start gap-2 border rounded-md p-3 bg-card">
                <Badge variant="outline" className="font-mono text-xs px-1.5 py-0 shrink-0 mt-0.5">
                  {idx + 1}
                </Badge>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="font-medium text-sm">
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {wo.orderNumber}
                    </span>
                    {wo.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {prop.name} — {prop.addressStreet}, {prop.addressZip} {prop.addressCity}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: wo.activityType.color ?? '#6b7280' }}
                    />
                    {wo.activityType.name}
                    {wo.plannedDurationMin && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatMinutes(wo.plannedDurationMin)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reihenfolge-Buttons (nur in bestimmten Status) */}
                {(sheet.status === 'DRAFT' || sheet.status === 'ISSUED') && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === 0}
                      onClick={() => moveUp(idx)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === currentOrder.length - 1}
                      onClick={() => moveDown(idx)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status-Änderung */}
      {allowedTransitions.length > 0 && (
        <div className="border rounded-lg p-5">
          <h2 className="font-semibold text-sm mb-3">Status ändern</h2>
          <div className="flex flex-wrap gap-2">
            {allowedTransitions.map((nextStatus) => (
              <Button
                key={nextStatus}
                variant="outline"
                size="sm"
                disabled={statusLoading}
                onClick={() => changeStatus(nextStatus)}
              >
                {ROUTE_SHEET_STATUS_LABELS[nextStatus]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
