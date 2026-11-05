import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, FileJson, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { useToast } from '@/hooks/use-toast';
import { adminApi, ApiError } from '@/lib/api';
import { diffImport, ENTITIES, exportWorkshop, parseWorkshopFile, type EntityKey, type ImportPayload } from '@/lib/workshopTransfer';

interface TableReport {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  changes: { label: string; fields: string[] }[];
  createdLabels: string[];
  deletedLabels: string[];
}

interface ImportResult {
  status: 'success' | 'warning' | 'failed';
  message?: string;
  summary: Record<string, TableReport>;
  verification?: { checked: number; problems: string[] };
  durationMs?: number;
}

const sheetName = (key: string) => ENTITIES.find((e) => e.key === key)?.sheet ?? key;

const ChangeList = ({ items }: { items: { label: string; fields: string[] }[] }) =>
  items.length ? (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground max-h-32 overflow-y-auto">
      {items.map((c, i) => (
        <li key={i}>
          <span className="text-foreground">{c.label}</span>: {c.fields.join(', ')}
        </li>
      ))}
    </ul>
  ) : null;

/** Export / import of all admin-editable content (teams, phases, tools, page content) as one file. */
const WorkshopTransfer = () => {
  const { teams, phases, tools, sections, recalculateRankings: reload } = useWorkshop();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ImportPayload | null>(null);
  const [fileName, setFileName] = useState('');
  const [deleteMissing, setDeleteMissing] = useState<Partial<Record<EntityKey, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const diff = pending ? diffImport(pending, { teams, phases, tools, sections }) : {};
  const preview = ENTITIES.filter((e) => diff[e.key]).map((e) => ({ entity: e, ...diff[e.key]! }));
  const hasUnknown = preview.some((p) => p.unknown.length > 0);
  const totalChanges = preview.reduce(
    (n, p) => n + p.changed.length + p.created.length + (deleteMissing[p.entity.key] ? p.missing.length : 0),
    0,
  );

  const handleExport = async (format: 'xlsx' | 'json') => {
    try {
      await exportWorkshop({ teams, phases, tools, sections }, format);
    } catch (error) {
      toast({ title: 'Export failed', description: String(error), variant: 'destructive' });
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPending(await parseWorkshopFile(file));
      setFileName(file.name);
      setDeleteMissing({});
    } catch (error) {
      setResult({
        status: 'failed',
        message: `"${file.name}" was not imported - fix these problems and try again:\n\n${error instanceof Error ? error.message : String(error)}`,
        summary: {},
      });
    }
  };

  const handleImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await adminApi<Omit<ImportResult, 'status'>>('import-all', { ...pending, deleteMissing });
      setResult({ ...res, status: res.verification?.problems.length ? 'warning' : 'success' });
      setPending(null);
    } catch (error) {
      const body = error instanceof ApiError ? error.body : undefined;
      setResult({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        summary: (body?.summary as Record<string, TableReport>) ?? {},
      });
      setPending(null);
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const resultTables = result ? ENTITIES.filter((e) => result.summary[e.key]) : [];
  const anythingSaved = resultTables.some((e) => {
    const r = result!.summary[e.key];
    return r.created + r.updated + r.deleted > 0;
  });

  return (
    <>
      <Button variant="outline" onClick={() => handleExport('xlsx')} className="border-primary text-primary">
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      <Button variant="outline" onClick={() => handleExport('json')} className="border-primary text-primary">
        <FileJson className="mr-2 h-4 w-4" />
        Export JSON
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()} className="border-accent text-accent">
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFile}
        aria-label="Import file"
      />

      {/* Step 1: preview of what the file changes */}
      <Dialog open={!!pending} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
            <DialogDescription>
              {fileName} - compared with the current data. Nothing is saved until you click Import. Running phase state and timers are kept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {preview.map(({ entity, changed, unchanged, created, unknown, missing }) => (
              <div key={entity.key} className="border border-border rounded p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-display text-primary">{entity.sheet}</span>
                  <span className="text-xs text-muted-foreground">
                    {changed.length} changed · {created.length} new · {unchanged} unchanged
                  </span>
                </div>
                <ChangeList items={changed} />
                {created.length > 0 && <div className="mt-1 text-xs">➕ New: {created.join(', ')}</div>}
                {unknown.length > 0 && (
                  <div className="mt-1 text-xs text-destructive">
                    ⚠️ Unknown id(s): {unknown.join(', ')}
                    {entity.canCreate ? ' - clear the id to create them as new' : ''}
                  </div>
                )}
                {missing.length > 0 &&
                  (entity.canDelete ? (
                    <div className="mt-2 flex items-start space-x-2">
                      <Checkbox
                        id={`delete-${entity.key}`}
                        checked={!!deleteMissing[entity.key]}
                        onCheckedChange={(v) => setDeleteMissing((prev) => ({ ...prev, [entity.key]: v === true }))}
                      />
                      <Label htmlFor={`delete-${entity.key}`} className="text-xs leading-snug">
                        Delete {missing.length} not in file: {missing.map((m) => m.label).join(', ')}
                      </Label>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">{missing.length} not in file - left unchanged</div>
                  ))}
              </div>
            ))}
          </div>

          <DialogFooter className="items-center gap-2">
            {totalChanges === 0 && !hasUnknown && <span className="text-xs text-muted-foreground mr-auto">No differences found</span>}
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={busy || hasUnknown || totalChanges === 0}>
              {busy ? 'Importing...' : `Import ${totalChanges} change${totalChanges === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: result + health check */}
      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {result?.status === 'warning' && <AlertTriangle className="h-5 w-5 text-accent" />}
              {result?.status === 'failed' && <XCircle className="h-5 w-5 text-destructive" />}
              {result?.status === 'success' && 'Import successful'}
              {result?.status === 'warning' && 'Imported - with warnings'}
              {result?.status === 'failed' && (anythingSaved ? 'Import partly failed' : 'Import failed')}
            </DialogTitle>
            <DialogDescription>
              {result?.status === 'failed'
                ? anythingSaved
                  ? 'Some changes were saved before the error (listed below). Fix the problem and import the file again - already saved rows will show as unchanged.'
                  : 'Nothing was saved.'
                : `Saved in ${((result?.durationMs ?? 0) / 1000).toFixed(1)} s.`}
            </DialogDescription>
          </DialogHeader>

          {result?.message && (
            <pre className="whitespace-pre-wrap text-xs text-destructive bg-destructive/10 rounded p-3 max-h-60 overflow-y-auto">{result.message}</pre>
          )}

          {resultTables.length > 0 && (
            <div className="space-y-3">
              {resultTables.map((e) => {
                const r = result!.summary[e.key];
                return (
                  <div key={e.key} className="border border-border rounded p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-primary">{sheetName(e.key)}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.updated} updated · {r.created} created · {r.deleted} deleted · {r.unchanged} unchanged
                      </span>
                    </div>
                    <ChangeList items={r.changes} />
                    {r.createdLabels.length > 0 && <div className="mt-1 text-xs">➕ {r.createdLabels.join(', ')}</div>}
                    {r.deletedLabels.length > 0 && <div className="mt-1 text-xs">🗑 {r.deletedLabels.join(', ')}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {result?.verification && (
            <div
              className={`rounded p-3 text-sm ${
                result.verification.problems.length ? 'bg-accent/10 text-accent' : 'bg-green-500/10 text-green-500'
              }`}
            >
              {result.verification.problems.length ? (
                <>
                  <div className="font-bold">Health check: {result.verification.problems.length} problem(s)</div>
                  <ul className="mt-1 list-disc list-inside text-xs">
                    {result.verification.problems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  ✔ Health check passed - {result.verification.checked} saved row(s) read back from the database and verified.
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkshopTransfer;
