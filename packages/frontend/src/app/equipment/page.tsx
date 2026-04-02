'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
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
  useEquipmentList,
  useCreateEquipment,
  useDeleteEquipment,
  type EquipmentCategory,
  type EquipmentStatus,
  type CreateEquipmentData,
  type UpdateEquipmentData,
  type Equipment,
} from '@/hooks/use-equipment';
import { useDebounce } from '@/hooks/use-debounce';
import { EquipmentForm } from '@/components/equipment/equipment-form';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function getStatusBadge(status: EquipmentStatus) {
  switch (status) {
    case 'AVAILABLE':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Verfügbar</Badge>;
    case 'IN_USE':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Im Einsatz</Badge>;
    case 'MAINTENANCE':
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Wartung</Badge>;
    case 'BROKEN':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Defekt</Badge>;
  }
}

function getCategoryLabel(category: EquipmentCategory): string {
  switch (category) {
    case 'MACHINE':
      return 'Maschine';
    case 'VEHICLE':
      return 'KFZ';
    case 'TOOL':
      return 'Werkzeug';
    case 'MATERIAL':
      return 'Material';
  }
}

interface MaintenanceIndicatorProps {
  nextMaintenance: string | null;
}

function MaintenanceIndicator({ nextMaintenance }: MaintenanceIndicatorProps) {
  if (!nextMaintenance) return <span className="text-muted-foreground">—</span>;

  const maintenanceDate = new Date(nextMaintenance);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formatted = maintenanceDate.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (diffDays < 0) {
    return (
      <span className="flex items-center gap-1 text-red-600 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        {formatted}
      </span>
    );
  }

  if (diffDays <= 30) {
    return (
      <span className="flex items-center gap-1 text-orange-600 font-medium">
        <Clock className="h-3.5 w-3.5" />
        {formatted}
      </span>
    );
  }

  return <span className="text-muted-foreground">{formatted}</span>;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function MaschinenPage() {
  const router = useRouter();

  // Filter & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 300);

  const query = {
    search: debouncedSearch || undefined,
    category: filterCategory !== 'all' ? (filterCategory as EquipmentCategory) : undefined,
    status: filterStatus !== 'all' ? (filterStatus as EquipmentStatus) : undefined,
    page,
    limit,
  };

  const { data, isLoading, isError } = useEquipmentList(query);
  const createEquipment = useCreateEquipment();
  const deleteEquipment = useDeleteEquipment();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setFilterCategory(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setFilterStatus(value);
    setPage(1);
  }, []);

  const handleCreate = async (formData: CreateEquipmentData | UpdateEquipmentData) => {
    await createEquipment.mutateAsync(formData as CreateEquipmentData);
    setIsCreateDialogOpen(false);
  };

  const handleDelete = async (equipment: Equipment) => {
    if (
      window.confirm(
        `Gerät "${equipment.name}" (${equipment.equipmentNumber}) wirklich löschen?\n\nDies kann nicht rückgängig gemacht werden.`,
      )
    ) {
      await deleteEquipment.mutateAsync(equipment.id);
    }
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Maschinen &amp; KFZ</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} Geräte insgesamt` : 'Geräteverwaltung'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neues Gerät
        </Button>
      </div>

      {/* Filter & Suche */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, Typ, GER-Nummer, Kennzeichen..."
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
            <SelectItem value="MACHINE">Maschinen</SelectItem>
            <SelectItem value="VEHICLE">KFZ</SelectItem>
            <SelectItem value="TOOL">Werkzeug</SelectItem>
            <SelectItem value="MATERIAL">Material</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="AVAILABLE">Verfügbar</SelectItem>
            <SelectItem value="IN_USE">Im Einsatz</SelectItem>
            <SelectItem value="MAINTENANCE">Wartung</SelectItem>
            <SelectItem value="BROKEN">Defekt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GER-Nr.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Typ</TableHead>
              <TableHead className="hidden sm:table-cell">Kategorie</TableHead>
              <TableHead className="hidden lg:table-cell">Kennzeichen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Nächste Wartung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Daten werden geladen...
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-destructive">
                  Fehler beim Laden der Gerätedaten. Bitte Seite neu laden.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {debouncedSearch
                    ? `Keine Geräte gefunden für "${debouncedSearch}"`
                    : 'Noch keine Geräte vorhanden.'}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => router.push(`/equipment/${item.id}`)}
              >
                <TableCell className="font-mono text-sm font-medium">
                  {item.equipmentNumber}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  {item.location && (
                    <div className="text-xs text-muted-foreground">{item.location}</div>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {item.equipmentType}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground font-mono text-sm">
                  {item.licensePlate ?? '—'}
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <MaintenanceIndicator nextMaintenance={item.nextMaintenance} />
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Bearbeiten"
                      onClick={() => router.push(`/equipment/${item.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Löschen"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item)}
                      disabled={deleteEquipment.isPending}
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

      {/* Dialog: Neues Gerät */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neues Gerät anlegen</DialogTitle>
            <DialogDescription>
              Füllen Sie die Pflichtfelder aus. Die Gerätenummer wird automatisch vergeben (GER-XXXX).
            </DialogDescription>
          </DialogHeader>
          <EquipmentForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createEquipment.isPending}
            submitLabel="Gerät anlegen"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
