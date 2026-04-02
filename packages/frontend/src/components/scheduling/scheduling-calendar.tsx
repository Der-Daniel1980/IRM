'use client';

import React, { useRef, useState, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import deLocale from '@fullcalendar/core/locales/de';
import type { EventInput, EventDropArg, DateSelectArg, EventClickArg } from '@fullcalendar/core';
// EventResizeDoneArg und ResourceInput via Laufzeit-Typen (FullCalendar v6 exports)
type EventResizeDoneArg = Parameters<NonNullable<import('@fullcalendar/core').CalendarOptions['eventResize']>>[0];
type ResourceInput = { id: string; title: string; eventColor?: string };
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { useWorkOrders, workOrderKeys } from '@/hooks/use-work-orders';
import type { WorkOrder } from '@/hooks/use-work-orders';
import { useStaffList } from '@/hooks/use-staff';
import { useAbsences } from '@/hooks/use-absences';
import { ABSENCE_TYPE_LABELS } from '@/hooks/use-absences';
import { api } from '@/lib/api';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function buildEventEnd(
  plannedDate: string,
  startTime: string,
  durationMin: number,
): string {
  const dt = new Date(`${plannedDate}T${startTime}`);
  dt.setMinutes(dt.getMinutes() + durationMin);
  return dt.toISOString();
}

function extractTimeString(isoOrTime: string | null | undefined): string {
  if (!isoOrTime) return '08:00';
  // Wenn es wie HH:MM aussieht
  if (/^\d{2}:\d{2}/.test(isoOrTime)) return isoOrTime.slice(0, 5);
  // ISO-String → lokale Uhrzeit
  const d = new Date(isoOrTime);
  if (!isNaN(d.getTime())) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return '08:00';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Entwurf',
    PLANNED: 'Geplant',
    ASSIGNED: 'Zugeteilt',
    IN_PROGRESS: 'In Bearbeitung',
    COMPLETED: 'Abgeschlossen',
    CANCELLED: 'Storniert',
  };
  return map[status] ?? status;
}

function priorityVariant(priority: string): 'default' | 'warning' | 'destructive' | 'secondary' {
  if (priority === 'URGENT') return 'destructive';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'LOW') return 'secondary';
  return 'default';
}

function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    LOW: 'Niedrig',
    NORMAL: 'Normal',
    HIGH: 'Hoch',
    URGENT: 'Dringend',
  };
  return map[priority] ?? priority;
}

// ─── Typen ────────────────────────────────────────────────────────────────────

type ColorMode = 'activity' | 'staff';

