'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Route,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  ArrowLeft,
  Clock,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useStaffList } from '@/hooks/use-staff';
import { useEquipmentList } from '@/hooks/use-equipment';
import { useWorkOrders, type WorkOrder } from '@/hooks/use-work-orders';
import { useCreateRouteSheet } from '@/hooks/use-route-sheets';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatDurationMin(min: number | null | undefined): string {
  if (min == null) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}

// ─── Ausgewählter Auftrag ─────────────────────────────────────────────────────

interface SelectedOrder {
  id: string;
  orderNumber: string;
  title: string;
  propertyName: string;
  propertyAddress: string;
  durationMin: number | null;
}

function workOrderToSelected(wo: WorkOrder): SelectedOrder {
  return {
    id: wo.id,
    orderNumber: wo.orderNumber,
    title: wo.title,
    propertyName: wo.property.name,
    propertyAddress: `${wo.property.addressStreet}, ${wo.property.addressZip} ${wo.property.addressCity}`,
    durationMin: wo.plannedDurationMin ?? null,
  };
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function NewRouteSheetPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [staffId, setStaffId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(today);
  const [selectedOrders, setSelectedOrders] = useState<SelectedOrder[]>([]);
  const [addOrderId, setAddOrderId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: staffData } = useStaffList({ isActive: true, limit: 100 });
  const { data: vehicleData } = useEquipmentList({ category: 'VEHICLE', status: 'AVAILABLE', limit: 100 });

  // Auftraege fuer diesen Mitarbeiter und Datum laden
  const { data: workOrdersData } = useWorkOrders({
    assignedStaffId: staffId || undefined,
    from: date || undefined,
    to: date || undefined,
    limit: 100,
  });

  const createRouteSheet = useCreateRouteSheet();

  // Alle verfuegbaren Auftraege (noch nicht im Laufzettel)
  const availableOrders = (workOrdersData?.data ?? []).filter(
    (wo) => !selectedOrders.some((s) => s.id === wo.id),
  );

  function addOrder(workOrderId: string) {
    const wo = (workOrdersData?.data ?? []).find((w) => w.id === workOrderId);
    if (!wo) return;
    setSelectedOrders((prev) => [...prev, workOrderToSelected(wo)]);
    setAddOrderId('');
  }

  function removeOrder(id: string) {
    setSelectedOrders((prev) => prev.filter((o) => o.id !== id));
  }

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setSelectedOrders((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setSelectedOrders((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const totalDuration = selectedOrders.reduce((s, o) => s + (o.durationMin ?? 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!staffId) {
      setSubmitError('Bitte einen Mitarbeiter auswählen.');
      return;
    }
    if (!date) {
      setSubmitError('Bitte ein Datum auswählen.');
      return;
    }
    if (selectedOrders.length === 0) {
      setSubmitError('Bitte mindestens einen Auftrag hinzufügen.');
      return;
    }

    try {
      const sheet = await createRouteSheet.mutateAsync({
        staffId,
        vehicleId: vehicleId || undefined,
        date,
        workOrderIds: selectedOrders.map((o) => o.id),
      });
      router.push(`/route-sheets/${sheet.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Laufzettel konnte nicht erstellt werden.';
      setSubmitError(msg);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Zurück
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Route className="h-6 w-6" />
            Neuer Laufzettel
          </h1>
          <p className="text-muted-foreground text-sm">
            Mitarbeiter, Datum und Aufträge auswählen
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Grunddaten */}
        <div className="border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-base">Grunddaten</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mitarbeiter */}
            <div className="space-y-1">
              <Label>Mitarbeiter *</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Mitarbeiter wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {staffData?.data.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Datum */}
            <div className="space-y-1">
              <Label>Datum *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Fahrzeug */}
            <div className="space-y-1 sm:col-span-2">
              <Label>Fahrzeug (optional)</Label>
              <Select
                value={vehicleId}
                onValueChange={(v) => setVehicleId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kein Fahrzeug" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Fahrzeug</SelectItem>
                  {vehicleData?.data.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.licensePlate ? ` (${v.licensePlate})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Aufträge hinzufügen */}
        <div className="border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Aufträge</h2>
            {selectedOrders.length > 0 && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Arbeitsdauer: {formatDurationMin(totalDuration)}
              </span>
            )}
          </div>

          {/* Auftrag hinzufügen */}
          {staffId && date && (
            <div className="flex gap-2">
              <Select
                value={addOrderId}
                onValueChange={setAddOrderId}
                disabled={availableOrders.length === 0}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue
                    placeholder={
                      availableOrders.length === 0
                        ? 'Keine weiteren Aufträge verfügbar'
                        : 'Auftrag auswählen...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      <span className="font-mono text-xs mr-2">{wo.orderNumber}</span>
                      {wo.title} — {wo.property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                disabled={!addOrderId}
                onClick={() => addOrder(addOrderId)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Hinzufügen
              </Button>
            </div>
          )}

          {!staffId && (
            <p className="text-sm text-muted-foreground">
              Bitte zuerst einen Mitarbeiter und ein Datum auswählen.
            </p>
          )}

          {/* Ausgewählte Aufträge (geordnet) */}
          {selectedOrders.length > 0 && (
            <div className="space-y-2">
              {selectedOrders.map((order, idx) => (
                <div
                  key={order.id}
                  className="flex items-start gap-2 border rounded-md p-3 bg-muted/30"
                >
                  {/* Position */}
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono">
                      {idx + 1}
                    </Badge>
                  </div>

                  {/* Auftrag-Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      <span className="font-mono text-xs text-muted-foreground mr-1">
                        {order.orderNumber}
                      </span>
                      {order.title}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {order.propertyName} — {order.propertyAddress}
                    </div>
                    {order.durationMin && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDurationMin(order.durationMin)}
                      </div>
                    )}
                  </div>

                  {/* Steuerung */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={idx === 0}
                      onClick={() => moveUp(idx)}
                      title="Nach oben"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={idx === selectedOrders.length - 1}
                      onClick={() => moveDown(idx)}
                      title="Nach unten"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeOrder(order.id)}
                      title="Entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedOrders.length === 0 && staffId && (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
              Noch keine Aufträge ausgewählt
            </p>
          )}
        </div>

        {/* Fehler */}
        {submitError && (
          <div className="text-destructive text-sm border border-destructive/30 bg-destructive/5 rounded-md px-4 py-3">
            {submitError}
          </div>
        )}

        {/* Absenden */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={createRouteSheet.isPending || selectedOrders.length === 0 || !staffId}
          >
            {createRouteSheet.isPending ? 'Wird erstellt...' : 'Laufzettel erstellen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
