'use client';

import { useState } from 'react';
import { Database, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Status = {
  type: 'success' | 'error';
  message: string;
} | null;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export function DemoDataPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function handleSeed() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/seed-demo`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Fehler ${res.status}`);
      }
      setStatus({ type: 'success', message: 'Demo-Daten wurden erfolgreich geladen.' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Demo-Daten wirklich loschen? Diese Aktion kann nicht ruckgangig gemacht werden.'
    );
    if (!confirmed) return;

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/seed-demo`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Fehler ${res.status}`);
      }
      setStatus({ type: 'success', message: 'Demo-Daten wurden erfolgreich geloscht.' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unbekannter Fehler beim Loschen.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-dashed border-2 border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Demo-Daten</CardTitle>
            <CardDescription className="text-sm">
              nur in Entwicklungsumgebung
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Testdaten fur Entwicklung und Demonstration anlegen oder entfernen.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSeed}
            disabled={loading}
            className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            Demo-Daten laden
          </Button>

          <Button
            onClick={handleDelete}
            disabled={loading}
            variant="destructive"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Demo-Daten loschen
          </Button>
        </div>

        {status && (
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
              status.type === 'success'
                ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
                : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
