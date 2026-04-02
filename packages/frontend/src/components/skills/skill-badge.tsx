'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SkillLevel } from '@/hooks/use-staff';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface SkillBadgeProps {
  name: string;
  icon?: string;
  level?: SkillLevel;
  expiringSoon?: boolean;
  className?: string;
}

// ─── Level-Label ──────────────────────────────────────────────────────────────

const levelLabel: Record<SkillLevel, string> = {
  BASIC: 'Basis',
  INTERMEDIATE: 'Fortgeschritten',
  EXPERT: 'Experte',
};

// ─── Komponente ───────────────────────────────────────────────────────────────

export function SkillBadge({
  name,
  icon = 'Star',
  level,
  expiringSoon = false,
  className,
}: SkillBadgeProps) {
  // Dynamisches Icon aus Lucide laden
  const IconComponent = (
    LucideIcons[icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }> | undefined
  ) ?? LucideIcons.Star;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        expiringSoon
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-transparent bg-secondary text-secondary-foreground',
        className,
      )}
      title={level ? `${name} — ${levelLabel[level]}${expiringSoon ? ' (Zertifikat läuft ab!)' : ''}` : name}
    >
      <IconComponent className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[120px]">{name}</span>
      {level && (
        <span className="opacity-60 shrink-0">{levelLabel[level]}</span>
      )}
      {expiringSoon && (
        <LucideIcons.AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
      )}
    </span>
  );
}
