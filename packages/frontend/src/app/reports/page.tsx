'use client';

import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, UserCog, Truck, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkOrders } from '@/hooks/use-work-orders';
import { useStaffList } from '@/hooks/use-staff';
import { useEquipmentList } from '@/hooks/use-equipment';

// ─── Typen ────────────────────────────────────────────────────────────────────

type Zeitraum = 'monat' | 'quartal' | 'jahr' | 'benutzerdefiniert';

interface DateRange {
  from: string;
  to: string;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function getDateRange(zeitraum: Zeitraum, custom: DateRange): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  if (zeitraum === 'monat') {
    const from = new Date(y, m, 1).toISOString().slice(0, 10);
    const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    return { from, to };
  }
  if (zeitraum === 'quartal') {
    const q = Math.floor(m / 3);
    const from = new Date(y, q * 3, 1).toISOString().slice(0, 10);
    const to = new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10);
    return { from, to };
  }
  if (zeitraum === 'jahr') {
    return {
      from: `${y}-01-01`,
      to: `${y}-12-31`,
    };
  }
  return custom;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Wartungs-Ampel: grün / gelb / rot
function maintenanceColor(
  nextMaintenance: string | null,
): 'success' | 'warning' | 'destructive' {
  if (!nextMaintenance) return 'success';
  const days =
    (new Date(nextMaintenance).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return 'destructive';
  if (days <= 14) return 'warning';
  return 'success';
}

const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Verfügbar',
  IN_USE: 'Im Einsatz',
  MAINTENANCE: 'Wartung',
  BROKEN: 'Defekt',
};

const EQUIPMENT_STATUS_VARIANTS: Record<
  string,
  'success' | 'warning' | 'destructive' | 'default'
