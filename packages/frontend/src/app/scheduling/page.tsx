'use client';

import { useState } from 'react';
import { CalendarClock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
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

export default function EinsatzplanungPage() {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const staffQuery = useStaffList({ isActive: true, limit: 100 });
  const replanMutation = useSchedulingReplan();

  const handleReplan = () => {
    if (!selectedStaffId || !fromDate || !toDate) return;
    replanMutation.mutate({
      staffId: selectedStaffId,
      fromDate,
      toDate,
    });
  };

  const affectedOrders: ReplanAffectedOrder[] =
    replanMutation.data?.affectedOrders ?? [];

  const selectedStaff = staffQuery.data?.data.find(
    (s) => s.id === selectedStaffId,
  );

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
              : 'Betroffene Aufträge anzeigen'}
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
          <div className="flex items-center justify-between">
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
                  <TableHead>Geplantes Datum</TableHead>
                  <TableHead>Alternative</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affectedOrders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell className="font-mono text-sm">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>{order.title}</TableCell>
                    <TableCell>
                      {order.plannedDate
                        ? new Date(order.plannedDate).toLocaleDateString('de-DE')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {order.suggestion ? (
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            {order.suggestion.staffName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(order.suggestion.date).toLocaleDateString(
                              'de-DE',
                            )}{' '}
                            {order.suggestion.startTime} -{' '}
                            {order.suggestion.endTime}
                          </div>
                          {order.suggestion.distanceKm !== null && (
                            <div className="text-xs text-muted-foreground">
                              Entfernung: {order.suggestion.distanceKm} km
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground italic">
                            {order.suggestion.reason}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">
                          Kein Ersatz gefunden
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.suggestion ? (
                        <Badge variant="default">
                          {order.suggestion.score}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {order.suggestion ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">Vorschlag</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">Manuell</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {affectedOrders.length > 0 &&
            affectedOrders.some((o) => o.suggestion !== null) && (
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" disabled>
                  Alle umplanen (in Planung)
                </Button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
