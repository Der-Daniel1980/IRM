'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Truck, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useEquipment,
  useUpdateEquipment,
  type UpdateEquipmentData,
  type EquipmentStatus,
} from '@/hooks/use-equipment';
import {
  EquipmentForm,
  equipmentToFormValues,
} from '@/components/equipment/equipment-form';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function getStatusBadge(status: EquipmentStatus) {
  switch (status) {
    case 'AVAILABLE':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Verfügbar</Badge>;
    case 'IN_USE':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Im Einsatz</Badge>;
    case 'MAINTENANCE':
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">In Wartung</Badge>;
    case 'BROKEN':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Defekt</Badge>;
  }
}

function getMaintenanceWarning(nextMaintenance: string | null): React.ReactNode | null {
  if (!nextMaintenance) return null;

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
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Wartung war fällig am {formatted} — bitte umgehend einplanen!
        </span>
      </div>
    );
  }

  if (diffDays <= 30) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          Wartung in {diffDays} Tag{diffDays === 1 ? '' : 'en'} fällig ({formatted}).
        </span>
      </div>
    );
  }

  return null;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: equipment, isLoading, isError } = useEquipment(id);
  const updateEquipment = useUpdateEquipment(id);

  const handleSubmit = async (data: UpdateEquipmentData) => {
    await updateEquipment.mutateAsync(data);
    router.push('/equipment');
  };

  const handleCancel = () => {
    router.push('/equipment');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Gerät laden...</h1>
        </div>
        <div className="h-64 rounded-md border flex items-center justify-center text-muted-foreground">
          Gerätedaten werden geladen...
        </div>
      </div>
    );
  }

  if (isError || !equipment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Fehler</h1>
        </div>
        <div className="rounded-md border border-destructive p-6 text-destructive">
          Gerät wurde nicht gefunden oder es ist ein Fehler aufgetreten.
        </div>
        <Button variant="outline" onClick={handleCancel}>
          Zurück zur Geräteliste
        </Button>
      </div>
    );
  }

  const createdAt = new Date(equipment.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const maintenanceWarning = getMaintenanceWarning(equipment.nextMaintenance);

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Truck className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {equipment.name}
            </h1>
            <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {equipment.equipmentNumber}
            </span>
            {getStatusBadge(equipment.status)}
          </div>
          <p className="text-sm text-muted-foreground">
            {equipment.equipmentType} &middot; Angelegt am {createdAt}
          </p>
        </div>
      </div>

      {/* Wartungs-Warnung */}
      {maintenanceWarning}

      {/* Stammdaten-Formular */}
      <div className="rounded-md border p-6">
        <h2 className="text-base font-semibold mb-6">Stammdaten</h2>
        <EquipmentForm
          defaultValues={equipmentToFormValues(equipment)}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateEquipment.isPending}
          submitLabel="Änderungen speichern"
          showStatusField={true}
        />
      </div>
    </div>
  );
}
