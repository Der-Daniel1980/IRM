'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import type { Staff, CreateStaffData, UpdateStaffData, EmploymentType } from '@/hooks/use-staff';

// ─── Validierungsschema ───────────────────────────────────────────────────────

const staffSchema = z.object({
  firstName: z.string().min(1, 'Vorname ist erforderlich').max(100),
  lastName: z.string().min(1, 'Nachname ist erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse').max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  mobile: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal('')),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'MINI_JOB', 'FREELANCER'] as const),
  weeklyHours: z.coerce.number().min(0).max(168).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültiger HEX-Farbwert').default('#3B82F6'),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface StaffFormProps {
  defaultValues?: Partial<StaffFormValues>;
  onSubmit: (data: CreateStaffData | UpdateStaffData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

// ─── Beschäftigungstyp-Labels ─────────────────────────────────────────────────

const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: 'Vollzeit',
  PART_TIME: 'Teilzeit',
  MINI_JOB: 'Mini-Job',
  FREELANCER: 'Freiberufler',
};

// ─── Komponente ───────────────────────────────────────────────────────────────

export function StaffForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Speichern',
}: StaffFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      employmentType: 'FULL_TIME',
      color: '#3B82F6',
      ...defaultValues,
    },
  });

  const color = watch('color');
  const employmentType = watch('employmentType');

  const handleFormSubmit = (values: StaffFormValues) => {
    const data: CreateStaffData = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: (values.email as string) || undefined,
      phone: (values.phone as string) || undefined,
      mobile: (values.mobile as string) || undefined,
      address: (values.address as string) || undefined,
      latitude: (values.latitude as number) || undefined,
      longitude: (values.longitude as number) || undefined,
      employmentType: values.employmentType,
      weeklyHours: (values.weeklyHours as number) || undefined,
      color: values.color,
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
          <div className="space-y-2">
            <Label htmlFor="firstName">
              Vorname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              {...register('firstName')}
              placeholder="Max"
              aria-invalid={Boolean(errors.firstName)}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">
              Nachname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              {...register('lastName')}
              placeholder="Mustermann"
              aria-invalid={Boolean(errors.lastName)}
            />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Kontakt */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Kontakt
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              {...register('email')}
              type="email"
              placeholder="max.mustermann@firma.de"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              {...register('phone')}
              type="tel"
              placeholder="+49 30 12345678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Mobil</Label>
            <Input
              id="mobile"
              {...register('mobile')}
              type="tel"
              placeholder="+49 151 12345678"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="Musterstraße 1, 12345 Berlin"
            />
          </div>
        </div>
      </div>

      {/* Koordinaten */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Standort (GPS-Koordinaten)
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="latitude">Breitengrad</Label>
            <Input
              id="latitude"
              {...register('latitude')}
              type="number"
              step="0.0000001"
              placeholder="52.5200"
            />
            {errors.latitude && (
              <p className="text-sm text-destructive">{errors.latitude.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="longitude">Längengrad</Label>
            <Input
              id="longitude"
              {...register('longitude')}
              type="number"
              step="0.0000001"
              placeholder="13.4050"
            />
            {errors.longitude && (
              <p className="text-sm text-destructive">{errors.longitude.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Beschäftigung */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Beschäftigung
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="employmentType">
              Beschäftigungstyp <span className="text-destructive">*</span>
            </Label>
            <Select
              value={employmentType}
              onValueChange={(val) => setValue('employmentType', val as EmploymentType)}
            >
              <SelectTrigger id="employmentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(employmentTypeLabels) as EmploymentType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {employmentTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weeklyHours">Wochenstunden</Label>
            <Input
              id="weeklyHours"
              {...register('weeklyHours')}
              type="number"
              step="0.5"
              min="0"
              max="168"
              placeholder="40"
            />
            {errors.weeklyHours && (
              <p className="text-sm text-destructive">{errors.weeklyHours.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Farbe */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Darstellung
        </h3>

        <div className="flex items-center gap-4">
          <Label htmlFor="color">Mitarbeiterfarbe (Kalender)</Label>
          <div className="flex items-center gap-3">
            <input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setValue('color', e.target.value)}
              className="h-9 w-16 cursor-pointer rounded border border-input bg-transparent p-0.5"
              title="Farbe auswählen"
            />
            <span className="font-mono text-sm text-muted-foreground">{color}</span>
          </div>
          {errors.color && (
            <p className="text-sm text-destructive">{errors.color.message}</p>
          )}
        </div>
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

// ─── Hilfsfunktion: Staff → FormValues ───────────────────────────────────────

export function staffToFormValues(staff: Staff): StaffFormValues {
  return {
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email ?? '',
    phone: staff.phone ?? '',
    mobile: staff.mobile ?? '',
    address: staff.address ?? '',
    latitude: staff.latitude ? parseFloat(staff.latitude) : '',
    longitude: staff.longitude ? parseFloat(staff.longitude) : '',
    employmentType: staff.employmentType,
    weeklyHours: staff.weeklyHours ? parseFloat(staff.weeklyHours) : '',
    color: staff.color,
  };
}
