import React from 'react';
import { Chip } from 'react-native-paper';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Entwurf', color: '#6b7280', bg: '#f3f4f6' },
  PLANNED: { label: 'Geplant', color: '#2563eb', bg: '#dbeafe' },
  ASSIGNED: { label: 'Zugewiesen', color: '#7c3aed', bg: '#ede9fe' },
  IN_PROGRESS: { label: 'In Bearbeitung', color: '#d97706', bg: '#fef3c7' },
  COMPLETED: { label: 'Erledigt', color: '#059669', bg: '#d1fae5' },
  CANCELLED: { label: 'Storniert', color: '#dc2626', bg: '#fee2e2' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Niedrig', color: '#6b7280' },
  NORMAL: { label: 'Normal', color: '#2563eb' },
  HIGH: { label: 'Hoch', color: '#d97706' },
  URGENT: { label: 'Dringend', color: '#dc2626' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <Chip
      compact
      textStyle={{ color: config.color, fontSize: 11 }}
      style={{ backgroundColor: config.bg }}
    >
      {config.label}
    </Chip>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.NORMAL;
  return (
    <Chip
      compact
      textStyle={{ color: config.color, fontSize: 11 }}
      style={{ backgroundColor: '#f8fafc', borderColor: config.color, borderWidth: 1 }}
    >
      {config.label}
    </Chip>
  );
}
