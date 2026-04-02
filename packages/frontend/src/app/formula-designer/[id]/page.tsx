'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Trash2,
  Calculator,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useFormula,
  useUpdateFormula,
  useCalculateFormula,
  type FormulaVariable,
} from '@/hooks/use-formulas';
import { useActivityTypes } from '@/hooks/use-activity-types';
import { useProperties } from '@/hooks/use-properties';

// ─── Konstanten ───────────────────────────────────────────────────────────────

const PROPERTY_SOURCES = [
  { value: 'manual', label: 'Manuell' },
  { value: 'property.green_area_sqm', label: 'Immobilie: Grünfläche (m²)' },
  { value: 'property.total_area_sqm', label: 'Immobilie: Gesamtfläche (m²)' },
  { value: 'property.floors', label: 'Immobilie: Stockwerke' },
  { value: 'property.units_count', label: 'Immobilie: Einheiten' },
];

// ─── Formel-Ausdruck mit Syntax-Highlight ─────────────────────────────────────

interface HighlightedExpressionProps {
  expression: string;
}

function HighlightedExpression({ expression }: HighlightedExpressionProps) {
  const parts = expression.split(/(\{[^}]+\})/g);

  return (
    <div className="pointer-events-none absolute inset-0 px-3 py-2 font-mono text-sm whitespace-pre-wrap break-all leading-6">
      {parts.map((part, i) =>
        part.startsWith('{') && part.endsWith('}') ? (
          <span key={i} className="rounded bg-blue-100 px-0.5 text-blue-700 font-semibold">
            {part}
          </span>
        ) : (
          <span key={i} className="text-transparent">{part}</span>
        ),
      )}
    </div>
  );
}

// ─── Variablen-Tabelle ────────────────────────────────────────────────────────

interface VariableRowProps {
  name: string;
  variable: FormulaVariable;
  onChange: (updated: FormulaVariable) => void;
  onRemove: () => void;
}

