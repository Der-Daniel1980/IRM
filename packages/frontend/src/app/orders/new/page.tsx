'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Clock, History, Calculator, AlertCircle, Info } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useProperties } from '@/hooks/use-properties';
import { useActivityTypes } from '@/hooks/use-activity-types';
import { useStaffList } from '@/hooks/use-staff';
import { useEquipmentList } from '@/hooks/use-equipment';
import { useCreateWorkOrder, formatDuration } from '@/hooks/use-work-orders';
import { api } from '@/lib/api';
import type { PreviousOrderInfo } from '@/hooks/use-work-orders';

// ─── Schritt-Definitionen ─────────────────────────────────────────────────────

const STEPS = [
  { label: 'Immobilie', number: 1 },
  { label: 'Tätigkeit', number: 2 },
  { label: 'Zeitplanung', number: 3 },
  { label: 'Datum & Zeit', number: 4 },
  { label: 'Mitarbeiter', number: 5 },
  { label: 'Geräte', number: 6 },
];

// ─── Formular-Daten ───────────────────────────────────────────────────────────

interface FormData {
  propertyId: string;
  activityTypeId: string;
  title: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  plannedDate: string;
  plannedStartTime: string;
  plannedDurationMin: number | '';
  assignedStaff: string[];
  assignedEquipment: string[];
  notes: string;
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Vollzeit',
  PART_TIME: 'Teilzeit',
  MINI_JOB: 'Minijob',
  FREELANCER: 'Freiberuflich',
  INTERN: 'Praktikant',
};

const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  MACHINE: 'Maschine',
  VEHICLE: 'KFZ',
  TOOL: 'Werkzeug',
  OTHER: 'Sonstiges',
};

const DEFAULT_FORM: FormData = {
  propertyId: '',
  activityTypeId: '',
  title: '',
  description: '',
  priority: 'NORMAL',
  plannedDate: '',
  plannedStartTime: '',
  plannedDurationMin: '',
  assignedStaff: [],
  assignedEquipment: [],
  notes: '',
};

