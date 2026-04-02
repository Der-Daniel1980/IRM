'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import { useSkills } from '@/hooks/use-skills';
import { useEquipmentList } from '@/hooks/use-equipment';
import { LucideIcon } from '@/components/shared/lucide-icon';
import type { ActivityType, CreateActivityTypeData } from '@/hooks/use-activity-types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const activityTypeSchema = z
  .object({
    code: z.string().min(1, 'Code ist erforderlich').max(50).toUpperCase(),
    name: z.string().min(1, 'Name ist erforderlich').max(150),
    category: z.string().min(1, 'Kategorie ist erforderlich').max(100),
    description: z.string().max(2000).optional().or(z.literal('')),
    defaultDurationMin: z.coerce.number().int().min(1).max(1440),
    isRecurring: z.boolean(),
    recurrenceInterval: z
      .enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'SEASONAL'])
      .nullable()
      .optional(),
    seasonStart: z.coerce.number().int().min(1).max(12).nullable().optional(),
    seasonEnd: z.coerce.number().int().min(1).max(12).nullable().optional(),
    icon: z.string().max(50).default('ClipboardList'),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültiger HEX-Farbwert')
      .default('#6B7280'),
    isActive: z.boolean(),
    requiredSkillIds: z.array(z.string().uuid()).default([]),
    defaultEquipmentIds: z.array(z.string().uuid()).default([]),
  })
  .refine(
    (data) => {
      if (data.isRecurring && data.recurrenceInterval === 'SEASONAL') {
        return data.seasonStart != null && data.seasonEnd != null;
      }
      return true;
    },
    {
      message: 'Bei saisonalem Intervall sind Saisonbeginn und -ende Pflichtfelder',
      path: ['seasonStart'],
    },
  );

export type ActivityTypeFormValues = z.infer<typeof activityTypeSchema>;

// ─── Hilfsfunktion ───────────────────────────────────────────────────────────

