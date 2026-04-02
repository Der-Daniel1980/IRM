'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useActivityType,
  useUpdateActivityType,
  type UpdateActivityTypeData,
} from '@/hooks/use-activity-types';
import {
  ActivityTypeForm,
  activityTypeToFormValues,
  type ActivityTypeFormValues,
} from '@/components/activities/activity-type-form';
import { LucideIcon } from '@/components/shared/lucide-icon';

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function ActivityTypeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: activityType, isLoading, isError } = useActivityType(id);
  const updateActivityType = useUpdateActivityType(id);

  const handleUpdate = async (formData: UpdateActivityTypeData) => {
    await updateActivityType.mutateAsync(formData);
  };

  // ─── Ladezustand ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Tätigkeit wird geladen...</h1>
        </div>
        <div className="h-32 rounded-md border flex items-center justify-center text-muted-foreground">
          Daten werden geladen...
        </div>
      </div>
    );
  }

  if (isError || !activityType) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Tätigkeit nicht gefunden</h1>
        </div>
        <div className="h-32 rounded-md border flex items-center justify-center text-destructive">
          Diese Tätigkeit wurde nicht gefunden oder ist nicht mehr vorhanden.
        </div>
        <Button variant="outline" onClick={() => router.push('/activities')}>
          Zurück zur Liste
        </Button>
      </div>
    );
  }

  const formDefaults = activityTypeToFormValues(activityType) as Partial<ActivityTypeFormValues>;

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/activities')}
            title="Zurück zur Liste"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md"
            style={{
              backgroundColor: activityType.color + '22',
              color: activityType.color,
            }}
          >
            <LucideIcon name={activityType.icon} className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {activityType.name}
              </h1>
              {activityType.isActive ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Aktiv
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                  Inaktiv
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{activityType.code}</span>
              {' · '}
              <span>{activityType.category}</span>
              {' · '}
              <ClipboardList className="inline h-3 w-3 mr-0.5" />
              <span>Tätigkeitskatalog</span>
            </p>
          </div>
        </div>
      </div>

      {/* Formular */}
      <div className="rounded-md border p-6">
        <h2 className="text-base font-semibold mb-5">Tätigkeit bearbeiten</h2>
        <ActivityTypeForm
          defaultValues={formDefaults}
          onSubmit={handleUpdate}
          onCancel={() => router.push('/activities')}
          isLoading={updateActivityType.isPending}
          submitLabel="Änderungen speichern"
          showStatusField={true}
        />
      </div>

      {/* Metadaten */}
      <div className="rounded-md border p-4 text-sm text-muted-foreground space-y-1">
        <p>
          <span className="font-medium text-foreground">Erstellt:</span>{' '}
          {new Date(activityType.createdAt).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p>
          <span className="font-medium text-foreground">Zuletzt geändert:</span>{' '}
          {new Date(activityType.updatedAt).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p>
          <span className="font-medium text-foreground">Verknüpfte Fähigkeiten:</span>{' '}
          {activityType.requiredSkills.length === 0
            ? 'Keine'
            : activityType.requiredSkills.map((s) => s.name).join(', ')}
        </p>
        <p>
          <span className="font-medium text-foreground">Standard-Ausstattung:</span>{' '}
          {activityType.defaultEquipment.length === 0
            ? 'Keine'
            : activityType.defaultEquipment.map((e) => e.name).join(', ')}
        </p>
      </div>
    </div>
  );
}
