'use client';

import { Shield, Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAdminRoles, useAdminUsers } from '@/hooks/use-admin';

// ─── Rollenbeschreibungen ────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'irm-admin': 'Vollzugriff auf alle Bereiche inkl. Verwaltung',
  'irm-disponent': 'Einsatzplanung, Auftrags- und Laufzettelverwaltung',
  'irm-objektverwalter': 'Immobilien- und Kundenverwaltung',
  'irm-mitarbeiter': 'Eigene Auftrags- und Laufzettelansicht',
  'irm-readonly': 'Nur lesender Zugriff auf alle Bereiche',
};

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function RollenVerwaltungPage() {
  const { data: roles, isLoading: rolesLoading, isError: rolesError } = useAdminRoles();
  const { data: users } = useAdminUsers();

  // Anzahl Benutzer pro Rolle berechnen
  const userCountByRole = (roleName: string): number => {
    if (!users) return 0;
    return users.filter((u) => u.realmRoles?.includes(roleName)).length;
  };

  const irmRoles = roles?.filter((r) => r.name.startsWith('irm-')) ?? [];
  const otherRoles = roles?.filter((r) => !r.name.startsWith('irm-')) ?? [];

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rollenverwaltung</h1>
          <p className="text-sm text-muted-foreground">
            Keycloak-Rollen und deren Zuweisungen
          </p>
        </div>
      </div>

      {/* Hinweis */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
        <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Rollen werden in Keycloak verwaltet</p>
          <p className="mt-1">
            Neue Rollen müssen direkt im Keycloak-Administrationspanel angelegt werden
            (<code className="font-mono text-xs bg-muted px-1 rounded">{process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? '/auth'}/admin/{process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? 'irm'}/console</code>).
            Diese Ansicht zeigt nur die vorhandenen Rollen und ihre Zuweisung an.
          </p>
        </div>
      </div>

      {/* IRM-Rollen */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">IRM-Systemrollen</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rollenname</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="text-right">Zugewiesene Benutzer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolesLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    Rollen werden geladen...
                  </TableCell>
                </TableRow>
              )}

              {rolesError && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-destructive">
                    Fehler beim Laden der Rollen. Keycloak erreichbar?
                  </TableCell>
                </TableRow>
              )}

              {!rolesLoading && !rolesError && irmRoles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    Keine IRM-Rollen gefunden. Bitte Keycloak-Konfiguration prufen.
                  </TableCell>
                </TableRow>
              )}

              {irmRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <Badge
                      variant={role.name === 'irm-admin' ? 'destructive' : 'secondary'}
                      className="font-mono"
                    >
                      {role.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {role.description || ROLE_DESCRIPTIONS[role.name] || '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {userCountByRole(role.name)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Sonstige Rollen */}
      {!rolesLoading && otherRoles.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Weitere Keycloak-Rollen</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rollenname</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="text-right">Zugewiesene Benutzer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {role.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {role.description || '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {userCountByRole(role.name)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