> = {
  AVAILABLE: 'success',
  IN_USE: 'default',
  MAINTENANCE: 'warning',
  BROKEN: 'destructive',
};

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function BerichtePage() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('monat');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const dateRange = useMemo(
    () => getDateRange(zeitraum, { from: customFrom, to: customTo }),
    [zeitraum, customFrom, customTo],
  );

  // ─── Daten laden ─────────────────────────────────────────────────────────

  // Alle Aufträge im Zeitraum (ohne Status-Filter — für Gesamtstatistik)
  const allOrdersQuery = useWorkOrders({
    from: dateRange.from,
    to: dateRange.to || undefined,
    limit: 500,
  });

  const staffQuery = useStaffList({ isActive: true, limit: 100 });
  const equipmentQuery = useEquipmentList({ limit: 200 });

  // ─── Auftragsstatistik aggregieren ───────────────────────────────────────

  const stats = useMemo(() => {
    const orders = allOrdersQuery.data?.data ?? [];
    const total = orders.length;
    const completed = orders.filter((o) => o.status === 'COMPLETED').length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // Aufträge nach Tätigkeit gruppieren
    const byActivity = new Map<
      string,
      { name: string; count: number; totalMin: number }
    >();

    for (const o of orders) {
      const key = o.activityType.id;
      const existing = byActivity.get(key);
      const dur = o.actualDurationMin ?? o.plannedDurationMin ?? 0;
      if (existing) {
        existing.count += 1;
        existing.totalMin += dur;
      } else {
        byActivity.set(key, {
          name: o.activityType.name,
          count: 1,
          totalMin: dur,
        });
      }
    }

    const activityRows = Array.from(byActivity.values()).sort(
      (a, b) => b.count - a.count,
    );

    const maxCount =
      activityRows.length > 0
        ? Math.max(...activityRows.map((r) => r.count))
        : 1;

    return { total, completed, cancelled, completionRate, activityRows, maxCount };
  }, [allOrdersQuery.data]);

  // ─── Mitarbeiter-Auslastung ───────────────────────────────────────────────

  const staffStats = useMemo(() => {
    const orders = allOrdersQuery.data?.data ?? [];
    const staffList = staffQuery.data?.data ?? [];

    // Wochenstunden des Zeitraums berechnen (Arbeitstage * 8h)
    let periodDays = 0;
    if (dateRange.from && dateRange.to) {
      const diffMs =
        new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime();
      periodDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    } else {
      periodDays = 30;
    }
    // Näherung: ~71,4% der Tage sind Werktage (5/7)
    const workDays = Math.round(periodDays * (5 / 7));

    return staffList.map((staff) => {
      const staffOrders = orders.filter((o) =>
        o.assignedStaff.includes(staff.id),
      );
      const totalMin = staffOrders.reduce(
        (sum, o) => sum + (o.actualDurationMin ?? o.plannedDurationMin ?? 0),
        0,
      );
      const totalHours = Math.round(totalMin / 60);
      const weeklyH = parseFloat(staff.weeklyHours ?? '40');
      // Soll-Stunden = weeklyH * (workDays / 5)
      const sollH = Math.round(weeklyH * (workDays / 5));
      const auslastung =
        sollH > 0 ? Math.min(200, Math.round((totalHours / sollH) * 100)) : 0;

      return {
        id: staff.id,
        name: `${staff.lastName}, ${staff.firstName}`,
        staffNumber: staff.staffNumber,
        orderCount: staffOrders.length,
        totalHours,
        sollHours: sollH,
        auslastung,
      };
    });
  }, [allOrdersQuery.data, staffQuery.data, dateRange]);

  // ─── Geräte-Übersicht ────────────────────────────────────────────────────

  const equipmentRows = useMemo(() => {
    const orders = allOrdersQuery.data?.data ?? [];
    const equipmentList = equipmentQuery.data?.data ?? [];

    return equipmentList.map((eq) => {
      // Einsätze im Zeitraum zählen (Aufträge, in denen das Gerät auftaucht)
      const einsaetze = orders.filter((o) =>
        o.equipment.some((e) => e.equipmentId === eq.id),
      ).length;

      return {
        id: eq.id,
        equipmentNumber: eq.equipmentNumber,
        name: eq.name,
        category: eq.category,
        einsaetze,
        status: eq.status,
        nextMaintenance: eq.nextMaintenance,
      };
    });
  }, [allOrdersQuery.data, equipmentQuery.data]);

  const isLoading =
    allOrdersQuery.isLoading ||
    staffQuery.isLoading ||
    equipmentQuery.isLoading;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Berichte
          </h1>
          <p className="text-muted-foreground">
            Auswertungen und Statistiken im Zeitraum
          </p>
        </div>
      </div>

      {/* Zeitraum-Filter */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="zeitraum-select">Zeitraum</Label>
            <Select
              value={zeitraum}
              onValueChange={(v) => setZeitraum(v as Zeitraum)}
            >
              <SelectTrigger id="zeitraum-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monat">Dieser Monat</SelectItem>
                <SelectItem value="quartal">Dieses Quartal</SelectItem>
                <SelectItem value="jahr">Dieses Jahr</SelectItem>
                <SelectItem value="benutzerdefiniert">
                  Benutzerdefiniert
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {zeitraum === 'benutzerdefiniert' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="custom-from">Von</Label>
                <Input
                  id="custom-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-to">Bis</Label>
                <Input
                  id="custom-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}

          {zeitraum !== 'benutzerdefiniert' && (
            <div className="md:col-span-3 flex items-end">
              <span className="text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 inline mr-1" />
                {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="auftraege">
        <TabsList>
          <TabsTrigger value="auftraege" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Auftragsstatistik
          </TabsTrigger>
          <TabsTrigger value="mitarbeiter" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Mitarbeiter-Auslastung
          </TabsTrigger>
          <TabsTrigger value="geraete" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Geräte-Übersicht
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Auftragsstatistik ─────────────────────────────────────── */}
        <TabsContent value="auftraege" className="space-y-6">
          {isLoading ? (
            <LoadingIndicator />
          ) : (
            <>
              {/* Kennzahlen-Kacheln */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KennzahlKarte
                  label="Gesamt-Aufträge"
                  value={stats.total}
                  color="blue"
                />
                <KennzahlKarte
                  label="Erledigt"
                  value={stats.completed}
                  color="green"
                />
                <KennzahlKarte
                  label="Storniert"
                  value={stats.cancelled}
                  color="red"
                />
                <KennzahlKarte
                  label="Abschlussquote"
                  value={`${stats.completionRate} %`}
                  color={
                    stats.completionRate >= 80
                      ? 'green'
                      : stats.completionRate >= 50
                        ? 'yellow'
                        : 'red'
                  }
                />
              </div>

              {/* Tabelle nach Tätigkeit */}
              <div className="rounded-lg border bg-card">
                <div className="p-4 border-b">
                  <h2 className="font-semibold">Aufträge nach Tätigkeit</h2>
                </div>
                {stats.activityRows.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Keine Aufträge im gewählten Zeitraum
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tätigkeit</TableHead>
                        <TableHead className="text-right">Anzahl</TableHead>
                        <TableHead className="text-right">
                          Ø Dauer (min)
                        </TableHead>
                        <TableHead className="text-right">
                          Gesamt (Std.)
                        </TableHead>
                        <TableHead className="w-40">Anteil</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.activityRows.map((row, idx) => {
                        const avgMin =
                          row.count > 0
                            ? Math.round(row.totalMin / row.count)
                            : 0;
                        const totalH = (row.totalMin / 60).toFixed(1);
                        const barPct = Math.round(
                          (row.count / stats.maxCount) * 100,
                        );
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.count}
                            </TableCell>
                            <TableCell className="text-right">
                              {avgMin}
                            </TableCell>
                            <TableCell className="text-right">
                              {totalH}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">
                                  {barPct}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Tab: Mitarbeiter-Auslastung ───────────────────────────────── */}
        <TabsContent value="mitarbeiter" className="space-y-4">
          {isLoading ? (
            <LoadingIndicator />
          ) : (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Mitarbeiter-Auslastung</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Auslastung = (Ist-Stunden / Soll-Stunden) × 100
                </p>
              </div>
              {staffStats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Keine aktiven Mitarbeiter gefunden
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mitarbeiter</TableHead>
                      <TableHead className="text-right">
                        Aufträge
                      </TableHead>
                      <TableHead className="text-right">
                        Ist-Stunden
                      </TableHead>
                      <TableHead className="text-right">
                        Soll-Stunden
                      </TableHead>
                      <TableHead className="w-48">Auslastung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffStats.map((row) => {
                      const barColor =
                        row.auslastung >= 100
                          ? 'bg-red-500'
                          : row.auslastung >= 80
                            ? 'bg-green-500'
                            : row.auslastung >= 50
                              ? 'bg-yellow-500'
                              : 'bg-muted-foreground';
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.staffNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.orderCount}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.totalHours} Std.
                          </TableCell>
                          <TableCell className="text-right">
                            {row.sollHours} Std.
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${barColor}`}
                                  style={{
                                    width: `${Math.min(100, row.auslastung)}%`,
                                  }}
                                />
                              </div>
                              <span
                                className={`text-xs font-medium w-12 text-right ${
                                  row.auslastung >= 100
                                    ? 'text-red-600'
                                    : row.auslastung >= 80
                                      ? 'text-green-600'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {row.auslastung} %
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Geräte-Übersicht ─────────────────────────────────────── */}
        <TabsContent value="geraete" className="space-y-4">
          {isLoading ? (
            <LoadingIndicator />
          ) : (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Geräte- und Fahrzeug-Übersicht</h2>
              </div>
              {equipmentRows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Keine Geräte gefunden
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gerät / Fahrzeug</TableHead>
                      <TableHead className="text-right">
                        Einsätze (Zeitraum)
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Nächste Wartung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipmentRows.map((row) => {
                      const maintenanceVariant = maintenanceColor(
                        row.nextMaintenance,
                      );
                      const maintenanceBadgeText = !row.nextMaintenance
                        ? 'Keine'
                        : (() => {
                            const days = Math.round(
                              (new Date(row.nextMaintenance).getTime() -
                                Date.now()) /
                                (1000 * 60 * 60 * 24),
                            );
                            if (days < 0) return `Überfällig (${Math.abs(days)} Tage)`;
                            if (days === 0) return 'Heute';
                            return `${formatDate(row.nextMaintenance)} (${days} Tage)`;
                          })();

                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.equipmentNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.einsaetze}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                EQUIPMENT_STATUS_VARIANTS[row.status] ??
                                'default'
                              }
                            >
                              {EQUIPMENT_STATUS_LABELS[row.status] ??
                                row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={maintenanceVariant}>
                              {maintenanceBadgeText}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Hilfs-Komponenten ────────────────────────────────────────────────────────

function LoadingIndicator() {
  return (
    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      Daten werden geladen...
    </div>
  );
}

interface KennzahlKarteProps {
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'red' | 'yellow';
}

const COLOR_CLASSES: Record<KennzahlKarteProps['color'], string> = {
  blue: 'text-blue-700 bg-blue-50 border-blue-200',
  green: 'text-green-700 bg-green-50 border-green-200',
  red: 'text-red-700 bg-red-50 border-red-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
};

function KennzahlKarte({ label, value, color }: KennzahlKarteProps) {
  return (
    <div className={`rounded-lg border p-4 ${COLOR_CLASSES[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}

