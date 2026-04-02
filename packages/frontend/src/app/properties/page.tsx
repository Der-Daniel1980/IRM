'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
  useProperties,
  useCreateProperty,
  useDeleteProperty,
  type PropertyType,
  type CreatePropertyData,
  type UpdatePropertyData,
} from '@/hooks/use-properties';
import { useDebounce } from '@/hooks/use-debounce';
import { PropertyForm } from '@/components/properties/property-form';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  RESIDENTIAL: 'Wohnimmobilie',
  COMMERCIAL: 'Gewerbe',
  MIXED: 'Gemischt',
  LAND: 'Grundstück',
  PARKING: 'Parkplatz',
};

const PROPERTY_TYPE_BADGE_VARIANTS: Record<PropertyType, 'default' | 'secondary' | 'outline'> = {
  RESIDENTIAL: 'default',
  COMMERCIAL: 'secondary',
  MIXED: 'secondary',
  LAND: 'outline',
  PARKING: 'outline',
};

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function ImmobilienPage() {
  const router = useRouter();

  // Filter & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCity, setFilterCity] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Suche debounced
  const debouncedSearch = useDebounce(searchInput, 300);
  const debouncedCity = useDebounce(filterCity, 300);

  // Query Parameter
  const query = {
    search: debouncedSearch || undefined,
    propertyType: filterType !== 'all' ? (filterType as PropertyType) : undefined,
    city: debouncedCity || undefined,
    page,
    limit,
  };

  // Hooks
  const { data, isLoading, isError } = useProperties(query);
  const createProperty = useCreateProperty();
  const deleteProperty = useDeleteProperty();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleTypeChange = useCallback((value: string) => {
    setFilterType(value);
    setPage(1);
  }, []);

  const handleCityChange = useCallback((value: string) => {
    setFilterCity(value);
    setPage(1);
  }, []);

  const handleCreate = async (formData: CreatePropertyData | UpdatePropertyData) => {
    await createProperty.mutateAsync(formData as CreatePropertyData);
    setIsCreateDialogOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        `Immobilie "${name}" wirklich deaktivieren?\n\nDie Immobilie wird nicht gelöscht, sondern nur deaktiviert.`,
      )
    ) {
      await deleteProperty.mutateAsync(id);
    }
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Immobilien</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} Objekte insgesamt` : 'Immobilienverwaltung'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neue Immobilie
        </Button>
      </div>

      {/* Filter & Suche */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, Adresse, Objektnummer..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Stadt filtern..."
          value={filterCity}
          onChange={(e) => handleCityChange(e.target.value)}
          className="sm:w-40"
        />
        <Select value={filterType} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="RESIDENTIAL">Wohnimmobilie</SelectItem>
            <SelectItem value="COMMERCIAL">Gewerbe</SelectItem>
            <SelectItem value="MIXED">Gemischt</SelectItem>
            <SelectItem value="LAND">Grundstück</SelectItem>
            <SelectItem value="PARKING">Parkplatz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Objektnr.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Adresse</TableHead>
              <TableHead className="hidden lg:table-cell">Typ</TableHead>
              <TableHead className="hidden lg:table-cell">Fläche</TableHead>
              <TableHead className="hidden sm:table-cell">Einheiten</TableHead>
              <TableHead>Status</TableHead>
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
                  Fehler beim Laden der Immobiliendaten. Bitte Seite neu laden.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {debouncedSearch
                    ? `Keine Immobilien gefunden für "${debouncedSearch}"`
                    : 'Noch keine Immobilien vorhanden.'}
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((property) => (
              <TableRow
                key={property.id}
                className="cursor-pointer"
                onClick={() => router.push(`/properties/${property.id}`)}
              >
                <TableCell className="font-mono text-sm font-medium">
                  {property.propertyNumber}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{property.name}</div>
                  {property.customer && (
                    <div className="text-xs text-muted-foreground">
                      {property.customer.companyName}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  <div>{property.addressStreet}</div>
                  <div>{property.addressZip} {property.addressCity}</div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant={PROPERTY_TYPE_BADGE_VARIANTS[property.propertyType]}>
                    {PROPERTY_TYPE_LABELS[property.propertyType]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                  {property.totalAreaSqm
                    ? `${parseFloat(property.totalAreaSqm).toLocaleString('de-DE')} m²`
                    : '—'}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-center">
                  {property.unitsCount}
                </TableCell>
                <TableCell>
                  <Badge variant={property.isActive ? 'default' : 'secondary'}>
                    {property.isActive ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
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
                      onClick={() => router.push(`/properties/${property.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Deaktivieren"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(property.id, property.name)}
                      disabled={deleteProperty.isPending}
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

      {/* Dialog: Neue Immobilie */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Immobilie anlegen</DialogTitle>
            <DialogDescription>
              Füllen Sie die Pflichtfelder aus. Die Objektnummer wird automatisch vergeben.
            </DialogDescription>
          </DialogHeader>
          <PropertyForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createProperty.isPending}
            submitLabel="Immobilie anlegen"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
