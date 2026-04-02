'use client';

import { useState, useMemo } from 'react';
import {
  CalendarOff,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useAbsences,
  useCreateAbsence,
  useCancelAbsence,
  useApproveAbsence,
  useRejectAbsence,
  ABSENCE_TYPE_LABELS,
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPE_COLORS,
  type AbsenceType,
  type AbsenceStatus,
  type CreateAbsenceData,
} from '@/hooks/use-absences';
import { useStaffList } from '@/hooks/use-staff';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ─── Status-Badge-Farben ──────────────────────────────────────────────────────

const STATUS_VARIANT: Record<AbsenceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
};

// ─── Typ-Badge-Klassen ────────────────────────────────────────────────────────

const TYPE_BG_CLASS: Record<AbsenceType, string> = {
  VACATION: 'bg-orange-500',
  SICK: 'bg-red-500',
  TRAINING: 'bg-blue-500',
  PERSONAL: 'bg-purple-500',
  COMP_TIME: 'bg-gray-500',
};

// ─── Neue Abwesenheit Dialog ──────────────────────────────────────────────────

interface CreateAbsenceDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateAbsenceDialog({ open, onClose }: CreateAbsenceDialogProps) {
  const [formData, setFormData] = useState<CreateAbsenceData>({
    staffId: '',
    type: 'VACATION',
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: staffData } = useStaffList({ isActive: true, limit: 100 });
  const createAbsence = useCreateAbsence();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.staffId || !formData.startDate || !formData.endDate) {
      setError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('Enddatum darf nicht vor dem Startdatum liegen');
      return;
    }

