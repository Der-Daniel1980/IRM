'use client';

import { useState } from 'react';
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Check,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useStaffList } from '@/hooks/use-staff';
import { useSchedulingReplan } from '@/hooks/use-scheduling';
import type { ReplanAffectedOrder } from '@/hooks/use-scheduling';
import { useUpdateWorkOrder } from '@/hooks/use-work-orders';

// ─── Zeilen-Aktion: einzelnen Vorschlag übernehmen ───────────────────────────

interface ApplyRowButtonProps {
  order: ReplanAffectedOrder;
  onApplied: (orderId: string) => void;
  alreadyApplied: boolean;
}

function ApplyRowButton({
  order,
  onApplied,
  alreadyApplied,
}: ApplyRowButtonProps) {
  const updateMutation = useUpdateWorkOrder(order.orderId);

  if (!order.suggestion) return null;

  if (alreadyApplied) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-xs">
        <CheckCircle2 className="h-4 w-4" />
        Übernommen
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={updateMutation.isPending}
      onClick={() => {
        if (!order.suggestion) return;
        updateMutation.mutate(
          {
            plannedDate: order.suggestion.date,
            plannedStartTime: order.suggestion.startTime,
            assignedStaff: [order.suggestion.staffId],
          },
          {
            onSuccess: () => onApplied(order.orderId),
          },
        );
      }}
    >
      {updateMutation.isPending ? (
        'Wird gespeichert...'
      ) : (
        <>
          <Check className="h-3 w-3 mr-1" />
          Übernehmen
        </>
      )}
    </Button>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function EinsatzplanungPage() {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [appliedOrderIds, setAppliedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [applyingAll, setApplyingAll] = useState(false);

  const staffQuery = useStaffList({ isActive: true, limit: 100 });
  const replanMutation = useSchedulingReplan();

  const handleReplan = () => {
    if (!selectedStaffId || !fromDate || !toDate) return;
    setAppliedOrderIds(new Set());
    replanMutation.mutate({
      staffId: selectedStaffId,
      fromDate,
      toDate,
    });
  };

  const handleApplied = (orderId: string) => {
    setAppliedOrderIds((prev) => new Set([...prev, orderId]));
  };

  const affectedOrders: ReplanAffectedOrder[] =
    replanMutation.data?.affectedOrders ?? [];

  const ordersWithSuggestion = affectedOrders.filter(
    (o) => o.suggestion !== null,
  );
  const pendingSuggestions = ordersWithSuggestion.filter(
    (o) => !appliedOrderIds.has(o.orderId),
  );

  const selectedStaff = staffQuery.data?.data.find(
    (s) => s.id === selectedStaffId,
  );

  // "Alle übernehmen" — seriell via Promise-Kette
  const handleApplyAll = async () => {
    if (applyingAll || pendingSuggestions.length === 0) return;
    setApplyingAll(true);
    try {
      for (const order of pendingSuggestions) {
        if (!order.suggestion) continue;
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? '/api/v1'}/work-orders/${order.orderId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plannedDate: order.suggestion.date,
              plannedStartTime: order.suggestion.startTime,
              assignedStaff: [order.suggestion.staffId],
            }),
          },
        );
        setAppliedOrderIds((prev) => new Set([...prev, order.orderId]));
      }
    } finally {
      setApplyingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarClock className="h-8 w-8" />
          Einsatzplanung
        </h1>
        <p className="text-muted-foreground">
          Umplanung bei Krankheit oder Ausfall eines Mitarbeiters
        </p>
      </div>

      {/* Filter-Bereich */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Umplanung bei Ausfall</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Mitarbeiter-Auswahl */}
          <div className="space-y-2">
            <Label htmlFor="staff-select">Mitarbeiter</Label>
            <Select
              value={selectedStaffId}
              onValueChange={setSelectedStaffId}
            >
              <SelectTrigger id="staff-select">
                <SelectValue placeholder="Mitarbeiter wählen..." />
              </SelectTrigger>
              <SelectContent>
                {staffQuery.data?.data.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.lastName}, {staff.firstName} ({staff.staffNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Von-Datum */}
          <div className="space-y-2">
            <Label htmlFor="from-date">Von</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          {/* Bis-Datum */}
          <div className="space-y-2">
            <Label htmlFor="to-date">Bis</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {/* Button */}
          <Button
            onClick={handleReplan}
            disabled={
              !selectedStaffId ||
              !fromDate ||
              !toDate ||
              replanMutation.isPending
            }
          >
            {replanMutation.isPending
              ? 'Wird berechnet...'
              : 'Betroffene Aufträge laden'}
          </Button>
        </div>

        {/* Fehler-Anzeige */}
        {replanMutation.isError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <XCircle className="h-4 w-4" />
            Fehler: {replanMutation.error.message}
          </div>
        )}
      </div>

      {/* Ergebnis-Bereich */}
      {replanMutation.isSuccess && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">
              Betroffene Aufträge
              {selectedStaff && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({selectedStaff.lastName}, {selectedStaff.firstName})
                </span>
              )}
            </h2>
            <Badge variant={affectedOrders.length > 0 ? 'warning' : 'success'}>
              {affectedOrders.length === 0
                ? 'Keine betroffenen Aufträge'
                : `${affectedOrders.length} Auftrag${affectedOrders.length !== 1 ? 'e' : ''} betroffen`}
            </Badge>
          </div>

          {affectedOrders.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auftragsnr.</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Aktueller Termin</TableHead>
                  <TableHead>Vorgeschlagener Termin</TableHead>
                  <TableHead>Mitarbeiter-Vorschlag</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affectedOrders.map((order) => (
                  <TableRow
                    key={order.orderId}
                    className={
                      appliedOrderIds.has(order.orderId)
                        ? 'bg-green-50/50'
                        : undefined
                    }
                  >
                    <TableCell className="font-mono text-sm">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>{order.title}</TableCell>
                    <TableCell>
                      {order.plannedDate
                        ? new Date(order.plannedDate).toLocaleDateString(
                            'de-DE',
                          )
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {order.suggestion ? (
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">
                            {new Date(order.suggestion.date).toLocaleDateString(
                              'de-DE',
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.suggestion.startTime} –{' '}
                            {order.suggestion.endTime}
                          </div>
                          {order.suggestion.distanceKm !== null && (
                            <div className="text-xs text-muted-foreground">
                              {order.suggestion.distanceKm} km
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">
                          Kein Vorschlag
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.suggestion ? (
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">
                            {order.suggestion.staffName}
                          </div>
                          <div className="text-xs text-muted-foreground italic">
                            {order.suggestion.reason}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600 text-xs">
                          <AlertTriangle className="h-4 w-4" />
                          Manuell nötig
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.suggestion ? (
                        <Badge variant="default">
                          {order.suggestion.score}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <ApplyRowButton
                        order={order}
                        onApplied={handleApplied}
                        alreadyApplied={appliedOrderIds.has(order.orderId)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Alle übernehmen */}
          {ordersWithSuggestion.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">
                {appliedOrderIds.size} von {ordersWithSuggestion.length}{' '}
                Vorschlägen übernommen
              </span>
              <Button
                onClick={handleApplyAll}
                disabled={
                  applyingAll || pendingSuggestions.length === 0
                }
                variant={
                  pendingSuggestions.length === 0 ? 'outline' : 'default'
                }
              >
                {applyingAll ? (
                  'Wird gespeichert...'
                ) : pendingSuggestions.length === 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Alle übernommen
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Alle übernehmen ({pendingSuggestions.length})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
