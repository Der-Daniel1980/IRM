'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Home,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useProperty,
  usePropertyUnits,
  useUpdateProperty,
  useCreatePropertyUnit,
  useUpdatePropertyUnit,
  useDeletePropertyUnit,
  type UpdatePropertyData,
  type PropertyUnit,
  type UnitUsageType,
  type CreatePropertyUnitData,
} from '@/hooks/use-properties';
import { PropertyForm, propertyToFormValues } from '@/components/properties/property-form';

// Leaflet IMMER mit ssr:false importieren
const PropertyMapDynamic = dynamic(
  () => import('@/components/map/property-map').then((m) => m.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Karte wird geladen...
      </div>
    ),
  },
);

// ─── Hilfsdaten ───────────────────────────────────────────────────────────────

const UNIT_USAGE_TYPE_LABELS: Record<UnitUsageType, string> = {
  RESIDENTIAL: 'Wohnen',
  COMMERCIAL: 'Gewerbe',
  COMMON_AREA: 'Gemeinschaft',
  TECHNICAL: 'Technik',
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Wohnimmobilie',
  COMMERCIAL: 'Gewerbe',
  MIXED: 'Gemischt',
  LAND: 'Grundstück',
  PARKING: 'Parkplatz',
};

// ─── Einheiten-Formular ───────────────────────────────────────────────────────

interface UnitFormData {
  unitNumber: string;
  floor: string;
  tenantName: string;
  tenantPhone: string;
  usageType: UnitUsageType;
  areaSqm: string;
  notes: string;
}

const defaultUnitForm = (): UnitFormData => ({
  unitNumber: '',
  floor: '',
  tenantName: '',
  tenantPhone: '',
  usageType: 'RESIDENTIAL',
  areaSqm: '',
  notes: '',
});

function unitToFormData(unit: PropertyUnit): UnitFormData {
  return {
    unitNumber: unit.unitNumber,
    floor: unit.floor,
    tenantName: unit.tenantName ?? '',
    tenantPhone: unit.tenantPhone ?? '',
    usageType: unit.usageType,
    areaSqm: unit.areaSqm ? String(parseFloat(unit.areaSqm)) : '',
    notes: unit.notes ?? '',
  };
}