    try {
      await createAbsence.mutateAsync({
        staffId: formData.staffId,
        type: formData.type,
        startDate: formData.startDate,
        endDate: formData.endDate,
        notes: formData.notes || undefined,
      });
      setFormData({ staffId: '', type: 'VACATION', startDate: '', endDate: '', notes: '' });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Erstellen der Abwesenheit';
      setError(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neue Abwesenheit</DialogTitle>
          <DialogDescription>
            Abwesenheit für einen Mitarbeiter erfassen. Krankheit wird sofort genehmigt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Mitarbeiter *</Label>
            <Select
              value={formData.staffId}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, staffId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter wählen..." />
              </SelectTrigger>
              <SelectContent>
                {staffData?.data.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.staffNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Typ *</Label>
            <Select
              value={formData.type}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, type: v as AbsenceType }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {ABSENCE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Von *</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bis *</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea
              rows={3}
              placeholder="Optionale Begründung..."
              value={formData.notes ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createAbsence.isPending}>
              {createAbsence.isPending ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kalenderübersicht ────────────────────────────────────────────────────────

function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayNum = getDaysInMonth(year, month);
  const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

  const { data, isLoading } = useAbsences({ from: firstDay, to: lastDay, limit: 100 });

  const monthLabel = new Date(year, month).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Sammle alle einzigartigen Mitarbeiter aus den Abwesenheiten
  const staffList = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { id: string; firstName: string; lastName: string }>();
    data.data.forEach((a) => {
      if (!map.has(a.staffId)) {
        map.set(a.staffId, {
          id: a.staffId,
          firstName: a.staff.firstName,
          lastName: a.staff.lastName,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
    );
  }, [data]);

  const days = Array.from({ length: lastDayNum }, (_, i) => i + 1);

  function getAbsencesForStaffAndDay(staffId: string, day: number) {
    if (!data) return [];
    const date = new Date(year, month, day);
    return data.data.filter((a) => {
      if (a.staffId !== staffId) return false;
      if (a.status === 'CANCELLED' || a.status === 'REJECTED') return false;
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      return date >= start && date <= end;
    });
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[160px] text-center font-semibold">{monthLabel}</span>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${TYPE_BG_CLASS[t]}`} />
            {ABSENCE_TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      {isLoading && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Wird geladen...
        </div>
      )}

      {!isLoading && staffList.length === 0 && (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Keine Abwesenheiten in diesem Monat
        </div>
      )}

      {!isLoading && staffList.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 min-w-[140px] border-r bg-muted/50 px-3 py-2 text-left font-medium">
                  Mitarbeiter
                </th>
                {days.map((d) => {
                  const date = new Date(year, month, d);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday =
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate();
                  return (
                    <th
                      key={d}
                      className={`w-7 min-w-[28px] px-0.5 py-2 text-center font-normal ${
                        isWeekend ? 'text-muted-foreground/60' : ''
                      } ${isToday ? 'font-bold text-primary underline' : ''}`}
                    >
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffList.map((staff) => (
                <tr key={staff.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="sticky left-0 z-10 border-r bg-background px-3 py-1.5 font-medium">
                    {staff.lastName}, {staff.firstName}
                  </td>
                  {days.map((d) => {
                    const absences = getAbsencesForStaffAndDay(staff.id, d);
                    return (
                      <td key={d} className="px-0.5 py-1.5 text-center">
                        {absences.length > 0 && (
                          <div className="flex flex-col gap-0.5">
                            {absences.map((a) => (
                              <span
                                key={a.id}
                                title={`${ABSENCE_TYPE_LABELS[a.type]} (${ABSENCE_STATUS_LABELS[a.status]})`}
                                className={`mx-auto block h-4 w-5 rounded-sm opacity-90 ${TYPE_BG_CLASS[a.type]}`}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Listen-Tab ───────────────────────────────────────────────────────────────

function ListView() {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: staffData } = useStaffList({ isActive: true, limit: 100 });

  const fromTo = useMemo(() => {
    if (!filterMonth) return {};
    const [y, m] = filterMonth.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const daysInMonth = getDaysInMonth(y, m - 1);
    const to = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return { from, to };
  }, [filterMonth]);

  const query = {
    type: filterType !== 'all' ? (filterType as AbsenceType) : undefined,
    status: filterStatus !== 'all' ? (filterStatus as AbsenceStatus) : undefined,
    staffId: filterStaffId !== 'all' ? filterStaffId : undefined,
    ...fromTo,
    page,
    limit,
  };

  const { data, isLoading } = useAbsences(query);
  const cancelAbsence = useCancelAbsence();
  const approveAbsence = useApproveAbsence();
  const rejectAbsence = useRejectAbsence();

  const handleApprove = async (id: string) => {
    await approveAbsence.mutateAsync({ id, data: {} });
  };

  const handleReject = async (id: string) => {
    await rejectAbsence.mutateAsync({ id, data: {} });
  };

  const handleCancel = async (id: string) => {
    if (confirm('Abwesenheit wirklich stornieren?')) {
      await cancelAbsence.mutateAsync(id);
    }
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* Filter-Zeile */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {ABSENCE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {(Object.keys(ABSENCE_STATUS_LABELS) as AbsenceStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {ABSENCE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStaffId} onValueChange={(v) => { setFilterStaffId(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Mitarbeiter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
            {staffData?.data.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.lastName}, {s.firstName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="month"
          className="w-[160px]"
          value={filterMonth}
          onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
          placeholder="Monat"
        />
      </div>

      {/* Tabelle */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mitarbeiter</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Von</TableHead>
              <TableHead>Bis</TableHead>
              <TableHead className="text-right">Dauer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Wird geladen...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Keine Abwesenheiten gefunden
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              data?.data.map((absence) => {
                const days = daysBetween(absence.startDate, absence.endDate);
                return (
                  <TableRow key={absence.id}>
                    <TableCell className="font-medium">
                      {absence.staff.lastName}, {absence.staff.firstName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white ${TYPE_BG_CLASS[absence.type]}`}
                      >
                        {ABSENCE_TYPE_LABELS[absence.type]}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(absence.startDate)}</TableCell>
                    <TableCell>{formatDate(absence.endDate)}</TableCell>
                    <TableCell className="text-right">
                      {days} {days === 1 ? 'Tag' : 'Tage'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[absence.status]}>
                        {ABSENCE_STATUS_LABELS[absence.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {absence.status === 'REQUESTED' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Genehmigen"
                              className="h-8 w-8 text-green-600 hover:text-green-700"
                              onClick={() => handleApprove(absence.id)}
                              disabled={approveAbsence.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ablehnen"
                              className="h-8 w-8 text-destructive hover:text-destructive/80"
                              onClick={() => handleReject(absence.id)}
                              disabled={rejectAbsence.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(absence.status === 'REQUESTED' || absence.status === 'APPROVED') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Stornieren"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancel(absence.id)}
                            disabled={cancelAbsence.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.total} Einträge, Seite {page} von {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Weiter
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function AbsencesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <CalendarOff className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Urlaub &amp; Abwesenheit</h1>
            <p className="text-muted-foreground">
              Abwesenheiten erfassen und Genehmigungsworkflow verwalten
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Abwesenheit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="calendar">Kalenderübersicht</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <ListView />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarView />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <CreateAbsenceDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </div>
  );
}
