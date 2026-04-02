import Link from 'next/link';
import { Settings, UserPlus, Shield, Cog } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const adminTiles = [
  {
    title: 'Benutzerverwaltung',
    description:
      'Benutzerkonten anlegen, bearbeiten, deaktivieren und Rollen zuweisen.',
    href: '/admin/users',
    icon: UserPlus,
    color: 'text-blue-500',
  },
  {
    title: 'Rollenverwaltung',
    description:
      'Keycloak-Rollen einsehen und deren Zuweisungen nachvollziehen.',
    href: '/admin/roles',
    icon: Shield,
    color: 'text-purple-500',
  },
  {
    title: 'Systemeinstellungen',
    description:
      'Arbeitszeiten, Pufferzeiten, Firmenangaben und Standardleistungswerte konfigurieren.',
    href: '/admin/settings',
    icon: Cog,
    color: 'text-orange-500',
  },
];

export default function VerwaltungPage() {
  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verwaltung</h1>
          <p className="text-sm text-muted-foreground">
            Systembereiche fur irm-admin-Benutzer
          </p>
        </div>
      </div>

      {/* Kacheln */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminTiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <tile.icon className={`h-6 w-6 ${tile.color}`} />
                  <CardTitle className="text-base">{tile.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {tile.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Hinweisbox */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Hinweis:</strong> Dieser Bereich ist ausschliesslich fur
          Benutzer mit der Rolle <code className="font-mono font-semibold">irm-admin</code> zuganglich.
          Änderungen wirken sich systemweit aus.
        </p>
      </div>
    </div>
  );
}
