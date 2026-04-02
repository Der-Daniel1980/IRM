'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  Equipment,
  CreateEquipmentData,
  UpdateEquipmentData,
  EquipmentStatus,
} from '@/hooks/use-equipment';

// ─── Validierungsschema ───────────────────────────────────────────────────────

const equipmentSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  category: z.enum(['MACHINE', 'VEHICLE', 'TOOL', 'MATERIAL'], {
    required_error: 'Kategorie ist erforderlich',
  }),
  equipmentType: z.string().min(1, 'Typ ist erforderlich').max(255),
  licensePlate: z.string().max(20).optional().or(z.literal('')),
  requiresLicense: z.boolean(),
  requiredLicenseType: z.string().max(10).optional().or(z.literal('')),
  location: z.string().max(255).optional().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'BROKEN']).optional(),
  nextMaintenance: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export type EquipmentFormValues = z.infer<typeof equipmentSchema>;

// ─── Hilfsfunktion ───────────────────────────────────────────────────────────

export function equipmentToFormValues(equipment: Equipment): Partial<EquipmentFormValues> {
  return {
    name: equipment.name,
    category: equipment.category,
    equipmentType: equipment.equipmentType,
    licensePlate: equipment.licensePlate ?? '',
    requiresLicense: equipment.requiresLicense,
    requiredLicenseType: equipment.requiredLicenseType ?? '',
    location: equipment.location ?? '',
    status: equipment.status,
    nextMaintenance: equipment.nextMaintenance
      ? equipment.nextMaintenance.substring(0, 10)
      : '',
    notes: equipment.notes ?? '',
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EquipmentFormProps {
  defaultValues?: Partial<EquipmentFormValues>;
  onSubmit: (data: CreateEquipmentData | UpdateEquipmentData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  showStatusField?: boolean;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export function EquipmentForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Speichern',
  showStatusField = false,
}: EquipmentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      requiresLicense: false,
      ...defaultValues,
    },
  });

  const category = watch('category');
  const requiresLicense = watch('requiresLicense');
  const isVehicle = category === 'VEHICLE';

  const handleFormSubmit = (values: EquipmentFormValues) => {
    const data: CreateEquipmentData & { status?: EquipmentStatus } = {
      name: values.name,
      category: values.category,
      equipmentType: values.equipmentType,
      requiresLicense: values.requiresLicense,
      ...(values.licensePlate ? { licensePlate: values.licensePlate } : {}),
      ...(values.requiredLicenseType ? { requiredLicenseType: values.requiredLicenseType } : {}),
      ...(values.location ? { location: values.location } : {}),
      ...(values.nextMaintenance ? { nextMaintenance: values.nextMaintenance } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
      ...(showStatusField && values.status ? { status: values.status } : {}),
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="z.B. Großflächenmäher 1"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Kategorie + Typ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">
            Kategorie <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('category')}
            onValueChange={(v) =>
              setValue('category', v as EquipmentFormValues['category'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Kategorie wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MACHINE">Maschine</SelectItem>
              <SelectItem value="VEHICLE">KFZ / Fahrzeug</SelectItem>
              <SelectItem value="TOOL">Werkzeug</SelectItem>
              <SelectItem value="MATERIAL">Material</SelectItem>
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="equipmentType">
            Gerätetyp <span className="text-destructive">*</span>
          </Label>
          <Input
            id="equipmentType"
            placeholder="z.B. Rasenmäher, Transporter"
            {...register('equipmentType')}
          />
          {errors.equipmentType && (
            <p className="text-sm text-destructive">{errors.equipmentType.message}</p>
          )}
        </div>
      </div>

      {/* KFZ-spezifische Felder — nur sichtbar wenn category = VEHICLE */}
      {isVehicle && (
        <div className="rounded-md border border-dashed p-4 space-y-4">
          <p className="text-sm font-medium text-muted-foreground">KFZ-Daten</p>

          <div className="space-y-1.5">
            <Label htmlFor="licensePlate">Kennzeichen</Label>
            <Input
              id="licensePlate"
              placeholder="z.B. B-IRM 123"
              {...register('licensePlate')}
            />
            {errors.licensePlate && (
              <p className="text-sm text-destructive">{errors.licensePlate.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="requiresLicense"
              checked={requiresLicense}
              onCheckedChange={(checked) => setValue('requiresLicense', checked)}
            />
            <Label htmlFor="requiresLicense" className="cursor-pointer">
              Erfordert Führerschein
            </Label>
          </div>

          {requiresLicense && (
            <div className="space-y-1.5">
              <Label htmlFor="requiredLicenseType">Führerscheinklasse</Label>
              <Input
                id="requiredLicenseType"
                placeholder="z.B. B, C1, C, CE"
                {...register('requiredLicenseType')}
              />
              {errors.requiredLicenseType && (
                <p className="text-sm text-destructive">
                  {errors.requiredLicenseType.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Standort + Nächste Wartung */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="location">Standort</Label>
          <Input
            id="location"
            placeholder="z.B. Depot Nord"
            {...register('location')}
          />
          {errors.location && (
            <p className="text-sm text-destructive">{errors.location.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nextMaintenance">Nächste Wartung</Label>
          <Input
            id="nextMaintenance"
            type="date"
            {...register('nextMaintenance')}
          />
          {errors.nextMaintenance && (
            <p className="text-sm text-destructive">{errors.nextMaintenance.message}</p>
          )}
        </div>
      </div>

      {/* Status — nur im Bearbeitungsmodus */}
      {showStatusField && (
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            value={watch('status')}
            onValueChange={(v) =>
              setValue('status', v as EquipmentStatus, { shouldValidate: true })
            }
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Status wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">Verfügbar</SelectItem>
              <SelectItem value="IN_USE">Im Einsatz</SelectItem>
              <SelectItem value="MAINTENANCE">In Wartung</SelectItem>
              <SelectItem value="BROKEN">Defekt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Notizen */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea
          id="notes"
          placeholder="Interne Anmerkungen..."
          rows={3}
          {...register('notes')}
        />
      </div>

      {/* Buttons */}
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
