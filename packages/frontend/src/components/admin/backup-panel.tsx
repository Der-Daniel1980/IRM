'use client';

import { useState } from 'react';
import { Download, HardDrive, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
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

export function BackupPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function handleBackup() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.post('/admin/backup', undefined, {
        responseType: 'blob',
      });

      const blob = res.data as Blob;

      // Dateiname aus Content-Disposition lesen, sonst Fallback
      const disposition = (res.headers['content-disposition'] as string) ?? '';
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename =
        match && match[1]
          ? match[1].replace(/['"]/g, '').trim()
          : 'irm-backup.sql';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({ type: 'success', message: `Backup erfolgreich heruntergeladen: ${filename}` });
    } catch (err) {
      let message = 'Unbekannter Fehler beim Backup.';
      const errorResponse = (err as { response?: { data?: unknown; status?: number } }).response;
      if (errorResponse?.data instanceof Blob) {
        try {
          const text = await errorResponse.data.text();
          const body = JSON.parse(text);
          const raw = body?.message;
          message =
            typeof raw === 'string'
              ? raw
              : Array.isArray(raw)
                ? raw.join(', ')
                : JSON.stringify(body);
        } catch {
          message = `Fehler ${errorResponse.status}`;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setStatus({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <HardDrive className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Datensicherung</CardTitle>
            <CardDescription className="text-sm">
              SQL-Dump der gesamten Datenbank
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Erstellt einen vollständigen SQL-Dump der Datenbank.
        </p>

        <Button onClick={handleBackup} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Datenbank-Backup herunterladen
        </Button>

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