function formDataToUnitPayload(form: UnitFormData): CreatePropertyUnitData {
  return {
    unitNumber: form.unitNumber,
    floor: form.floor,
    tenantName: form.tenantName || undefined,
    tenantPhone: form.tenantPhone || undefined,
    usageType: form.usageType,
    areaSqm: form.areaSqm ? parseFloat(form.areaSqm) : undefined,
    notes: form.notes || undefined,
  };
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function ImmobilienDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: property, isLoading, isError } = useProperty(id);
  const { data: units = [] } = usePropertyUnits(id);
  const updateProperty = useUpdateProperty(id);
  const createUnit = useCreatePropertyUnit(id);
  const updateUnit = useUpdatePropertyUnit(id);
  const deleteUnit = useDeletePropertyUnit(id);

  // Unit Dialog State
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState<UnitFormData>(defaultUnitForm());

  const handlePropertySubmit = async (data: UpdatePropertyData) => {
    await updateProperty.mutateAsync(data);
  };

  const handlePropertyCancel = () => {
    router.push('/properties');
  };

  // Einheit anlegen/bearbeiten öffnen
  const openCreateUnit = () => {
    setEditingUnitId(null);
    setUnitForm(defaultUnitForm());
    setIsUnitDialogOpen(true);
  };

  const openEditUnit = (unit: PropertyUnit) => {
    setEditingUnitId(unit.id);
    setUnitForm(unitToFormData(unit));
    setIsUnitDialogOpen(true);
  };

  const handleUnitSave = async () => {
    const payload = formDataToUnitPayload(unitForm);
    if (editingUnitId) {
      await updateUnit.mutateAsync({ unitId: editingUnitId, data: payload });
    } else {
      await createUnit.mutateAsync(payload);
    }
    setIsUnitDialogOpen(false);
  };

  const handleDeleteUnit = async (unit: PropertyUnit) => {
    if (
      window.confirm(
        `Einheit "${unit.unitNumber}" wirklich löschen?\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`,
      )
    ) {
      await deleteUnit.mutateAsync(unit.id);
    }
  };

  // Ladezustand
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handlePropertyCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Immobilie laden...</h1>
        </div>
        <div className="h-64 rounded-md border flex items-center justify-center text-muted-foreground">
          Daten werden geladen...
        </div>
      </div>
    );
  }

  // Fehlerfall
  if (isError || !property) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handlePropertyCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Fehler</h1>
        </div>
        <div className="rounded-md border border-destructive p-6 text-destructive">
          Immobilie wurde nicht gefunden oder es ist ein Fehler aufgetreten.
        </div>
        <Button variant="outline" onClick={handlePropertyCancel}>
          Zurück zur Immobilienliste
        </Button>
      </div>
    );
  }

  // GeoJSON für Einzelkarte aufbauen
  const singlePropertyGeoJson = {
    type: 'FeatureCollection' as const,
    features:
      property.latitude && property.longitude
        ? [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [
                  parseFloat(property.longitude),
                  parseFloat(property.latitude),
                ] as [number, number],
              },
              properties: {
                id: property.id,
                propertyNumber: property.propertyNumber,
                name: property.name,
                addressStreet: property.addressStreet,
                addressZip: property.addressZip,
                addressCity: property.addressCity,
                isActive: property.isActive,
                propertyType: property.propertyType,
                unitsCount: property.unitsCount,
              },
            },
          ]
        : [],
  };

  const formattedDate = new Date(property.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const isUnitSaving = createUnit.isPending || updateUnit.isPending;

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handlePropertyCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Building2 className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{property.name}</h1>
            <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {property.propertyNumber}
            </span>
            <Badge variant="secondary">
              {PROPERTY_TYPE_LABELS[property.propertyType] ?? property.propertyType}
            </Badge>
            {!property.isActive && <Badge variant="destructive">Inaktiv</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {property.addressStreet}, {property.addressZip} {property.addressCity} &middot; Angelegt
            am {formattedDate}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stammdaten">
        <TabsList>
          <TabsTrigger value="stammdaten">
            <Building2 className="h-4 w-4 mr-1.5" />
            Stammdaten
          </TabsTrigger>
          <TabsTrigger value="karte">
            <MapPin className="h-4 w-4 mr-1.5" />
            Karte
          </TabsTrigger>
          <TabsTrigger value="einheiten">
            <Home className="h-4 w-4 mr-1.5" />
            Einheiten
            {property.unitsCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {property.unitsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="auftragshistorie">
            <FileText className="h-4 w-4 mr-1.5" />
            Auftragshistorie
          </TabsTrigger>
        </TabsList>

        {/* Tab: Stammdaten */}
        <TabsContent value="stammdaten">
          <div className="rounded-md border p-6">
            <h2 className="text-base font-semibold mb-6">Stammdaten bearbeiten</h2>
            <PropertyForm
              defaultValues={propertyToFormValues(property)}
              onSubmit={handlePropertySubmit}
              onCancel={handlePropertyCancel}
              isLoading={updateProperty.isPending}
              submitLabel="Änderungen speichern"
            />
          </div>
        </TabsContent>

        {/* Tab: Karte */}
        <TabsContent value="karte">
          <div className="rounded-md border overflow-hidden">
            {property.latitude && property.longitude ? (
              <div className="h-96">
                <PropertyMapDynamic
                  geoData={singlePropertyGeoJson}
                  className="h-full w-full"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                <MapPin className="h-10 w-10 opacity-30" />
                <p className="text-sm">Keine Koordinaten vorhanden.</p>
                <p className="text-xs">
                  Tragen Sie Breitengrad und Längengrad in den Stammdaten ein, um die Immobilie
                  auf der Karte anzuzeigen.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Einheiten */}
        <TabsContent value="einheiten">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Einheiten ({property.unitsCount})
              </h2>
              <Button size="sm" onClick={openCreateUnit}>
                <Plus className="h-4 w-4" />
                Neue Einheit
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Einheitsnr.</TableHead>
                    <TableHead>Etage</TableHead>
                    <TableHead className="hidden md:table-cell">Nutzungsart</TableHead>
                    <TableHead className="hidden md:table-cell">Mieter</TableHead>
                    <TableHead className="hidden lg:table-cell">Fläche</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground text-sm"
                      >
                        Noch keine Einheiten vorhanden. Klicken Sie auf &quot;Neue Einheit&quot;.
                      </TableCell>
                    </TableRow>
                  )}
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                      <TableCell>{unit.floor}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">
                          {UNIT_USAGE_TYPE_LABELS[unit.usageType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {unit.tenantName ?? '—'}
                        {unit.tenantPhone && (
                          <div className="text-xs">{unit.tenantPhone}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {unit.areaSqm
                          ? `${parseFloat(unit.areaSqm).toLocaleString('de-DE')} m²`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Bearbeiten"
                            onClick={() => openEditUnit(unit)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Löschen"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteUnit(unit)}
                            disabled={deleteUnit.isPending}
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
          </div>
        </TabsContent>

        {/* Tab: Auftragshistorie */}
        <TabsContent value="auftragshistorie">
          <div className="rounded-md border p-6">
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Wird in Phase 2 implementiert</p>
              <p className="text-xs text-center max-w-sm">
                Hier werden nach der Implementierung des Auftragsmoduls alle Aufträge für diese
                Immobilie angezeigt.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Einheit anlegen / bearbeiten */}
      <Dialog open={isUnitDialogOpen} onOpenChange={setIsUnitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUnitId ? 'Einheit bearbeiten' : 'Neue Einheit anlegen'}
            </DialogTitle>
            <DialogDescription>
              {editingUnitId
                ? 'Bearbeiten Sie die Daten der Einheit.'
                : 'Legen Sie eine neue Einheit für diese Immobilie an.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitNumber">
                  Einheitsnummer <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="unitNumber"
                  value={unitForm.unitNumber}
                  onChange={(e) =>
                    setUnitForm((f) => ({ ...f, unitNumber: e.target.value }))
                  }
                  placeholder="WE-01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="floor">
                  Etage <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="floor"
                  value={unitForm.floor}
                  onChange={(e) => setUnitForm((f) => ({ ...f, floor: e.target.value }))}
                  placeholder="2. OG"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usageType">Nutzungsart</Label>
              <Select
                value={unitForm.usageType}
                onValueChange={(v) =>
                  setUnitForm((f) => ({ ...f, usageType: v as UnitUsageType }))
                }
              >
                <SelectTrigger id="usageType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESIDENTIAL">Wohnen</SelectItem>
                  <SelectItem value="COMMERCIAL">Gewerbe</SelectItem>
                  <SelectItem value="COMMON_AREA">Gemeinschaftsfläche</SelectItem>
                  <SelectItem value="TECHNICAL">Technikraum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenantName">Mieter</Label>
                <Input
                  id="tenantName"
                  value={unitForm.tenantName}
                  onChange={(e) =>
                    setUnitForm((f) => ({ ...f, tenantName: e.target.value }))
                  }
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantPhone">Telefon Mieter</Label>
                <Input
                  id="tenantPhone"
                  value={unitForm.tenantPhone}
                  onChange={(e) =>
                    setUnitForm((f) => ({ ...f, tenantPhone: e.target.value }))
                  }
                  placeholder="+49 30 12345678"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="areaSqm">Fläche (m²)</Label>
              <Input
                id="areaSqm"
                value={unitForm.areaSqm}
                onChange={(e) => setUnitForm((f) => ({ ...f, areaSqm: e.target.value }))}
                type="number"
                step="0.01"
                min={0}
                placeholder="75.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitNotes">Notizen</Label>
              <Input
                id="unitNotes"
                value={unitForm.notes}
                onChange={(e) => setUnitForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Interne Notizen..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUnitDialogOpen(false)}
                disabled={isUnitSaving}
              >
                <X className="h-4 w-4" />
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleUnitSave}
                disabled={
                  isUnitSaving ||
                  !unitForm.unitNumber.trim() ||
                  !unitForm.floor.trim()
                }
              >
                <Check className="h-4 w-4" />
                {isUnitSaving ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
