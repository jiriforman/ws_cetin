import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, ExternalLink, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/api';
import { explainApiError, formatCost, formatUsd, orderedTerms, type AdminConversation, type Overview, type TranscriptMessage } from '@/lib/negotiation';

interface Props {
  overview: Overview;
  reload: () => Promise<void>;
}

const verdict = (overview: Overview, supplierKey: string, isTrap: boolean, isValid: boolean) => {
  const s = overview.suppliers.find((x) => x.key === supplierKey);
  if (isTrap) return { label: 'TRAP', className: 'bg-destructive text-destructive-foreground' };
  if (!s?.qualified) return { label: 'DISQUALIFIED', className: 'bg-destructive/80 text-destructive-foreground' };
  return isValid ? { label: 'VALID', className: 'bg-green-600 text-white' } : { label: 'INVALID', className: 'bg-destructive text-destructive-foreground' };
};

const NegotiationResults = ({ overview, reload }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [transcript, setTranscript] = useState<{ conv: AdminConversation; messages: TranscriptMessage[] } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetClose, setResetClose] = useState(true);
  const [resetting, setResetting] = useState(false);

  const resetAll = async () => {
    setResetting(true);
    try {
      const res = await adminApi<{ deleted: { conversations: number; deals: number } }>('negotiation-reset-all', { confirm: resetText, close_room: resetClose });
      setResetOpen(false);
      setResetText('');
      setTranscript(null);
      await reload();
      toast({ title: 'Negotiation room reset', description: `${res.deleted.conversations} chats and ${res.deleted.deals} deals deleted.` });
    } catch (err) {
      toast({ title: 'Reset failed', description: explainApiError(err instanceof Error ? err.message : String(err)), variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };
  const suppliers = overview.suppliers;
  const teams = overview.teams.filter((t) => t.status !== 'disabled');
  const name = (key: string) => suppliers.find((s) => s.key === key)?.name ?? key;

  const setOpen = async (is_open: boolean) => {
    setSaving(true);
    try {
      await adminApi('negotiation-settings', { values: { is_open } });
      await reload();
      toast({ title: is_open ? 'Negotiation room opened' : 'Negotiation room closed' });
    } catch (err) {
      toast({ title: 'Failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openTranscript = async (conv: AdminConversation) => {
    try {
      const { messages } = await adminApi<{ messages: TranscriptMessage[] }>('negotiation-transcript', { conversation_id: conv.id });
      setTranscript({ conv, messages });
    } catch (err) {
      toast({ title: 'Failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const reset = async (teamId: string, supplierKey?: string) => {
    const teamName = teams.find((t) => t.id === teamId)?.name ?? teamId;
    const what = supplierKey ? `the chat with ${name(supplierKey)}` : 'ALL chats and the accepted deal';
    if (!window.confirm(`Reset ${what} for ${teamName}? This cannot be undone.`)) return;
    try {
      await adminApi('negotiation-reset', { team_id: teamId, supplier_key: supplierKey });
      setTranscript(null);
      await reload();
      toast({ title: 'Reset done' });
    } catch (err) {
      toast({ title: 'Failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const exportExcel = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const deals = wb.addWorksheet('Deals');
    deals.columns = [
      { header: 'Team', key: 'team', width: 24 },
      { header: 'Supplier', key: 'supplier', width: 28 },
      { header: 'Price USD/t', key: 'price', width: 12 },
      { header: 'Total USD (20 t)', key: 'total', width: 16 },
      { header: 'Verdict', key: 'verdict', width: 14 },
      { header: 'Conditions', key: 'conditions', width: 80 },
      { header: 'Accepted at', key: 'at', width: 22 },
    ];
    for (const t of teams) {
      const d = overview.deals.find((x) => x.team_id === t.id);
      deals.addRow({
        team: t.name,
        supplier: d ? name(d.supplier_key) : '',
        price: d?.price ?? '',
        total: d ? d.price * 20 : '',
        verdict: d ? verdict(overview, d.supplier_key, d.is_trap, d.is_valid).label : 'no deal',
        conditions: d ? Object.entries(d.conditions).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${k}: ${v}`).join('; ') : '',
        at: d?.accepted_at ?? '',
      });
    }
    const chats = wb.addWorksheet('Conversations');
    chats.columns = [
      { header: 'Team', key: 'team', width: 24 },
      { header: 'Supplier', key: 'supplier', width: 28 },
      { header: 'Messages used', key: 'used', width: 14 },
      { header: 'Current price', key: 'price', width: 14 },
      { header: 'Final price reached', key: 'final', width: 18 },
      { header: 'Trap offered', key: 'trap', width: 12 },
      { header: 'Guarantee dropped', key: 'guarantee', width: 18 },
    ];
    for (const c of overview.conversations) {
      chats.addRow({
        team: teams.find((t) => t.id === c.team_id)?.name ?? c.team_id,
        supplier: name(c.supplier_key),
        used: c.messages_used,
        price: c.offer?.price ?? c.current_price,
        final: c.final_price_reached ? 'yes' : '',
        trap: c.trap_offered ? 'yes' : '',
        guarantee: c.guarantee_dropped ? 'yes' : '',
      });
    }
    const transcripts = wb.addWorksheet('Transcripts');
    transcripts.columns = [
      { header: 'Team', key: 'team', width: 22 },
      { header: 'Supplier', key: 'supplier', width: 26 },
      { header: 'Time', key: 'time', width: 22 },
      { header: 'Who', key: 'who', width: 10 },
      { header: 'Message', key: 'message', width: 100 },
      { header: 'Classified as', key: 'cls', width: 18 },
      { header: 'Concession %', key: 'pct', width: 13 },
    ];
    for (const c of overview.conversations) {
      const { messages } = await adminApi<{ messages: TranscriptMessage[] }>('negotiation-transcript', { conversation_id: c.id });
      for (const m of messages) {
        transcripts.addRow({
          team: teams.find((t) => t.id === c.team_id)?.name ?? c.team_id,
          supplier: name(c.supplier_key),
          time: m.created_at,
          who: m.role,
          message: m.content,
          cls: (m.meta?.classification as string) ?? '',
          pct: (m.meta?.applied_pct as number) ?? '',
        });
      }
    }
    for (const ws of [deals, chats, transcripts]) ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `negotiation-results-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const total = overview.cost.total;

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch id="neg-open" checked={overview.settings.is_open} onCheckedChange={setOpen} disabled={saving} />
            <Label htmlFor="neg-open" className="text-base">
              Negotiation room {overview.settings.is_open ? <span className="text-green-500">OPEN</span> : <span className="text-muted-foreground">CLOSED</span>}
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/negotiation" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Portal
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} className="border-destructive text-destructive hover:bg-destructive/10">
              <Trash2 className="mr-2 h-4 w-4" /> Reset all
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">Model</div>
            <div className="font-mono">
              {overview.settings.llm_provider} / {overview.settings.llm_model}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">LLM calls (all time)</div>
            <div className="font-mono">{total.calls}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Tokens in / out (all time)</div>
            <div className="font-mono">
              {total.input_tokens + total.cache_read_tokens + total.cache_write_tokens} / {total.output_tokens}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total cost (all time)</div>
            <div className="font-mono text-lg text-accent">{formatCost(total.cost_usd)}</div>
            <div className="text-xs text-muted-foreground">
              {overview.cost.persistent === false ? 'Current chats only until the cost-log migration is applied' : 'Kept when resetting; includes test chats'}
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-6 overflow-x-auto">
        <h3 className="font-display text-xl text-primary mb-4">Results by team</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 pr-4">Team</th>
              {suppliers.map((s) => (
                <th key={s.key} className="py-2 pr-4 whitespace-nowrap" title={s.name}>
                  {s.key}
                  {!s.qualified && <span className="ml-1 text-destructive">✗</span>}
                  {s.trap && <span className="ml-1 text-accent">⚑</span>}
                </th>
              ))}
              <th className="py-2 pr-4">Deal</th>
              <th className="py-2" title="AI cost of the team's current chats; resets with the chats">Cost (since reset)</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const deal = overview.deals.find((d) => d.team_id === t.id);
              const v = deal ? verdict(overview, deal.supplier_key, deal.is_trap, deal.is_valid) : null;
              return (
                <tr key={t.id} className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4 font-semibold whitespace-nowrap">{t.name}</td>
                  {suppliers.map((s) => {
                    const c = overview.conversations.find((x) => x.team_id === t.id && x.supplier_key === s.key);
                    if (!c) return <td key={s.key} className="py-2 pr-4 text-muted-foreground">–</td>;
                    return (
                      <td key={s.key} className="py-2 pr-4 whitespace-nowrap">
                        <button type="button" className="text-left hover:underline" onClick={() => openTranscript(c)}>
                          <div className="font-mono">{formatUsd(c.offer?.price ?? c.current_price)}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.messages_used}/{overview.settings.max_messages}
                            {c.final_price_reached && ' · min'}
                            {c.trap_offered && ' · trap'}
                            {c.guarantee_dropped && ' · no guar.'}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {deal && v ? (
                      <div>
                        <div>
                          {deal.supplier_key} · <span className="font-mono">{formatUsd(deal.price)}</span>
                        </div>
                        <Badge className={v.className}>{v.label}</Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">no deal</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">{formatCost(overview.cost.by_team[t.id]?.cost_usd ?? 0)}</td>
                  <td className="py-2">
                    <Button variant="ghost" size="sm" onClick={() => reset(t.id)} title="Reset this team: all its chats and its deal" aria-label="Reset this team">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          ✗ disqualified supplier · ⚑ supplier with a trap · min = reached its minimum. Click a cell to read the chat. Best valid price per the spec: 2 550 USD/t (E).
        </p>
      </Card>

      {Object.keys(overview.cost.by_model).length > 0 && (
        <Card className="bg-card border-border p-6">
          <h3 className="font-display text-xl text-primary mb-3">Cost by model (all time)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2">Provider / model</th>
                <th className="py-2">Calls</th>
                <th className="py-2">Input tokens</th>
                <th className="py-2">Cache read</th>
                <th className="py-2">Output tokens</th>
                <th className="py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(overview.cost.by_model).map(([model, r]) => (
                <tr key={model} className="border-b border-border/50 font-mono">
                  <td className="py-2">{model}</td>
                  <td className="py-2">{r.calls}</td>
                  <td className="py-2">{r.input_tokens + r.cache_write_tokens}</td>
                  <td className="py-2">{r.cache_read_tokens}</td>
                  <td className="py-2">{r.output_tokens}</td>
                  <td className="py-2">{formatCost(r.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">All AI calls since the cost log started, including admin test chats; not affected by any reset. Costs use list prices per million tokens; n/a for models without a known price (e.g. Lovable gateway, billed in Lovable credits).</p>
        </Card>
      )}

      <Dialog
        open={resetOpen}
        onOpenChange={(o) => {
          setResetOpen(o);
          if (!o) setResetText('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset the whole negotiation room?</DialogTitle>
            <DialogDescription>
              Deletes all {overview.conversations.length} chats with their messages, all {overview.deals.length} accepted deals and the per-team costs. The total cost (all time) is kept.
              Suppliers, prompts and settings are kept. This cannot be undone. Export to Excel first if you need the results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="reset-close" checked={resetClose} onCheckedChange={(v) => setResetClose(v === true)} />
              <Label htmlFor="reset-close">Also close the room</Label>
            </div>
            <div>
              <Label htmlFor="reset-confirm">Type RESET to confirm</Label>
              <Input id="reset-confirm" className="bg-background font-mono" value={resetText} onChange={(e) => setResetText(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={resetAll} disabled={resetText !== 'RESET' || resetting}>
                <Trash2 className="mr-2 h-4 w-4" /> {resetting ? 'Resetting…' : 'Reset everything'}
              </Button>
              <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transcript} onOpenChange={(o) => !o && setTranscript(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {transcript && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {teams.find((t) => t.id === transcript.conv.team_id)?.name} ↔ {name(transcript.conv.supplier_key)}
                </DialogTitle>
                <DialogDescription>
                  {transcript.conv.messages_used}/{overview.settings.max_messages} messages · current offer{' '}
                  {formatUsd(transcript.conv.offer?.price ?? transcript.conv.current_price)} USD/t
                  {transcript.conv.offer && ` · ${orderedTerms(transcript.conv.offer.terms).map(([, v]) => v).join(' · ')}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {transcript.messages.map((m) => (
                  <div key={m.id} className={m.role === 'team' ? 'ml-8 rounded bg-primary/15 p-3' : 'mr-8 rounded bg-muted p-3'}>
                    <div className="mb-1 text-xs text-muted-foreground">
                      {m.role === 'team' ? 'Team' : 'Supplier'} · {new Date(m.created_at).toLocaleTimeString()}
                      {m.meta && (
                        <>
                          {' '}
                          · {String(m.meta.classification)} · {String(m.meta.applied_pct)} % (asked {String(m.meta.requested_pct)} %)
                          {m.meta.trap_offered_now ? ' · TRAP OFFERED' : ''}
                          {m.meta.refused ? ' · model refused' : ''} · {formatCost((m.meta.cost_usd as number | null) ?? null)}
                        </>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                  </div>
                ))}
                {transcript.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
              </div>
              <Button variant="outline" onClick={() => reset(transcript.conv.team_id, transcript.conv.supplier_key)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset this chat
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NegotiationResults;
