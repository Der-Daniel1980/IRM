'use client';

import { useState, useEffect } from 'react';
import { Cog, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSystemSettings, useUpdateSystemSettings, type SystemSettings } from '@/hooks/use-admin';

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function SystemeinstellungenPage() {
  const { data: settings, isLoading, isError } = useSystemSettings();
  const updateSettings = useUpdateSystemSettings();

  const [form, setForm] = useState<Partial<SystemSettings>>({});
  const [isSaved, setIsSaved] = useState(false);

  // Form mit geladenen Einstellungen befüllen
  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const handleChange = (field: keyof SystemSettings, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings.mutateAsync(form);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Cog className="h-7 w-7 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Systemeinstellungen</h1>
        </div>
        <p className="text-muted-foreground">Einstellungen werden geladen...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Cog className="h-7 w-7 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Systemeinstellungen</h1>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Fehler beim Laden der Einstellungen. Bitte Seite neu laden.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cog className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Systemeinstellungen</h1>
            <p className="text-sm text-muted-foreground">
              Globale Konfiguration des IRM-Systems
            </p>
          </div>
        </div>
        {isSaved && (
          <span className="text-sm text-green-600 font-medium">
            Einstellungen gespeichert.
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Firmendaten */}
        <Card>
          <CardHeader>
            <CardTitle>Firmendaten</CardTitle>
            <CardDescription>
              Angaben zur Firma, die in Laufzetteln und Berichten erscheinen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Firmenname</Label>
                <Input
                  id="companyName"
                  value={form.companyName ?? ''}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  placeholder="IRM GmbH"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Firmenanschrift</Label>
                <Input
                  id="companyAddress"
                  value={form.companyAddress ?? ''}
                  onChange={(e) => handleChange('companyAddress', e.target.value)}
                  placeholder="Musterstrasse 1, 37073 Gottingen"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Arbeitszeiten */}
        <Card>
          <CardHeader>
            <CardTitle>Arbeitszeiten & Puffer</CardTitle>
            <CardDescription>
              Standard-Arbeitszeiten für die automatische Einsatzplanung.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="workDayStart">Arbeitsbeginn</Label>
                <Input
                  id="workDayStart"
                  type="time"
                  value={form.workDayStart ?? '07:00'}
                  onChange={(e) => handleChange('workDayStart', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workDayEnd">Arbeitsende</Label>
                <Input
                  id="workDayEnd"
                  type="time"
                  value={form.workDayEnd ?? '17:00'}
                  onChange={(e) => handleChange('workDayEnd', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bufferBetweenOrdersMin">
                  Pufferzeit zwischen Aufträgen (min)
                </Label>
                <Input
                  id="bufferBetweenOrdersMin"
                  type="number"
                  min={0}
                  max={120}
                  value={form.bufferBetweenOrdersMin ?? 15}
                  onChange={(e) =>
                    handleChange('bufferBetweenOrdersMin', parseInt(e.target.value, 10))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leistungswerte */}
        <Card>
          <CardHeader>
            <CardTitle>Standard-Leistungswerte</CardTitle>
            <CardDescription>
              Standardwerte für die automatische Zeitberechnung im Formel-Designer.
              Können pro Auftrag überschrieben werden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultMowRateSqmPerHour">
                  Standard-Mähleistung (qm/Stunde)
                </Label>
                <Input
                  id="defaultMowRateSqmPerHour"
                  type="number"
                  min={1}
                  value={form.defaultMowRateSqmPerHour ?? 500}
                  onChange={(e) =>
                    handleChange('defaultMowRateSqmPerHour', parseInt(e.target.value, 10))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Fläche in qm, die ein Mitarbeiter pro Stunde mähen kann.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultClearRateSqmPerHour">
                  Standard-Räumleistung (qm/Stunde)
                </Label>
                <Input
                  id="defaultClearRateSqmPerHour"
                  type="number"
                  min={1}
                  value={form.defaultClearRateSqmPerHour ?? 200}
                  onChange={(e) =>
                    handleChange('defaultClearRateSqmPerHour', parseInt(e.target.value, 10))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Fläche in qm, die ein Mitarbeiter pro Stunde räumen kann (Schnee/Laub).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Speichern */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateSettings.isPending}
            className="min-w-[140px]"
          >
            <Save className="h-4 w-4" />
            {updateSettings.isPending ? 'Wird gespeichert...' : 'Einstellungen speichern'}
          </Button>
        </div>

        {updateSettings.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Fehler beim Speichern. Bitte erneut versuchen.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
