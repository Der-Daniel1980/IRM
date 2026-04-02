'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calculator,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useFormulas,
  useCreateFormula,
  useDeleteFormula,
  type Formula,
  type CreateFormulaData,
  type FormulaVariable,
} from '@/hooks/use-formulas';
import { useActivityTypes } from '@/hooks/use-activity-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ─── Schnell-Anlegen-Formular ─────────────────────────────────────────────────

interface CreateFormulaFormProps {
  onSubmit: (data: CreateFormulaData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

function CreateFormulaForm({ onSubmit, onCancel, isLoading }: CreateFormulaFormProps) {
  const [name, setName] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [formulaExpression, setFormulaExpression] = useState('');
  const [description, setDescription] = useState('');

  const { data: activitiesData } = useActivityTypes({ isActive: true, limit: 200 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activityTypeId || !formulaExpression.trim()) return;

    // Variablen aus dem Ausdruck extrahieren
    const varNames = Array.from(
      formulaExpression.matchAll(/\{([^}]+)\}/g),
      (m) => m[1],
    );
    const variables: Record<string, FormulaVariable> = {};
    for (const v of varNames) {
      variables[v] = { label: v, type: 'number' };
    }

    await onSubmit({
      name: name.trim(),
      activityTypeId,
      formulaExpression: formulaExpression.trim(),
      variables,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="formula-name">Name *</Label>
        <Input
          id="formula-name"
          placeholder="z.B. Rasenmähen Zeitberechnung"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="formula-activity">Tätigkeit *</Label>
        <Select value={activityTypeId} onValueChange={setActivityTypeId} required>
          <SelectTrigger id="formula-activity">
            <SelectValue placeholder="Tätigkeit wählen..." />
          </SelectTrigger>
          <SelectContent>
            {activitiesData?.data.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="formula-expr">Formel-Ausdruck *</Label>
        <Input
          id="formula-expr"
          placeholder="z.B. ({green_area_sqm} / {mow_rate} * 60) + {setup_min}"
          value={formulaExpression}
          onChange={(e) => setFormulaExpression(e.target.value)}
          required
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Variablen in geschweiften Klammern: {'{'}<span className="text-blue-600">varname</span>{'}'}.
          Operatoren: +, -, *, /, ( )
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="formula-desc">Beschreibung</Label>
        <Textarea
          id="formula-desc"
          placeholder="Optionale Beschreibung..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Abbrechen
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !name.trim() || !activityTypeId || !formulaExpression.trim()}
        >
          {isLoading ? 'Wird angelegt...' : 'Formel anlegen'}
        </Button>
      </div>
    </form>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function FormulaDesignerPage() {
  const router = useRouter();
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const query = {
    isActive: filterActive !== 'all' ? filterActive === 'true' : undefined,
    activityTypeId: filterActivity !== 'all' ? filterActivity : undefined,
    page,
    limit,
  };

  const { data, isLoading, isError } = useFormulas(query);
  const { data: activitiesData } = useActivityTypes({ isActive: true, limit: 200 });
  const createFormula = useCreateFormula();
  const deleteFormula = useDeleteFormula();

  const handleCreate = useCallback(
    async (formData: CreateFormulaData) => {
      await createFormula.mutateAsync(formData);
      setIsCreateDialogOpen(false);
    },
    [createFormula],
  );

  const handleDelete = useCallback(
    async (item: Formula) => {
      if (
        window.confirm(
          `Formel "${item.name}" wirklich löschen?\n\nDies kann nicht rückgängig gemacht werden.`,
        )
      ) {
        await deleteFormula.mutateAsync(item.id);
      }
    },
    [deleteFormula],
  );

  const handleFilterActiveChange = useCallback((value: string) => {
    setFilterActive(value);
    setPage(1);
  }, []);

  const handleFilterActivityChange = useCallback((value: string) => {
    setFilterActivity(value);
    setPage(1);
  }, []);

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Formel-Designer</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} Formeln insgesamt` : 'Zeitformeln verwalten und konfigurieren'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neue Formel
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={filterActivity} onValueChange={handleFilterActivityChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Alle Tätigkeiten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Tätigkeiten</SelectItem>
            {activitiesData?.data.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterActive} onValueChange={handleFilterActiveChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="true">Aktiv</SelectItem>
            <SelectItem value="false">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Tätigkeit</TableHead>
              <TableHead className="hidden md:table-cell">Formel-Ausdruck</TableHead>
              <TableHead className="hidden sm:table-cell text-center">Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Daten werden geladen...
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-destructive">
                  Fehler beim Laden der Formeln. Bitte Seite neu laden.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Noch keine Formeln vorhanden.
                </TableCell>
              </TableRow>
            )}

            {data?.data.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => router.push(`/formula-designer/${item.id}`)}
              >
                {/* Name */}
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="hidden text-xs text-muted-foreground xl:block max-w-xs truncate">
                      {item.description}
                    </div>
                  )}
                </TableCell>

                {/* Tätigkeit */}
                <TableCell className="hidden sm:table-cell">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.activityType.color }}
                    />
                    <span className="text-sm">{item.activityType.name}</span>
                  </div>
                </TableCell>

                {/* Formel-Ausdruck */}
                <TableCell className="hidden md:table-cell">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono max-w-xs block truncate">
                    {item.formula.expression}
                  </code>
                </TableCell>

                {/* Version */}
                <TableCell className="hidden sm:table-cell text-center">
                  <Badge variant="outline" className="font-mono text-xs">
                    v{item.version}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  {item.isActive ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktiv</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Inaktiv</Badge>
                  )}
                </TableCell>

                {/* Aktionen */}
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Bearbeiten"
                      onClick={() => router.push(`/formula-designer/${item.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Löschen"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(item)}
                      disabled={deleteFormula.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Seite {page} von {totalPages} ({data.total} Einträge)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Neue Formel */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neue Formel anlegen</DialogTitle>
            <DialogDescription>
              Legen Sie eine neue Zeitformel mit Variablen an. Variablen werden aus dem
              Formel-Ausdruck automatisch erkannt und können im Editor konfiguriert werden.
            </DialogDescription>
          </DialogHeader>
          <CreateFormulaForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createFormula.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