function VariableRow({ name, variable, onChange, onRemove }: VariableRowProps) {
  return (
    <TableRow>
      <TableCell className="font-mono text-sm text-blue-700 font-medium">
        {'{'}
        {name}
        {'}'}
      </TableCell>
      <TableCell>
        <Input
          value={variable.label}
          onChange={(e) => onChange({ ...variable, label: e.target.value })}
          placeholder="Bezeichnung"
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <Select
          value={variable.source ?? 'manual'}
          onValueChange={(val) =>
            onChange({
              ...variable,
              source: val === 'manual' ? undefined : val,
            })
          }
        >
          <SelectTrigger className="h-8 text-sm w-full min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={variable.default ?? ''}
          onChange={(e) =>
            onChange({
              ...variable,
              default: e.target.value !== '' ? Number(e.target.value) : undefined,
            })
          }
          placeholder="—"
          className="h-8 text-sm w-28"
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onRemove}
          title="Variable entfernen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Live-Vorschau ────────────────────────────────────────────────────────────

interface LivePreviewProps {
  formulaId: string;
  variables: Record<string, FormulaVariable>;
  defaultValues: Record<string, number>;
}

function LivePreview({ formulaId, variables, defaultValues }: LivePreviewProps) {
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  const calculate = useCalculateFormula(formulaId);
  const { data: propertiesData } = useProperties({ limit: 100 });

  // Initialwerte aus defaultValues/Variablen-Defaults befüllen
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const [varName, varDef] of Object.entries(variables)) {
      const defVal = defaultValues[varName] ?? varDef.default;
      if (defVal !== undefined) {
        initial[varName] = String(defVal);
      } else {
        initial[varName] = '';
      }
    }
    setPreviewValues(initial);
  }, [variables, defaultValues]);

  const handleCalculate = useCallback(async () => {
    const overrides: Record<string, number> = {};
    for (const [key, val] of Object.entries(previewValues)) {
      if (val !== '' && !isNaN(Number(val))) {
        overrides[key] = Number(val);
      }
    }

    await calculate.mutateAsync({
      propertyId: selectedPropertyId || undefined,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });
  }, [calculate, previewValues, selectedPropertyId]);

  const result = calculate.data;
  const error = calculate.error;

  return (
    <div className="space-y-4">
      {/* Immobilien-Auswahl */}
      <div className="space-y-1.5">
        <Label className="text-sm">Immobilie (optional — für automatische Befüllung)</Label>
        <Select
          value={selectedPropertyId}
          onValueChange={setSelectedPropertyId}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Keine Immobilie ausgewählt" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Keine Immobilie</SelectItem>
            {propertiesData?.data.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.propertyNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Variablen-Eingabefelder */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(variables).map(([varName, varDef]) => (
          <div key={varName} className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              <span className="font-mono text-blue-600">{'{' + varName + '}'}</span>
              {' — '}
              {varDef.label}
              {varDef.source && varDef.source !== 'manual' && (
                <span className="ml-1 text-xs text-green-600">(auto)</span>
              )}
            </Label>
            <Input
              type="number"
              value={previewValues[varName] ?? ''}
              onChange={(e) =>
                setPreviewValues((prev) => ({ ...prev, [varName]: e.target.value }))
              }
              placeholder="Wert eingeben..."
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>

      {/* Berechnen-Button */}
      <Button
        onClick={() => void handleCalculate()}
        disabled={calculate.isPending}
        className="gap-2"
      >
        <Play className="h-4 w-4" />
        {calculate.isPending ? 'Berechnet...' : 'Berechnen'}
      </Button>

      {/* Ergebnis */}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <div className="text-center">
            <p className="text-sm text-green-700 font-medium">Berechnete Dauer</p>
            <p className="text-3xl font-bold text-green-800 mt-1">
              {result.result}{' '}
              <span className="text-lg font-normal">
                {result.unit === 'minutes' ? 'Minuten' : result.unit}
              </span>
            </p>
          </div>

          <div className="border-t border-green-200 pt-3">
            <p className="text-xs font-medium text-green-700 mb-2">Verwendete Werte:</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {Object.entries(result.usedValues).map(([key, val]) => (
                <div key={key} className="rounded bg-white px-2 py-1 border border-green-100">
                  <p className="font-mono text-xs text-blue-600 truncate">{key}</p>
                  <p className="text-sm font-semibold text-gray-800">{val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-green-200 pt-2">
            <p className="text-xs text-green-600">
              Ausgewerteter Ausdruck:{' '}
              <code className="font-mono">{result.expression}</code>
            </p>
          </div>
        </div>
      )}

      {/* Fehler */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-medium">Fehler bei der Berechnung</p>
          <p className="text-sm text-red-600 mt-1">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Editor-Seite ─────────────────────────────────────────────────────────────

export default function FormulaEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: formula, isLoading, isError } = useFormula(id);
  const { data: activitiesData } = useActivityTypes({ isActive: true, limit: 200 });
  const updateFormula = useUpdateFormula(id);

  // Lokaler Editor-State
  const [name, setName] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [formulaExpression, setFormulaExpression] = useState('');
  const [variables, setVariables] = useState<Record<string, FormulaVariable>>({});
  const [defaultValues, setDefaultValues] = useState<Record<string, number>>({});
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // State aus API-Daten initialisieren
  useEffect(() => {
    if (!formula) return;

    setName(formula.name);
    setActivityTypeId(formula.activityTypeId);
    setFormulaExpression(formula.formula.expression);
    setVariables({ ...formula.variables });
    setDefaultValues({ ...(formula.defaultValues ?? {}) });
    setDescription(formula.description ?? '');
    setIsActive(formula.isActive);
  }, [formula]);

  // Variablen aus dem Ausdruck synchronisieren
  const syncVariablesFromExpression = useCallback(
    (expr: string) => {
      const varNames = Array.from(expr.matchAll(/\{([^}]+)\}/g), (m) => m[1]);
      const uniqueNames = Array.from(new Set(varNames));

      setVariables((prev) => {
        const updated: Record<string, FormulaVariable> = {};
        for (const varName of uniqueNames) {
          updated[varName] = prev[varName] ?? { label: varName, type: 'number' };
        }
        return updated;
      });
    },
    [],
  );

  const handleExpressionChange = useCallback(
    (expr: string) => {
      setFormulaExpression(expr);
      syncVariablesFromExpression(expr);
    },
    [syncVariablesFromExpression],
  );

  const handleVariableChange = useCallback((varName: string, updated: FormulaVariable) => {
    setVariables((prev) => ({ ...prev, [varName]: updated }));
  }, []);

  const handleVariableRemove = useCallback((varName: string) => {
    setVariables((prev) => {
      const next = { ...prev };
      delete next[varName];
      return next;
    });
    setDefaultValues((prev) => {
      const next = { ...prev };
      delete next[varName];
      return next;
    });
  }, []);

  const handleDefaultValueChange = useCallback((varName: string, value: string) => {
    setDefaultValues((prev) => {
      if (value === '' || isNaN(Number(value))) {
        const next = { ...prev };
        delete next[varName];
        return next;
      }
      return { ...prev, [varName]: Number(value) };
    });
  }, []);

  const handleAddVariable = useCallback(() => {
    const name = prompt('Variablenname (ohne geschweifte Klammern):');
    if (!name || !name.trim()) return;
    const varName = name.trim().replace(/\s+/g, '_');
    setVariables((prev) => ({
      ...prev,
      [varName]: { label: varName, type: 'number' },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setIsSaved(false);

    try {
      await updateFormula.mutateAsync({
        name,
        activityTypeId,
        formulaExpression,
        variables,
        defaultValues: Object.keys(defaultValues).length > 0 ? defaultValues : undefined,
        description: description || undefined,
        isActive,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    }
  }, [
    updateFormula,
    name,
    activityTypeId,
    formulaExpression,
    variables,
    defaultValues,
    description,
    isActive,
  ]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Formel wird geladen...
      </div>
    );
  }

  if (isError || !formula) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/formula-designer')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <div className="text-center text-destructive py-16">
          Formel nicht gefunden oder Ladefehler.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/formula-designer')}
            title="Zurück zur Liste"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold tracking-tight">{formula.name}</h1>
              <Badge variant="outline" className="font-mono text-xs">
                v{formula.version}
              </Badge>
              {formula.isActive ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktiv</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Inaktiv</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tätigkeit: {formula.activityType.name} ({formula.activityType.code})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSaved && (
            <span className="text-sm text-green-600 font-medium">Gespeichert</span>
          )}
          {saveError && (
            <span className="text-sm text-destructive max-w-xs truncate">{saveError}</span>
          )}
          <Button
            onClick={() => void handleSave()}
            disabled={updateFormula.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {updateFormula.isPending ? 'Speichert...' : 'Speichern'}
          </Button>
        </div>
      </div>

      {/* Versionierungs-Hinweis */}
      <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Die Version wird automatisch erhöht, wenn Sie den Formel-Ausdruck oder die
          Variablen-Definitionen speichern.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ── Linke Spalte: Formel bearbeiten ─────────────────────────────── */}
        <div className="space-y-6">
          {/* Stammdaten */}
          <div className="rounded-lg border p-4 space-y-4">
            <h2 className="font-semibold text-base">Stammdaten</h2>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-activity">Tätigkeit</Label>
              <Select value={activityTypeId} onValueChange={setActivityTypeId}>
                <SelectTrigger id="edit-activity">
                  <SelectValue />
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
              <Label htmlFor="edit-desc">Beschreibung</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optionale Beschreibung..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="edit-active" className="text-sm">Status</Label>
              <Select
                value={isActive ? 'true' : 'false'}
                onValueChange={(v) => setIsActive(v === 'true')}
              >
                <SelectTrigger id="edit-active" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktiv</SelectItem>
                  <SelectItem value="false">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Formel-Ausdruck */}
          <div className="rounded-lg border p-4 space-y-3">
            <h2 className="font-semibold text-base">Formel-Ausdruck</h2>
            <p className="text-xs text-muted-foreground">
              Variablen in{' '}
              <code className="rounded bg-blue-100 px-1 text-blue-700">{'{'}</code>
              geschweiften Klammern
              <code className="rounded bg-blue-100 px-1 text-blue-700">{'}'}</code>.
              Erlaubte Operatoren: <code className="font-mono">+ - * / ( )</code>
            </p>

            {/* Overlay-Syntax-Highlight */}
            <div className="relative">
              <HighlightedExpression expression={formulaExpression} />
              <textarea
                value={formulaExpression}
                onChange={(e) => handleExpressionChange(e.target.value)}
                className="relative z-10 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm leading-6 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 caret-gray-800"
                spellCheck={false}
                placeholder="({green_area_sqm} / {mow_rate} * 60) + {setup_min}"
              />
            </div>
          </div>

          {/* Variablen-Tabelle */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Variablen</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddVariable}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Variable hinzufügen
              </Button>
            </div>

            {Object.keys(variables).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Variablen. Variablen werden aus dem Formel-Ausdruck automatisch erkannt.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Variable</TableHead>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead className="min-w-44">Quelle</TableHead>
                      <TableHead className="w-32">Standard-Wert</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(variables).map(([varName, varDef]) => (
                      <VariableRow
                        key={varName}
                        name={varName}
                        variable={{
                          ...varDef,
                          default: defaultValues[varName] ?? varDef.default,
                        }}
                        onChange={(updated) => {
                          handleVariableChange(varName, updated);
                          if (updated.default !== undefined) {
                            handleDefaultValueChange(varName, String(updated.default));
                          } else {
                            handleDefaultValueChange(varName, '');
                          }
                        }}
                        onRemove={() => handleVariableRemove(varName)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* ── Rechte Spalte: Live-Vorschau ─────────────────────────────────── */}
        <div className="rounded-lg border p-4 space-y-4 self-start">
          <h2 className="font-semibold text-base">Live-Vorschau</h2>
          <p className="text-xs text-muted-foreground">
            Geben Sie Testwerte ein und berechnen Sie die Dauer. Immobilien-Daten
            werden automatisch befüllt, wenn eine Immobilie ausgewählt ist.
            Manuell eingegebene Werte (Overrides) haben immer Vorrang.
          </p>

          <LivePreview
            formulaId={id}
            variables={variables}
            defaultValues={defaultValues}
          />
        </div>
      </div>
    </div>
  );
}
