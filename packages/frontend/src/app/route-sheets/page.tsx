'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Route,
  Plus,
  Download,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  useRouteSheets,
  useDeleteRouteSheet,
  ROUTE_SHEET_STATUS_LABELS,
  ROUTE_SHEET_STATUS_COLORS,
  formatMinutes,
  type RouteSheetStatus,
  type RouteSheet,
} from '@/hooks/use-route-sheets';
import { useStaffList } from '@/hooks/use-staff';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function LaufzettelPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [staffFilter, setStaffFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<RouteSheet | null>(null);

  const { data, isLoading, isError } = useRouteSheets({
    staffId: staffFilter || undefined,
    date: dateFilter || undefined,
    status: statusFilter as RouteSheetStatus | undefined,
    page,
    limit: 20,
  });

  const { data: staffData } = useStaffList({ isActive: true, limit: 200 });
  const deleteRouteSheet = useDeleteRouteSheet();

  function handlePdfDownload(id: string) {
    window.open(`${API_BASE}/route-sheets/${id}/pdf`, '_blank');
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRouteSheet.mutateAsync(deleteTarget.id);
    } catch {
      // Fehler wird global behandelt
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Seitentitel */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Route className="h-8 w-8" />
            Laufzettel
          </h1>
          <p className="text-muted-foreground mt-1">
            Einsatz-Laufzettel erstellen, verwalten und als PDF herunterladen
          </p>
        </div>
        <Button onClick={() => router.push('/route-sheets/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Laufzettel
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={staffFilter}
          onValueChange={(v) => { setStaffFilter(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Alle Mitarbeiter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
            {staffData?.data.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-44"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          placeholder="Datum"
        />

        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {(Object.keys(ROUTE_SHEET_STATUS_LABELS) as RouteSheetStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {ROUTE_SHEET_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(staffFilter || dateFilter || statusFilter) && (
          <Button
            variant="outline"
            onClick={() => { setStaffFilter(''); setDateFilter(''); setStatusFilter(''); setPage(1); }}
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Blatt-Nr.</TableHead>
              <TableHead>Mitarbeiter</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="text-center">Aufträge</TableHead>
              <TableHead>Gesamtdauer</TableHead>
              <TableHead>Strecke</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-destructive">
                  Fehler beim Laden der Laufzettel
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Keine Laufzettel gefunden
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((sheet) => (
              <TableRow key={sheet.id}>
                <TableCell className="font-mono font-medium">
                  {sheet.sheetNumber}
                </TableCell>
                <TableCell>
                  {staffData?.data.find((s) => s.id === sheet.staffId)
                    ? (() => {
                        const s = staffData.data.find((st) => st.id === sheet.staffId)!;
                        return `${s.firstName} ${s.lastName}`;
                      })()
                    : sheet.staffId.slice(0, 8) + '...'}
                </TableCell>
                <TableCell>{formatDate(sheet.date)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{sheet.items.length}</Badge>
                </TableCell>
                <TableCell>
                  {formatMinutes(sheet.totalDurationMin)}
                </TableCell>
                <TableCell>
                  {sheet.totalDistanceKm
                    ? `${Number(sheet.totalDistanceKm).toFixed(1)} km`
                    : '-'}
                </TableCell>
                <TableCell>
                  <Badge className={ROUTE_SHEET_STATUS_COLORS[sheet.status]}>
                    {ROUTE_SHEET_STATUS_LABELS[sheet.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/route-sheets/${sheet.id}`)}
                      title="Details anzeigen"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePdfDownload(sheet.id)}
                      title="PDF herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {sheet.status === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(sheet)}
                        title="Laufzettel löschen"
                      >
                        <Trash2 className="h-4 w-4" />
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.total} Laufzettel gesamt | Seite {data.page} von {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Laufzettel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Laufzettel <strong>{deleteTarget?.sheetNumber}</strong> wird unwiderruflich
              gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
