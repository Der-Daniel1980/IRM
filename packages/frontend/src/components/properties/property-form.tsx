'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomers } from '@/hooks/use-customers';
import type {
  Property,
  PropertyType,
  CreatePropertyData,
  UpdatePropertyData,
} from '@/hooks/use-properties';

// ─── Validierungsschema ───────────────────────────────────────────────────────

const propertySchema = z.object({
  customerId: z.string().uuid('Bitte einen Kunden auswählen'),
  name: z.string().min(1, 'Bezeichnung ist erforderlich').max(255),
  addressStreet: z.string().min(1, 'Straße ist erforderlich').max(255),
  addressZip: z.string().min(1, 'PLZ ist erforderlich').max(10),
  addressCity: z.string().min(1, 'Stadt ist erforderlich').max(100),
  latitude: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(-180).max(180).optional(),
  ),
  propertyType: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'MIXED', 'LAND', 'PARKING'] as const),
  totalAreaSqm: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  greenAreaSqm: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  floors: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).optional(),
  ),
  notes: z.string().optional().or(z.literal('')),
});

export type PropertyFormValues = z.infer<typeof propertySchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface PropertyFormProps {
  defaultValues?: Partial<PropertyFormValues>;
  onSubmit: (data: CreatePropertyData | UpdatePropertyData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export function PropertyForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Speichern',
}: PropertyFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      propertyType: 'RESIDENTIAL',
      floors: 1,
      ...defaultValues,
    },
  });

  // Alle Kunden für Dropdown laden (max 100, nur aktive)
  const { data: customersData } = useCustomers({ isActive: true, limit: 100 });
  const customers = customersData?.data ?? [];

  const selectedCustomerId = watch('customerId');
  const selectedPropertyType = watch('propertyType');

  const handleFormSubmit = (values: PropertyFormValues) => {
    const data: CreatePropertyData = {
      customerId: values.customerId,
      name: values.name,
      addressStreet: values.addressStreet,
      addressZip: values.addressZip,
      addressCity: values.addressCity,
      latitude: values.latitude,
      longitude: values.longitude,
      propertyType: values.propertyType,
      totalAreaSqm: values.totalAreaSqm,
      greenAreaSqm: values.greenAreaSqm,
      floors: values.floors,
      notes: values.notes || undefined,
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Grunddaten */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Grunddaten
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="customerId">
              Kunde <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedCustomerId ?? ''}
              onValueChange={(v) => setValue('customerId', v, { shouldValidate: true })}
            >
              <SelectTrigger id="customerId" aria-invalid={Boolean(errors.customerId)}>
                <SelectValue placeholder="Kunden auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.companyName} ({c.customerNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerId && (
              <p className="text-sm text-destructive">{errors.customerId.message}</p>
            )}
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="name">
              Bezeichnung <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Wohnanlage Mitte"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyType">Immobilientyp</Label>
            <Select
              value={selectedPropertyType}
              onValueChange={(v) => setValue('propertyType', v as PropertyType)}
            >
              <SelectTrigger id="propertyType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESIDENTIAL">Wohnimmobilie</SelectItem>
                <SelectItem value="COMMERCIAL">Gewerbe</SelectItem>
                <SelectItem value="MIXED">Gemischt</SelectItem>
                <SelectItem value="LAND">Grundstück</SelectItem>
                <SelectItem value="PARKING">Parkplatz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="floors">Etagen</Label>
            <Input
              id="floors"
              {...register('floors')}
              type="number"
              min={0}
              placeholder="1"
            />
            {errors.floors && (
              <p className="text-sm text-destructive">{errors.floors.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Adresse */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Adresse
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="addressStreet">
              Straße und Hausnummer <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addressStreet"
              {...register('addressStreet')}
              placeholder="Musterstraße 1"
              aria-invalid={Boolean(errors.addressStreet)}
            />
            {errors.addressStreet && (
              <p className="text-sm text-destructive">{errors.addressStreet.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressZip">
              PLZ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addressZip"
              {...register('addressZip')}
              placeholder="10115"
              maxLength={10}
              aria-invalid={Boolean(errors.addressZip)}
            />
            {errors.addressZip && (
              <p className="text-sm text-destructive">{errors.addressZip.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressCity">
              Stadt <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addressCity"
              {...register('addressCity')}
              placeholder="Berlin"
              aria-invalid={Boolean(errors.addressCity)}
            />
            {errors.addressCity && (
              <p className="text-sm text-destructive">{errors.addressCity.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Koordinaten */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Koordinaten (optional)
        </h3>
        <p className="text-xs text-muted-foreground -mt-2">
          Werden beide Felder ausgefüllt, wird die Immobilie auf der Karte angezeigt.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="latitude">Breitengrad (Latitude)</Label>
            <Input
              id="latitude"
              {...register('latitude')}
              type="number"
              step="any"
              placeholder="52.520008"
            />
            {errors.latitude && (
              <p className="text-sm text-destructive">{errors.latitude.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="longitude">Längengrad (Longitude)</Label>
            <Input
              id="longitude"
              {...register('longitude')}
              type="number"
              step="any"
              placeholder="13.404954"
            />
            {errors.longitude && (
              <p className="text-sm text-destructive">{errors.longitude.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Flächen */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Flächen
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="totalAreaSqm">Gesamtfläche (m²)</Label>
            <Input
              id="totalAreaSqm"
              {...register('totalAreaSqm')}
              type="number"
              step="0.01"
              min={0}
              placeholder="1500.00"
            />
            {errors.totalAreaSqm && (
              <p className="text-sm text-destructive">{errors.totalAreaSqm.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="greenAreaSqm">Grünfläche (m²)</Label>
            <Input
              id="greenAreaSqm"
              {...register('greenAreaSqm')}
              type="number"
              step="0.01"
              min={0}
              placeholder="300.00"
            />
            {errors.greenAreaSqm && (
              <p className="text-sm text-destructive">{errors.greenAreaSqm.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notizen */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Interne Notizen zur Immobilie..."
          rows={3}
        />
      </div>

      {/* Aktionsbuttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Wird gespeichert...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Hilfsfunktion: Property → FormValues ─────────────────────────────────────

export function propertyToFormValues(property: Property): PropertyFormValues {
  return {
    customerId: property.customerId,
    name: property.name,
    addressStreet: property.addressStreet,
    addressZip: property.addressZip,
    addressCity: property.addressCity,
    latitude: property.latitude ? parseFloat(property.latitude) : undefined,
    longitude: property.longitude ? parseFloat(property.longitude) : undefined,
    propertyType: property.propertyType,
    totalAreaSqm: property.totalAreaSqm ? parseFloat(property.totalAreaSqm) : undefined,
    greenAreaSqm: property.greenAreaSqm ? parseFloat(property.greenAreaSqm) : undefined,
    floors: property.floors,
    notes: property.notes ?? '',
  };
}