type SelectedEvent = {
  order: WorkOrder;
};

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function SchedulingCalendar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);

  const [colorMode, setColorMode] = useState<ColorMode>('activity');
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Aktuelles Kalender-Fenster für Abwesenheits-Query
  const [calendarRange, setCalendarRange] = useState<{ from: string; to: string }>(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
    return { from, to };
  });

  // ─── Daten laden ─────────────────────────────────────────────────────────

  const { data: workOrdersData } = useWorkOrders({
    from: calendarRange.from,
    to: calendarRange.to,
    limit: 500,
  });

  const { data: staffData } = useStaffList({ isActive: true, limit: 200 });

  const { data: absencesData } = useAbsences({
    from: calendarRange.from,
    to: calendarRange.to,
    status: 'APPROVED',
    limit: 500,
  });

  // ─── Resources (Mitarbeiter) ──────────────────────────────────────────────

  const resources: ResourceInput[] = useMemo(() => {
    const list = staffData?.data ?? [];
    const mapped = list.map((s) => ({
      id: s.id,
      title: `${s.firstName} ${s.lastName}`,
      eventColor: colorMode === 'staff' ? s.color : undefined,
    }));
    // Nicht zugewiesen als Fallback-Resource
    return [
      ...mapped,
      { id: 'unassigned', title: 'Nicht zugeteilt', eventColor: '#94a3b8' },
    ];
  }, [staffData, colorMode]);

  // ─── Work-Order Events ────────────────────────────────────────────────────

  const workOrderEvents: EventInput[] = useMemo(() => {
    const orders = workOrdersData?.data ?? [];
    return orders
      .filter((o) => o.plannedDate != null)
      .map((o) => {
        const startTime = extractTimeString(o.plannedStartTime);
        const durationMin = o.plannedDurationMin ?? 60;
        const start = `${o.plannedDate}T${startTime}`;
        const end = buildEventEnd(o.plannedDate!, startTime, durationMin);

        const color =
          colorMode === 'activity'
            ? (o.activityType?.color ?? '#3B82F6')
            : (staffData?.data.find((s) => s.id === o.assignedStaff[0])?.color ?? '#3B82F6');

        return {
          id: o.id,
          title: `${o.activityType?.name ?? '—'} — ${o.property?.name ?? '—'}`,
          start,
          end,
          backgroundColor: color,
          borderColor: color,
          resourceId: o.assignedStaff[0] ?? 'unassigned',
          extendedProps: { order: o },
          editable: o.status !== 'COMPLETED' && o.status !== 'CANCELLED',
        } satisfies EventInput;
      });
  }, [workOrdersData, colorMode, staffData]);

  // ─── Abwesenheits-Hintergrund-Events ─────────────────────────────────────

  const absenceEvents: EventInput[] = useMemo(() => {
    const absences = absencesData?.data ?? [];
    return absences.map((a) => {
      const bgColor = a.type === 'SICK' ? '#fca5a5' : a.type === 'VACATION' ? '#fdba74' : '#c4b5fd';
      // endDate ist inklusiv — FullCalendar background events brauchen exklusives end
      const endDate = new Date(a.endDate);
      endDate.setDate(endDate.getDate() + 1);
      return {
        id: `absence-${a.id}`,
        title: `${ABSENCE_TYPE_LABELS[a.type]}: ${a.staff.firstName} ${a.staff.lastName}`,
        start: a.startDate,
        end: endDate.toISOString().slice(0, 10),
        display: 'background',
        backgroundColor: bgColor,
        resourceId: a.staffId,
        // Kein Drag für Abwesenheiten
        editable: false,
      } satisfies EventInput;
    });
  }, [absencesData]);

  const allEvents: EventInput[] = useMemo(
    () => [...workOrderEvents, ...absenceEvents],
    [workOrderEvents, absenceEvents],
  );

  // ─── Drag-and-Drop Handler ────────────────────────────────────────────────

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const order = info.event.extendedProps?.order as WorkOrder | undefined;
      if (!order) return;

      const newStart = info.event.start;
      if (!newStart) return;

      const newDate = newStart.toISOString().slice(0, 10);
      const newHour = String(newStart.getHours()).padStart(2, '0');
      const newMin = String(newStart.getMinutes()).padStart(2, '0');
      const newTime = `${newHour}:${newMin}`;

      // Abwesenheits-Warnung prüfen
      const staffId = order.assignedStaff[0];
      if (staffId) {
        const hasAbsence = (absencesData?.data ?? []).some(
          (a) =>
            a.staffId === staffId &&
            a.status === 'APPROVED' &&
            newDate >= a.startDate &&
            newDate <= a.endDate,
        );
        if (hasAbsence) {
          const staff = staffData?.data.find((s) => s.id === staffId);
          const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Mitarbeiter';
          setWarningMessage(
            `Achtung: ${staffName} hat am ${new Date(newDate).toLocaleDateString('de-DE')} eine genehmigte Abwesenheit. Trotzdem speichern?`,
          );
          // Rückgängig machen bis Benutzer bestätigt
          info.revert();
          return;
        }
      }

      try {
        await api.patch(`/work-orders/${order.id}`, {
          plannedDate: newDate,
          plannedStartTime: newTime,
        });
        queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      } catch {
        info.revert();
      }
    },
    [absencesData, staffData, queryClient],
  );

  const handleEventResize = useCallback(
    async (info: EventResizeDoneArg) => {
      const order = info.event.extendedProps?.order as WorkOrder | undefined;
      if (!order) return;

      const newStart = info.event.start;
      const newEnd = info.event.end;
      if (!newStart || !newEnd) return;

      const diffMs = newEnd.getTime() - newStart.getTime();
      const newDurationMin = Math.round(diffMs / 60_000);

      try {
        await api.patch(`/work-orders/${order.id}`, {
          plannedDurationMin: newDurationMin,
        });
        queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      } catch {
        info.revert();
      }
    },
    [queryClient],
  );

  // ─── Event-Click ──────────────────────────────────────────────────────────

  const handleEventClick = useCallback((info: EventClickArg) => {
    // Hintergrund-Events ignorieren
    if (info.event.display === 'background') return;
    const order = info.event.extendedProps?.order as WorkOrder | undefined;
    if (order) {
      setSelectedEvent({ order });
    }
  }, []);

  // ─── Datum-Selektion ──────────────────────────────────────────────────────

  const handleDateSelect = useCallback(
    (info: DateSelectArg) => {
      const date = info.startStr.slice(0, 10);
      const resourceId =
        'resource' in info && info.resource ? (info.resource as { id: string }).id : undefined;
      const params = new URLSearchParams({ date });
      if (resourceId && resourceId !== 'unassigned') {
        params.set('staffId', resourceId);
      }
      router.push(`/orders/new?${params.toString()}`);
    },
    [router],
  );

  // ─── Datumsbereich verfolgen ──────────────────────────────────────────────

  const handleDatesSet = useCallback((arg: { start: Date; end: Date }) => {
    setCalendarRange({
      from: arg.start.toISOString().slice(0, 10),
      to: arg.end.toISOString().slice(0, 10),
    });
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Einsatzplanung — Kalender</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Aufträge per Drag-and-Drop planen und verschieben
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="color-mode-toggle" className="text-sm text-muted-foreground select-none">
            Farbe nach Tätigkeit
          </Label>
          <Switch
            id="color-mode-toggle"
            checked={colorMode === 'staff'}
            onCheckedChange={(checked) => setColorMode(checked ? 'staff' : 'activity')}
          />
          <Label htmlFor="color-mode-toggle" className="text-sm text-muted-foreground select-none">
            Farbe nach Mitarbeiter
          </Label>
        </div>
      </div>

      {/* FullCalendar */}
      <div className="flex-1 min-h-0 rounded-lg border bg-background overflow-hidden scheduling-calendar-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            resourceTimeGridPlugin,
          ]}
          locale={deLocale}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'resourceTimeGridDay,timeGridWeek,dayGridMonth',
          }}
          buttonText={{
            today: 'Heute',
            day: 'Tag',
            week: 'Woche',
            month: 'Monat',
          }}
          views={{
            resourceTimeGridDay: {
              buttonText: 'Tag',
              type: 'resourceTimeGrid',
              duration: { days: 1 },
            },
            timeGridWeek: {
              buttonText: 'Woche',
            },
            dayGridMonth: {
              buttonText: 'Monat',
            },
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ resources } as any)}
          events={allEvents}
          slotMinTime="07:00:00"
          slotMaxTime="19:00:00"
          slotDuration="00:15:00"
          slotLabelInterval="01:00"
          snapDuration="00:15:00"
          allDaySlot={false}
          nowIndicator
          height="100%"
          weekends
          // Drag-and-Drop
          editable
          droppable
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          // Datum-Selektion
          selectable
          select={handleDateSelect}
          // Event-Click
          eventClick={handleEventClick}
          // Datumsbereich verfolgen
          datesSet={handleDatesSet}
          // Styling
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
          dayHeaderFormat={{ weekday: 'short', day: '2-digit', month: '2-digit' }}
        />
      </div>

      {/* Event-Detail-Modal */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onNavigate={(id) => {
          setSelectedEvent(null);
          router.push(`/orders/${id}`);
        }}
      />

      {/* Abwesenheits-Warnung */}
      <Dialog open={warningMessage !== null} onOpenChange={() => setWarningMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abwesenheit vorhanden</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{warningMessage}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWarningMessage(null)}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Event-Detail-Modal ───────────────────────────────────────────────────────

interface EventDetailModalProps {
  event: SelectedEvent | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

function EventDetailModal({ event, onClose, onNavigate }: EventDetailModalProps) {
  if (!event) return null;
  const { order } = event;

  const plannedDate = order.plannedDate
    ? new Date(order.plannedDate).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

  const plannedTime = extractTimeString(order.plannedStartTime);
  const durationDisplay =
    order.plannedDurationMin != null
      ? order.plannedDurationMin < 60
        ? `${order.plannedDurationMin} min`
        : `${Math.floor(order.plannedDurationMin / 60)} Std ${order.plannedDurationMin % 60 > 0 ? `${order.plannedDurationMin % 60} min` : ''}`
      : '—';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug">{order.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Auftragsnummer + Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
              {order.orderNumber}
            </span>
            <Badge>{statusLabel(order.status)}</Badge>
            <Badge variant={priorityVariant(order.priority)}>
              {priorityLabel(order.priority)}
            </Badge>
          </div>

          {/* Immobilie */}
          <div>
            <span className="text-muted-foreground">Immobilie: </span>
            <span className="font-medium">{order.property?.name ?? '—'}</span>
            {order.property && (
              <span className="text-muted-foreground ml-1">
                ({order.property.addressStreet}, {order.property.addressCity})
              </span>
            )}
          </div>

          {/* Tätigkeit */}
          <div>
            <span className="text-muted-foreground">Tätigkeit: </span>
            <span className="font-medium">{order.activityType?.name ?? '—'}</span>
          </div>

          {/* Datum & Zeit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Datum: </span>
              <span className="font-medium">{plannedDate}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Zeit: </span>
              <span className="font-medium">{plannedTime} Uhr</span>
            </div>
          </div>

          {/* Dauer */}
          <div>
            <span className="text-muted-foreground">Geplante Dauer: </span>
            <span className="font-medium">{durationDisplay}</span>
          </div>

          {/* Notizen */}
          {order.notes && (
            <div>
              <span className="text-muted-foreground">Notizen: </span>
              <span>{order.notes}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
          <Button onClick={() => onNavigate(order.id)}>Zum Auftrag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
