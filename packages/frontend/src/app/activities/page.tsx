'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  useActivityTypes,
  useCreateActivityType,
  useDeleteActivityType,
  type ActivityType,
  type CreateActivityTypeData,
} from '@/hooks/use-activity-types';
import { useDebounce } from '@/hooks/use-debounce';
import { LucideIcon } from '@/components/shared/lucide-icon';
import { ActivityTypeForm } from '@/components/activities/activity-type-form';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

function formatSeason(start: number | null, end: number | null): string {
  if (start == null || end == null) return '';
  return `${MONTH_NAMES[start]} – ${MONTH_NAMES[end]}`;
}

function formatRecurrence(interval: string | null, seasonStart: number | null, seasonEnd: number | null): React.ReactNode {
  if (!interval) return <span className="text-muted-foreground">—</span>;
  const labels: Record<string, string> = {
    DAILY: 'Täglich',
    WEEKLY: 'Wöchentlich',
    BIWEEKLY: '14-tägig',
    MONTHLY: 'Monatlich',
    SEASONAL: 'Saisonal',
  };
  const label = labels[interval] ?? interval;

  if (interval === 'SEASONAL' && seasonStart && seasonEnd) {
    return (
      <span>
        {label}
        <span className="ml-1 text-xs text-muted-foreground">
          ({formatSeason(seasonStart, seasonEnd)})
        </span>
      </span>
    );
  }

  return <span>{label}</span>;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function TaetigkeitenPage() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 300);

  const query = {
    search: debouncedSearch || undefined,
    category: filterCategory !== 'all' ? filterCategory : undefined,
    isActive: filterActive !== 'all' ? filterActive === 'true' : undefined,
    page,
    limit,
  };

  const { data, isLoading, isError } = useActivityTypes(query);
  const createActivityType = useCreateActivityType();
  const deleteActivityType = useDeleteActivityType();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setFilterCategory(value);
    setPage(1);
  }, []);

  const handleActiveChange = useCallback((value: string) => {
    setFilterActive(value);
    setPage(1);
  }, []);

  const handleCreate = async (formData: CreateActivityTypeData) => {
    await createActivityType.mutateAsync(formData);
    setIsCreateDialogOpen(false);
  };

  const handleDelete = async (item: ActivityType) => {
    if (
      window.confirm(
        `Tätigkeit "${item.name}" (${item.code}) wirklich löschen?\n\nDies kann nicht rückgängig gemacht werden.`,
      )
    ) {
      await deleteActivityType.mutateAsync(item.id);
    }
  };

  const totalPages = data?.totalPages ?? 1;

  // Kategorien aus den geladenen Daten ableiten (alle Seiten)
  const categories = Array.from(
    new Set(data?.data.map((a) => a.category) ?? []),
  ).sort();

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tätigkeitskatalog</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} Tätigkeiten insgesamt` : 'Tätigkeiten verwalten'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neue Tätigkeit
        </Button>
      </div>

      {/* Filter & Suche */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, Code, Beschreibung..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={handleActiveChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="true">Aktiv</SelectItem>
            <SelectItem value="false">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Code</TableHead>
              <TableHead className="hidden md:table-cell">Kategorie</TableHead>
              <TableHead className="hidden lg:table-cell">Fähigkeiten</TableHead>
              <TableHead className="hidden sm:table-cell">Dauer</TableHead>
              <TableHead className="hidden md:table-cell">Wiederkehr</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  Daten werden geladen...
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-destructive">
                  Fehler beim Laden der Tätigkeiten. Bitte Seite neu laden.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  {debouncedSearch
                    ? `Keine Tätigkeiten gefunden für "${debouncedSearch}"`
                    : 'Noch keine Tätigkeiten vorhanden.'}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => router.push(`/activities/${item.id}`)}
              >
                {/* Icon */}
                <TableCell>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{ backgroundColor: item.color + '22', color: item.color }}
                  >
                    <LucideIcon name={item.icon} className="h-4 w-4" />
                  </div>
                </TableCell>

                {/* Name */}
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="hidden text-xs text-muted-foreground xl:block max-w-xs truncate">
                      {item.description}
                    </div>
                  )}
                </TableCell>

                {/* Code */}
                <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">
                  {item.code}
                </TableCell>

                {/* Kategorie */}
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline">{item.category}</Badge>
                </TableCell>

                {/* Fähigkeiten */}
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {item.requiredSkills.length === 0 ? (
                      <span className="text-muted-foreground text-sm">—</span>
                    ) : (
                      item.requiredSkills.slice(0, 3).map((skill) => (
                        <Badge
                          key={skill.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {skill.name}
                        </Badge>
                      ))
                    )}
                    {item.requiredSkills.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{item.requiredSkills.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Dauer */}
                <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                  {item.defaultDurationMin} min
                </TableCell>

                {/* Wiederkehr */}
                <TableCell className="hidden md:table-cell text-sm">
                  {item.isRecurring ? (
                    <div className="flex items-center gap-1">
                      <RefreshCcw className="h-3 w-3 text-muted-foreground" />
                      {formatRecurrence(item.recurrenceInterval, item.seasonStart, item.seasonEnd)}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Einmalig</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  {item.isActive ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktiv</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Inaktiv</Badge>
                  )}
                </TableCell>

                {/* Aktionen */}
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Bearbeiten"
                      onClick={() => router.push(`/activities/${item.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Löschen"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item)}
                      disabled={deleteActivityType.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
            Seite {page} von {totalPages} ({data.total} Einträge)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Neue Tätigkeit */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Tätigkeit anlegen</DialogTitle>
            <DialogDescription>
              Definieren Sie eine neue Tätigkeit mit Fähigkeiten und Standard-Ausstattung.
            </DialogDescription>
          </DialogHeader>
          <ActivityTypeForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createActivityType.isPending}
            submitLabel="Tätigkeit anlegen"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