// ─── Schritt-Fortschrittsleiste ───────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 flex-wrap">
      {STEPS.map((step, index) => (
        <div key={step.number} className="flex items-center py-1">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              step.number < currentStep
                ? 'bg-primary text-primary-foreground'
                : step.number === currentStep
                ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {step.number < currentStep ? <Check className="h-4 w-4" /> : step.number}
          </div>
          <span
            className={`ml-2 text-sm ${
              step.number === currentStep ? 'font-medium' : 'text-muted-foreground'
            }`}
          >
            {step.label}
          </span>
          {index < STEPS.length - 1 && (
            <div
              className={`mx-3 h-px w-8 ${
                step.number < currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function NewOrderPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [previousOrder, setPreviousOrder] = useState<PreviousOrderInfo | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [calculationSource, setCalculationSource] = useState<string>('');

  const createMutation = useCreateWorkOrder();

  // Daten laden
  const { data: propertiesData } = useProperties({ isActive: true, limit: 200 });
  const { data: activityTypesData } = useActivityTypes({ isActive: true, limit: 200 });

  // Ausgewählte Immobilie / Tätigkeit
  const selectedProperty = propertiesData?.data.find((p) => p.id === form.propertyId);
  const selectedActivityType = activityTypesData?.data.find((a) => a.id === form.activityTypeId);

  // Mitarbeiter mit passenden Fähigkeiten laden
  const requiredSkillIds = selectedActivityType?.requiredSkills.map((s) => s.id) ?? [];
  const { data: staffData } = useStaffList({
    isActive: true,
    limit: 200,
    skillId: requiredSkillIds.length > 0 ? requiredSkillIds[0] : undefined,
  });

  // Geräte laden
  const { data: equipmentData } = useEquipmentList({ limit: 200 });

  // Vorgängerauftrag und Zeitberechnung laden wenn Immobilie + Tätigkeit gewählt
  useEffect(() => {
    if (!form.propertyId || !form.activityTypeId) {
      setPreviousOrder(null);
      return;
    }

    async function loadPreviousAndCalculate() {
      setLoadingPrevious(true);
      try {
        // Temporären Dummy-Auftrag erstellen um /previous nutzen zu können?
        // Nein — direkter API-Call mit Query-Parametern
        const response = await api.get<{
          previousOrder: PreviousOrderInfo | null;
          calculatedDurationMin: number | null;
          calculationSource: string;
        }>(`/work-orders/calculate-duration`, {
          params: {
            propertyId: form.propertyId,
            activityTypeId: form.activityTypeId,
          },
        });
        setPreviousOrder(response.data.previousOrder);
        if (response.data.calculatedDurationMin && form.plannedDurationMin === '') {
          setForm((f) => ({
            ...f,
            plannedDurationMin: response.data.calculatedDurationMin ?? '',
          }));
          setCalculationSource(response.data.calculationSource);
        }
      } catch {
        // Kein Endpunkt vorhanden — Fallback: manuell leer lassen
        // Wir nutzen den Backend-Endpunkt zum Abfragen des Vorgängers
        setPreviousOrder(null);
      } finally {
        setLoadingPrevious(false);
      }
    }

    void loadPreviousAndCalculate();
  }, [form.propertyId, form.activityTypeId]);

  // Tätigkeit wählen → Titel automatisch vorausfüllen
  function handleActivityTypeSelect(activityTypeId: string) {
    const at = activityTypesData?.data.find((a) => a.id === activityTypeId);
    setForm((f) => ({
      ...f,
      activityTypeId,
      title: at ? `${at.name}` : f.title,
      plannedDurationMin: '',
      assignedStaff: [],
      // Standard-Ausstattung vorauswählen
      assignedEquipment: at ? at.defaultEquipment.map((e) => e.id) : [],
    }));
  }

  function handleTakePreviousTime() {
    if (previousOrder) {
      const duration = previousOrder.actualDurationMin ?? previousOrder.plannedDurationMin;
      if (duration != null) {
        setForm((f) => ({ ...f, plannedDurationMin: duration }));
        setCalculationSource('previous');
      }
    }
  }

  function toggleStaff(staffId: string) {
    setForm((f) => ({
      ...f,
      assignedStaff: f.assignedStaff.includes(staffId)
        ? f.assignedStaff.filter((id) => id !== staffId)
        : [...f.assignedStaff, staffId],
    }));
  }

  function toggleEquipment(equipmentId: string) {
    setForm((f) => ({
      ...f,
      assignedEquipment: f.assignedEquipment.includes(equipmentId)
        ? f.assignedEquipment.filter((id) => id !== equipmentId)
        : [...f.assignedEquipment, equipmentId],
    }));
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 1: return Boolean(form.propertyId);
      case 2: return Boolean(form.activityTypeId) && Boolean(form.title);
      case 3: return true; // Zeitberechnung ist optional
      case 4: return true; // Datum ist optional
      case 5: return true; // Mitarbeiter optional
      case 6: return true;
      default: return false;
    }
  }

  async function handleSubmit() {
    try {
      const payload = {
        propertyId: form.propertyId,
        activityTypeId: form.activityTypeId,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        plannedDate: form.plannedDate || undefined,
        plannedStartTime: form.plannedStartTime || undefined,
        plannedDurationMin: form.plannedDurationMin !== '' ? Number(form.plannedDurationMin) : undefined,
        assignedStaff: form.assignedStaff.length > 0 ? form.assignedStaff : undefined,
        assignedEquipment: form.assignedEquipment.length > 0 ? form.assignedEquipment : undefined,
        notes: form.notes || undefined,
      };
      await createMutation.mutateAsync(payload);
      router.push('/orders');
    } catch (error) {
      // Fehlerbehandlung — Fehlermeldung wird durch den Mutation-State angezeigt
      console.error('Auftrag erstellen fehlgeschlagen:', error);
    }
  }

  // ─── Schritte rendern ─────────────────────────────────────────────────────

  function renderStep() {
    switch (currentStep) {
      // Schritt 1: Immobilie wählen
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Schritt 1: Immobilie auswählen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Für welche Immobilie soll der Auftrag erstellt werden?
              </p>
            </div>
            <div>
              <Label htmlFor="propertyId">Immobilie *</Label>
              <Select
                value={form.propertyId}
                onValueChange={(v) => setForm((f) => ({ ...f, propertyId: v }))}
              >
                <SelectTrigger id="propertyId" className="mt-1">
                  <SelectValue placeholder="Immobilie auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {propertiesData?.data.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      <span className="font-medium">{property.name}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {property.addressStreet}, {property.addressCity}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProperty && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm">
                <div className="font-medium">{selectedProperty.name}</div>
                <div className="text-muted-foreground">
                  {selectedProperty.addressStreet}, {selectedProperty.addressZip} {selectedProperty.addressCity}
                </div>
                <div className="text-muted-foreground">
                  Kunde: {selectedProperty.customer?.companyName ?? '—'}
                </div>
              </div>
            )}
          </div>
        );

      // Schritt 2: Tätigkeit wählen
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Schritt 2: Tätigkeit auswählen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Welche Tätigkeit soll durchgeführt werden?
              </p>
            </div>
            <div>
              <Label htmlFor="activityTypeId">Tätigkeit *</Label>
              <Select
                value={form.activityTypeId}
                onValueChange={handleActivityTypeSelect}
              >
                <SelectTrigger id="activityTypeId" className="mt-1">
                  <SelectValue placeholder="Tätigkeit auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {activityTypesData?.data.map((at) => (
                    <SelectItem key={at.id} value={at.id}>
                      <span className="font-medium">{at.name}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({at.category})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedActivityType && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedActivityType.name}</span>
                  <span className="text-muted-foreground">({selectedActivityType.code})</span>
                </div>
                {selectedActivityType.requiredSkills.length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-medium">Erforderliche Fähigkeiten:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedActivityType.requiredSkills.map((skill) => (
                        <Badge key={skill.id} variant="outline" className="text-xs">
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedActivityType.defaultEquipment.length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-medium">Standard-Ausstattung:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedActivityType.defaultEquipment.map((eq) => (
                        <Badge key={eq.id} variant="outline" className="text-xs">
                          {eq.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Auftrags-Titel"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optionale Beschreibung..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="priority">Priorität</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as FormData['priority'] }))}
                >
                  <SelectTrigger id="priority" className="mt-1">
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
            </div>
          </div>
        );

      // Schritt 3: Zeitberechnung
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Schritt 3: Zeitplanung</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Geplante Dauer für den Auftrag festlegen.
              </p>
            </div>

            {loadingPrevious && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="h-4 w-4 animate-spin" />
                Lade Vorgänger-Informationen...
              </div>
            )}

            {/* Vorgänger-Banner */}
            {previousOrder && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <History className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-blue-900">Letzter Auftrag gefunden</div>
                    <div className="text-sm text-blue-700 mt-1">
                      Auftrag {previousOrder.orderNumber}
                      {previousOrder.plannedDate && (
                        <span>
                          {' '}vom{' '}
                          {new Date(previousOrder.plannedDate).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-blue-700">
                      Dauer:{' '}
                      <strong>
                        {formatDuration(
                          previousOrder.actualDurationMin ?? previousOrder.plannedDurationMin,
                        )}
                      </strong>
                      {previousOrder.actualDurationMin && ' (tatsächlich)'}
                      {!previousOrder.actualDurationMin && previousOrder.plannedDurationMin && ' (geplant)'}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={handleTakePreviousTime}
                >
                  <History className="mr-1 h-3.5 w-3.5" />
                  Zeit übernehmen
                </Button>
              </div>
            )}

            {/* Berechnungs-Info */}
            {calculationSource && form.plannedDurationMin !== '' && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {calculationSource === 'formula' ? (
                  <Calculator className="h-4 w-4" />
                ) : calculationSource === 'previous' ? (
                  <History className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
                <span>
                  {calculationSource === 'formula' && 'Berechnet per Zeitformel'}
                  {calculationSource === 'previous' && 'Aus Vorgängerauftrag übernommen'}
                  {calculationSource === 'default' && 'Standard-Dauer der Tätigkeit'}
                  {calculationSource === 'manual' && 'Manuell eingegeben'}
                </span>
                <span className="ml-auto">
                  {formatDuration(Number(form.plannedDurationMin) || null)}
                </span>
              </div>
            )}

            {/* Manuelles Eingabefeld (immer editierbar) */}
            <div>
              <Label htmlFor="plannedDurationMin">Geplante Dauer (Minuten)</Label>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  id="plannedDurationMin"
                  type="number"
                  min={1}
                  max={1440}
                  value={form.plannedDurationMin}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      plannedDurationMin: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                  placeholder="z.B. 120"
                  className="w-36"
                />
                <span className="text-sm text-muted-foreground">
                  {form.plannedDurationMin !== '' &&
                    `= ${formatDuration(Number(form.plannedDurationMin))}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Leer lassen für automatische Berechnung beim Speichern.
              </p>
            </div>

            <div>
              <Label htmlFor="notes">Interne Notizen</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Interne Hinweise zum Auftrag..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        );

      // Schritt 4: Datum & Uhrzeit
      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Schritt 4: Datum & Uhrzeit</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Wann soll der Auftrag durchgeführt werden?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plannedDate">Geplantes Datum</Label>
                <Input
                  id="plannedDate"
                  type="date"
                  value={form.plannedDate}
                  onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="plannedStartTime">Startzeit</Label>
                <Input
                  id="plannedStartTime"
                  type="time"
                  value={form.plannedStartTime}
                  onChange={(e) => setForm((f) => ({ ...f, plannedStartTime: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      // Schritt 5: Mitarbeiter zuweisen
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Schritt 5: Mitarbeiter zuweisen</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {selectedActivityType?.requiredSkills.length
                  ? `Es werden Mitarbeiter mit den Fähigkeiten: ${selectedActivityType.requiredSkills.map((s) => s.name).join(', ')} angezeigt.`
                  : 'Mitarbeiter für diesen Auftrag auswählen.'}
              </p>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto rounded-lg border p-2">
              {staffData?.data.map((staffMember) => {
                const isSelected = form.assignedStaff.includes(staffMember.id);
                return (
                  <div
                    key={staffMember.id}
                    className={`flex items-center gap-3 rounded-md p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => toggleStaff(staffMember.id)}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                      style={{ backgroundColor: staffMember.color }}
                    >
                      {staffMember.firstName[0]}{staffMember.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {staffMember.firstName} {staffMember.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {staffMember.staffNumber} · {EMPLOYMENT_TYPE_LABELS[staffMember.employmentType] ?? staffMember.employmentType}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                );
              })}
              {staffData?.data.length === 0 && (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  Keine Mitarbeiter mit den erforderlichen Fähigkeiten gefunden.
                </div>
              )}
            </div>

            {form.assignedStaff.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {form.assignedStaff.length} Mitarbeiter ausgewählt
              </p>
            )}
          </div>
        );

      // Schritt 6: Geräte zuweisen
      case 6:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Schritt 6: Geräte & Ausstattung</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Standard-Ausstattung der Tätigkeit ist vorausgewählt.
              </p>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto rounded-lg border p-2">
              {equipmentData?.data.map((equipment) => {
                const isSelected = form.assignedEquipment.includes(equipment.id);
                const isDefault = selectedActivityType?.defaultEquipment.some(
                  (e) => e.id === equipment.id,
                );
                return (
                  <div
                    key={equipment.id}
                    className={`flex items-center gap-3 rounded-md p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => toggleEquipment(equipment.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{equipment.name}</span>
                        {isDefault && (
                          <Badge variant="outline" className="text-xs py-0">
                            Standard
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {equipment.equipmentNumber} · {EQUIPMENT_CATEGORY_LABELS[equipment.category] ?? equipment.category}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                );
              })}
              {equipmentData?.data.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">
                  Keine Geräte verfügbar.
                </div>
              )}
            </div>

            {form.assignedEquipment.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {form.assignedEquipment.length} Gerät(e) ausgewählt
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/orders')}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Zurück zur Liste
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Neuer Auftrag</h1>
        <p className="text-muted-foreground mt-1">
          Schritt {currentStep} von {STEPS.length}
        </p>
      </div>

      {/* Schrittanzeige */}
      <div className="overflow-x-auto">
        <StepIndicator currentStep={currentStep} />
      </div>

      {/* Formular-Bereich */}
      <div className="rounded-lg border bg-card p-6 min-h-64">
        {renderStep()}
      </div>

      {/* Fehleranzeige */}
      {createMutation.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Fehler beim Erstellen des Auftrags:</strong>
            <div>
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Unbekannter Fehler'}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Zurück
        </Button>

        <div className="flex gap-3">
          {currentStep < STEPS.length ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
            >
              Weiter
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !canProceed()}
            >
              {createMutation.isPending ? 'Wird gespeichert...' : 'Auftrag speichern'}
              <Check className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