export function activityTypeToFormValues(at: ActivityType): ActivityTypeFormValues {
  return {
    code: at.code,
    name: at.name,
    category: at.category,
    description: at.description ?? '',
    defaultDurationMin: at.defaultDurationMin,
    isRecurring: at.isRecurring,
    recurrenceInterval: at.recurrenceInterval,
    seasonStart: at.seasonStart,
    seasonEnd: at.seasonEnd,
    icon: at.icon,
    color: at.color,
    isActive: at.isActive,
    requiredSkillIds: at.requiredSkills.map((s) => s.id),
    defaultEquipmentIds: at.defaultEquipment.map((e) => e.id),
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityTypeFormProps {
  defaultValues?: Partial<ActivityTypeFormValues>;
  onSubmit: (data: CreateActivityTypeData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  showStatusField?: boolean;
}

// ─── Monatsnamen ─────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1, label: 'Januar' },
  { value: 2, label: 'Februar' },
  { value: 3, label: 'März' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Dezember' },
];

// ─── Formular ─────────────────────────────────────────────────────────────────

export function ActivityTypeForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Speichern',
  showStatusField = false,
}: ActivityTypeFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ActivityTypeFormValues>({
    resolver: zodResolver(activityTypeSchema),
    defaultValues: {
      code: '',
      name: '',
      category: '',
      description: '',
      defaultDurationMin: 60,
      isRecurring: false,
      recurrenceInterval: null,
      seasonStart: null,
      seasonEnd: null,
      icon: 'ClipboardList',
      color: '#6B7280',
      isActive: true,
      requiredSkillIds: [],
      defaultEquipmentIds: [],
      ...defaultValues,
    },
  });

  const { data: skills } = useSkills();
  const { data: equipmentData } = useEquipmentList({ limit: 100 });

  const isRecurring = watch('isRecurring');
  const recurrenceInterval = watch('recurrenceInterval');
  const selectedSkillIds = watch('requiredSkillIds');
  const selectedEquipmentIds = watch('defaultEquipmentIds');
  const iconValue = watch('icon');
  const colorValue = watch('color');

  const isSeasonal = isRecurring && recurrenceInterval === 'SEASONAL';

  // Interval zurücksetzen wenn isRecurring deaktiviert wird
  useEffect(() => {
    if (!isRecurring) {
      setValue('recurrenceInterval', null);
      setValue('seasonStart', null);
      setValue('seasonEnd', null);
    }
  }, [isRecurring, setValue]);

  // Saisonfelder zurücksetzen wenn Interval nicht SEASONAL
  useEffect(() => {
    if (recurrenceInterval !== 'SEASONAL') {
      setValue('seasonStart', null);
      setValue('seasonEnd', null);
    }
  }, [recurrenceInterval, setValue]);

  const handleFormSubmit = async (values: ActivityTypeFormValues) => {
    await onSubmit({
      code: values.code,
      name: values.name,
      category: values.category,
      description: values.description || undefined,
      defaultDurationMin: values.defaultDurationMin,
      isRecurring: values.isRecurring,
      recurrenceInterval: values.recurrenceInterval ?? undefined,
      seasonStart: values.seasonStart ?? undefined,
      seasonEnd: values.seasonEnd ?? undefined,
      icon: values.icon,
      color: values.color,
      isActive: values.isActive,
      requiredSkillIds: values.requiredSkillIds,
      defaultEquipmentIds: values.defaultEquipmentIds,
    });
  };

  const toggleSkill = (skillId: string) => {
    const current = selectedSkillIds ?? [];
    if (current.includes(skillId)) {
      setValue('requiredSkillIds', current.filter((id) => id !== skillId));
    } else {
      setValue('requiredSkillIds', [...current, skillId]);
    }
  };

  const toggleEquipment = (equipId: string) => {
    const current = selectedEquipmentIds ?? [];
    if (current.includes(equipId)) {
      setValue('defaultEquipmentIds', current.filter((id) => id !== equipId));
    } else {
      setValue('defaultEquipmentIds', [...current, equipId]);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Code + Name */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            placeholder="RASEN"
            className="uppercase"
            {...register('code')}
          />
          {errors.code && (
            <p className="text-xs text-destructive">{errors.code.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" placeholder="Rasenmähen" {...register('name')} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
      </div>

      {/* Kategorie + Dauer */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category">Kategorie *</Label>
          <Input id="category" placeholder="Garten" {...register('category')} />
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="defaultDurationMin">Standarddauer (Minuten) *</Label>
          <Input
            id="defaultDurationMin"
            type="number"
            min={1}
            max={1440}
            {...register('defaultDurationMin', { valueAsNumber: true })}
          />
          {errors.defaultDurationMin && (
            <p className="text-xs text-destructive">
              {errors.defaultDurationMin.message}
            </p>
          )}
        </div>
      </div>

      {/* Beschreibung */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea
          id="description"
          placeholder="Kurze Beschreibung der Tätigkeit..."
          rows={2}
          {...register('description')}
        />
      </div>

      {/* Icon + Farbe */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="icon">Lucide-Icon-Name</Label>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md border"
              style={{ color: colorValue }}
            >
              <LucideIcon name={iconValue} className="h-5 w-5" />
            </div>
            <Input
              id="icon"
              placeholder="ClipboardList"
              className="flex-1"
              {...register('icon')}
            />
          </div>
          {errors.icon && (
            <p className="text-xs text-destructive">{errors.icon.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color">Farbe</Label>
          <div className="flex items-center gap-2">
            <input
              id="color"
              type="color"
              className="h-9 w-9 cursor-pointer rounded-md border p-0.5"
              {...register('color')}
            />
            <Input
              placeholder="#6B7280"
              value={colorValue}
              onChange={(e) => setValue('color', e.target.value)}
              className="flex-1 font-mono text-sm"
            />
          </div>
          {errors.color && (
            <p className="text-xs text-destructive">{errors.color.message}</p>
          )}
        </div>
      </div>

      {/* Wiederkehrend */}
      <div className="rounded-md border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="isRecurring" className="font-medium">
              Wiederkehrende Tätigkeit
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tätigkeit wiederholt sich in regelmäßigen Abständen
            </p>
          </div>
          <Controller
            control={control}
            name="isRecurring"
            render={({ field }) => (
              <Switch
                id="isRecurring"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        {isRecurring && (
          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label>Wiederholungsintervall</Label>
              <Controller
                control={control}
                name="recurrenceInterval"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) =>
                      field.onChange(v === '' ? null : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Intervall wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Täglich</SelectItem>
                      <SelectItem value="WEEKLY">Wöchentlich</SelectItem>
                      <SelectItem value="BIWEEKLY">14-tägig</SelectItem>
                      <SelectItem value="MONTHLY">Monatlich</SelectItem>
                      <SelectItem value="SEASONAL">Saisonal</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {isSeasonal && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Saisonbeginn *</Label>
                  <Controller
                    control={control}
                    name="seasonStart"
                    render={({ field }) => (
                      <Select
                        value={field.value != null ? String(field.value) : ''}
                        onValueChange={(v) =>
                          field.onChange(v === '' ? null : Number(v))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Monat wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={String(m.value)}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.seasonStart && (
                    <p className="text-xs text-destructive">
                      {errors.seasonStart.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Saisonende *</Label>
                  <Controller
                    control={control}
                    name="seasonEnd"
                    render={({ field }) => (
                      <Select
                        value={field.value != null ? String(field.value) : ''}
                        onValueChange={(v) =>
                          field.onChange(v === '' ? null : Number(v))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Monat wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={String(m.value)}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.seasonEnd && (
                    <p className="text-xs text-destructive">
                      {errors.seasonEnd.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Erforderliche Fähigkeiten */}
      <div className="space-y-2">
        <Label className="font-medium">Erforderliche Fähigkeiten</Label>
        <p className="text-xs text-muted-foreground">
          Nur Mitarbeiter mit diesen Fähigkeiten können für diese Tätigkeit eingeplant werden.
        </p>
        <div className="flex flex-wrap gap-2 min-h-8">
          {skills?.map((skill) => {
            const isSelected = (selectedSkillIds ?? []).includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-accent'
                }`}
              >
                {skill.name}
                {isSelected && <X className="h-3 w-3" />}
              </button>
            );
          })}
          {!skills?.length && (
            <span className="text-sm text-muted-foreground">
              Keine Fähigkeiten geladen...
            </span>
          )}
        </div>
        {(selectedSkillIds ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(selectedSkillIds ?? []).map((id) => {
              const skill = skills?.find((s) => s.id === id);
              return skill ? (
                <Badge key={id} variant="secondary" className="text-xs">
                  {skill.name}
                </Badge>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Standard-Ausstattung */}
      <div className="space-y-2">
        <Label className="font-medium">Standard-Ausstattung</Label>
        <p className="text-xs text-muted-foreground">
          Diese Geräte werden standardmäßig bei der Auftragserstellung vorgeschlagen.
        </p>
        <div className="flex flex-wrap gap-2 min-h-8">
          {equipmentData?.data.map((equip) => {
            const isSelected = (selectedEquipmentIds ?? []).includes(equip.id);
            return (
              <button
                key={equip.id}
                type="button"
                onClick={() => toggleEquipment(equip.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-accent'
                }`}
              >
                {equip.name}
                {isSelected && <X className="h-3 w-3" />}
              </button>
            );
          })}
          {!equipmentData?.data.length && (
            <span className="text-sm text-muted-foreground">
              Keine Geräte geladen...
            </span>
          )}
        </div>
      </div>

      {/* Aktiv-Status (nur im Bearbeitungsformular sichtbar) */}
      {showStatusField && (
        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <Label htmlFor="isActive" className="font-medium">
              Tätigkeit aktiv
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inaktive Tätigkeiten stehen bei Auftragsanlage nicht zur Auswahl
            </p>
          </div>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="isActive"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      )}

      {/* Aktionen */}
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
