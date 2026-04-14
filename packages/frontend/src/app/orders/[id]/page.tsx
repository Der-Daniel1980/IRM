'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Clock, CheckCircle2, XCircle, Edit2, Save, AlertCircle, CalendarClock, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useWorkOrder,
  useUpdateWorkOrder,
  useCompleteWorkOrder,
  usePreviousWorkOrder,
  formatDuration,
  formatPlannedDate,
  formatPlannedTime,
  WorkOrderStatus,
  WorkOrderPriority,
} from '@/hooks/use-work-orders';
import { useStaffList } from '@/hooks/use-staff';

// ─── Status-Konfiguration ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: 'Entwurf',
  PLANNED: 'Geplant',
  ASSIGNED: 'Zugewiesen',
  IN_PROGRESS: 'In Arbeit',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
};

const STATUS_CLASSES: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PLANNED: 'bg-blue-100 text-blue-700',
  ASSIGNED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Hilfskomponente: Detail-Zeile ─────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 border-b last:border-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm">{value ?? '—'}</dd>
    </div>
  );
}

// ─── Abschluss-Sektion ────────────────────────────────────────────────────────

function CompleteSection({ workOrderId }: { workOrderId: string }) {
  const [completionNotes, setCompletionNotes] = useState('');
  const [actualDurationMin, setActualDurationMin] = useState<number | ''>('');
  const completeMutation = useCompleteWorkOrder(workOrderId);
  const { data: previousOrder } = usePreviousWorkOrder(workOrderId);

  async function handleComplete() {
    if (!confirm('Auftrag wirklich abschließen?')) return;
    await completeMutation.mutateAsync({
      completionNotes: completionNotes || undefined,
      actualDurationMin: actualDurationMin !== '' ? actualDurationMin : undefined,
    });
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold text-green-900">Auftrag abschließen</h3>
      </div>

      {previousOrder && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="text-sm text-blue-800">
            <strong>Letzter Auftrag:</strong> {formatDuration(
              previousOrder.actualDurationMin ?? previousOrder.plannedDurationMin,
            )}
            {previousOrder.plannedDate && (
              <span> (am {new Date(previousOrder.plannedDate).toLocaleDateString('de-DE')})</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
            onClick={() => {
              const duration = previousOrder.actualDurationMin ?? previousOrder.plannedDurationMin;
              if (duration != null) setActualDurationMin(duration);
            }}
          >
            Letzte Zeit übernehmen
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="actualDurationMin">Tatsächliche Dauer (Minuten)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              id="actualDurationMin"
              type="number"
              min={1}
              max={1440}
              value={actualDurationMin}
              onChange={(e) =>
                setActualDurationMin(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="z.B. 90"
              className="w-36"
            />
            <span className="text-sm text-muted-foreground">
              {actualDurationMin !== '' ? `= ${formatDuration(actualDurationMin)}` : '(automatisch)'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="completionNotes">Abschlussnotizen</Label>
        <Textarea
          id="completionNotes"
          value={completionNotes}
          onChange={(e) => setCompletionNotes(e.target.value)}
          placeholder="Durchgeführte Arbeiten, Besonderheiten..."
          className="mt-1"
          rows={4}
        />
      </div>

      {completeMutation.isError && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {completeMutation.error instanceof Error
            ? completeMutation.error.message
            : 'Fehler beim Abschließen'}
        </div>
      )}

      <Button
        onClick={handleComplete}
        disabled={completeMutation.isPending}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {completeMutation.isPending ? 'Wird abgeschlossen...' : 'Auftrag abschließen'}
      </Button>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<WorkOrderStatus | ''>('');
  const [editPriority, setEditPriority] = useState<WorkOrderPriority | ''>('');
  const [editPlannedDate, setEditPlannedDate] = useState<string>('');
  const [editPlannedStartTime, setEditPlannedStartTime] = useState<string>('');
  const [editPlannedDurationMin, setEditPlannedDurationMin] = useState<number | ''>('');
  const [editAssignedStaff, setEditAssignedStaff] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: workOrder, isLoading, isError } = useWorkOrder(id);
  const updateMutation = useUpdateWorkOrder(id);
  const { data: staffData } = useStaffList({ isActive: true, limit: 200 });

  async function handleSave() {
    const payload: Record<string, unknown> = {};
    if (editStatus) payload['status'] = editStatus;
    if (editPriority) payload['priority'] = editPriority;
    payload['plannedDate'] = editPlannedDate || undefined;
    payload['plannedStartTime'] = editPlannedStartTime || undefined;
    payload['plannedDurationMin'] = editPlannedDurationMin === '' ? undefined : editPlannedDurationMin;
    payload['assignedStaff'] = editAssignedStaff;
    payload['notes'] = editNotes || undefined;
    payload['description'] = editDescription || undefined;
    await updateMutation.mutateAsync(payload);
    setIsEditing(false);
  }

  function handleStartEdit() {
    if (!workOrder) return;
    setEditStatus(workOrder.status);
    setEditPriority(workOrder.priority);
    setEditPlannedDate(workOrder.plannedDate ? workOrder.plannedDate.slice(0, 10) : '');
    setEditPlannedStartTime(workOrder.plannedStartTime ? formatPlannedTime(workOrder.plannedStartTime) : '');
    setEditPlannedDurationMin(workOrder.plannedDurationMin ?? '');
    setEditAssignedStaff([...workOrder.assignedStaff]);
    setEditNotes(workOrder.notes ?? '');
    setEditDescription(workOrder.description ?? '');
    setIsEditing(true);
  }

  function toggleStaff(staffId: string) {
    setEditAssignedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId],
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Lade Auftrag...
      </div>
    );
  }

  if (isError || !workOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">Auftrag nicht gefunden.</p>
        <Button variant="outline" onClick={() => router.push('/orders')}>
          Zurück zur Liste
        </Button>
      </div>
    );
  }

  const canComplete =
    workOrder.status === 'IN_PROGRESS' || workOrder.status === 'ASSIGNED' || workOrder.status === 'PLANNED';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/orders')}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Zurück
        </Button>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              <Edit2 className="mr-1 h-4 w-4" />
              Bearbeiten
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="mr-1 h-4 w-4" />
                Speichern
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Auftragstitel */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{workOrder.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-sm text-muted-foreground">
              {workOrder.orderNumber}
            </span>
            <StatusBadge status={workOrder.status} />
          </div>
        </div>
      </div>

      {/* Auftrag bearbeiten */}
      {isEditing && (
        <div className="rounded-lg border bg-card p-6 space-y-6">
          <h3 className="font-medium">Auftrag bearbeiten</h3>

          {updateMutation.isError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Fehler beim Speichern'}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as WorkOrderStatus)}
              >
                <SelectTrigger id="edit-status" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Entwurf</SelectItem>
                  <SelectItem value="PLANNED">Geplant</SelectItem>
                  <SelectItem value="ASSIGNED">Zugewiesen</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Arbeit</SelectItem>
                  <SelectItem value="COMPLETED">Abgeschlossen</SelectItem>
                  <SelectItem value="CANCELLED">Storniert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-priority">Priorität</Label>
              <Select
                value={editPriority}
                onValueChange={(v) => setEditPriority(v as WorkOrderPriority)}
              >
                <SelectTrigger id="edit-priority" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Niedrig</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">Hoch</SelectItem>
                  <SelectItem value="URGENT">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-date">Geplantes Datum</Label>
              <Input
                id="edit-date"
                type="date"
                className="mt-1"
                value={editPlannedDate}
                onChange={(e) => setEditPlannedDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-time">Startzeit</Label>
              <Input
                id="edit-time"
                type="time"
                className="mt-1"
                value={editPlannedStartTime}
                onChange={(e) => setEditPlannedStartTime(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-duration">Geplante Dauer (Minuten)</Label>
              <Input
                id="edit-duration"
                type="number"
                min={1}
                max={1440}
                className="mt-1"
                value={editPlannedDurationMin}
                onChange={(e) =>
                  setEditPlannedDurationMin(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="z.B. 90"
              />
            </div>
          </div>

          <div>
            <Label>Zugewiesene Mitarbeiter</Label>
            <p className="text-xs text-muted-foreground mb-2 mt-1">
              Mehrfachauswahl — klicken zum Aktivieren/Deaktivieren
            </p>
            <div className="flex flex-wrap gap-2">
              {staffData?.data.map((s) => {
                const selected = editAssignedStaff.includes(s.id);
                const initials = `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase();
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleStaff(s.id)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      {initials}
                    </span>
                    <span className={selected ? 'font-medium' : ''}>
                      {s.firstName} {s.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.staffNumber}</span>
                  </button>
                );
              })}
              {(staffData?.data.length ?? 0) === 0 && (
                <span className="text-sm text-muted-foreground">Keine Mitarbeiter verfügbar</span>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="edit-description">Beschreibung</Label>
            <Textarea
              id="edit-description"
              className="mt-1"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="edit-notes">Interne Notizen</Label>
            <Textarea
              id="edit-notes"
              className="mt-1"
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Hauptinformationen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auftragsdetails */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Auftragsdetails
          </h2>
          <dl>
            <DetailRow label="Immobilie" value={
              <div>
                <div className="font-medium">{workOrder.property.name}</div>
                <div className="text-muted-foreground text-xs">
                  {workOrder.property.addressStreet}, {workOrder.property.addressCity}
                </div>
              </div>
            } />
            <DetailRow label="Kunde" value={
              <span>{workOrder.customer.companyName}</span>
            } />
            <DetailRow label="Tätigkeit" value={
              <div>
                <div className="font-medium">{workOrder.activityType.name}</div>
                <div className="text-muted-foreground text-xs">{workOrder.activityType.category}</div>
              </div>
            } />
            <DetailRow label="Priorität" value={workOrder.priority} />
            <DetailRow label="Geplantes Datum" value={formatPlannedDate(workOrder.plannedDate)} />
            <DetailRow label="Startzeit" value={
              workOrder.plannedStartTime
                ? `${formatPlannedTime(workOrder.plannedStartTime)} Uhr`
                : '—'
            } />
            <DetailRow label="Geplante Dauer" value={formatDuration(workOrder.plannedDurationMin)} />
            {workOrder.previousDurationMin && (
              <DetailRow label="Vorgänger-Dauer" value={formatDuration(workOrder.previousDurationMin)} />
            )}
          </dl>
        </div>

        {/* Zeiterfassung */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Zeiterfassung
          </h2>
          <dl>
            <DetailRow label="Tatsächlicher Start" value={
              workOrder.actualStart
                ? new Date(workOrder.actualStart).toLocaleString('de-DE')
                : '—'
            } />
            <DetailRow label="Tatsächliches Ende" value={
              workOrder.actualEnd
                ? new Date(workOrder.actualEnd).toLocaleString('de-DE')
                : '—'
            } />
            <DetailRow label="Tatsächliche Dauer" value={
              workOrder.actualDurationMin
                ? formatDuration(workOrder.actualDurationMin)
                : '—'
            } />
            {workOrder.calculationParams && (
              <DetailRow label="Zeitberechnung" value={
                <span className="text-xs text-muted-foreground">
                  {workOrder.calculationParams.source === 'formula' && 'Per Formel berechnet'}
                  {workOrder.calculationParams.source === 'previous' && 'Aus Vorgänger übernommen'}
                  {workOrder.calculationParams.source === 'manual' && 'Manuell eingegeben'}
                  {workOrder.calculationParams.source === 'default' && 'Standard-Dauer'}
                </span>
              } />
            )}
          </dl>
        </div>
      </div>

      {/* Mitarbeiter & Geräte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mitarbeiter */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Zugewiesene Mitarbeiter</h2>
          {workOrder.assignedStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Mitarbeiter zugewiesen</p>
          ) : (
            <div className="space-y-2">
              {workOrder.assignedStaff.map((staffId) => {
                const details = workOrder.assignedStaffDetails?.find((s) => s.id === staffId);
                const initials = details
                  ? `${details.firstName[0] ?? ''}${details.lastName[0] ?? ''}`.toUpperCase()
                  : 'M';
                return (
                  <div key={staffId} className="text-sm flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: details?.color ?? '#64748b' }}
                    >
                      {initials}
                    </div>
                    {details ? (
                      <span>
                        {details.firstName} {details.lastName}
                        <span className="ml-2 text-xs text-muted-foreground">({details.staffNumber})</span>
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{staffId}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Geräte */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Zugewiesene Geräte
          </h2>
          {workOrder.equipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Geräte zugewiesen</p>
          ) : (
            <div className="space-y-2">
              {workOrder.equipment.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{item.equipment.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({item.equipment.equipmentNumber})
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.isCheckedOut ? 'Ausgegeben' : 'Bereit'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notizen */}
      {(workOrder.notes || workOrder.description) && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Notizen</h2>
          {workOrder.description && (
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Beschreibung</div>
              <p className="text-sm">{workOrder.description}</p>
            </div>
          )}
          {workOrder.notes && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Interne Notizen</div>
              <p className="text-sm">{workOrder.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Abschlussnotizen */}
      {workOrder.completionNotes && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2 text-green-900">
            <CheckCircle2 className="h-4 w-4" />
            Abschlussnotizen
          </h2>
          <p className="text-sm text-green-800">{workOrder.completionNotes}</p>
        </div>
      )}

      {/* Storniert */}
      {workOrder.status === 'CANCELLED' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-medium">Dieser Auftrag wurde storniert.</p>
        </div>
      )}

      {/* Abschluss-Sektion */}
      {canComplete && <CompleteSection workOrderId={id} />}
    </div>
  );
}
