import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, ExternalLink, MessageSquare, Plus, Save, Send, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminApi, uploadFile } from '@/lib/api';
import { emptySupplier, formatCost, formatUsd, type Overview, type Supplier } from '@/lib/negotiation';
import { FONTS, HEROES, PALETTES } from '@/negotiation/siteTheme';

interface Props {
  overview: Overview;
  reload: () => Promise<void>;
}

// "a | b" line lists <-> objects
const toPairs = (lines: string) =>
  lines
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('|');
      return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    });
const fromPairs = (rows: [string, string][]) => rows.map(([a, b]) => `${a} | ${b}`).join('\n');

interface Form {
  supplier: Supplier;
  weakSpots: string;
  specs: string;
  terms: string;
  about: string;
  highlights: string;
  stats: string;
  trapOn: boolean;
}

const toForm = (s: Supplier): Form => {
  const c = s.site_content ?? {};
  return {
    supplier: { ...s, trap: s.trap ?? { price: 0, offer_text: '', term_key: 'delivery', term_value: '', breaks: '' } },
    weakSpots: (s.weak_spots ?? []).join('\n'),
    specs: fromPairs((s.proposal_specs ?? []).map((x) => [x.label, x.value])),
    terms: fromPairs(Object.entries(s.offer_terms ?? {})),
    about: (c.about ?? []).join('\n\n'),
    highlights: fromPairs((c.highlights ?? []).map((h) => [h.title, h.text])),
    stats: fromPairs((c.stats ?? []).map((h) => [h.value, h.label])),
    trapOn: !!s.trap,
  };
};

const fromForm = (f: Form) => {
  const s = f.supplier;
  return {
    key: s.key,
    name: s.name,
    region: s.region,
    qualified: s.qualified,
    enabled: s.enabled,
    sort_order: Number(s.sort_order) || 0,
    initial_price: Number(s.initial_price),
    min_price: Number(s.min_price),
    alt_min_price: s.alt_min_price === null || String(s.alt_min_price) === '' ? null : Number(s.alt_min_price),
    alt_min_condition: s.alt_min_condition || null,
    concession_weak_spot_pct: Number(s.concession_weak_spot_pct),
    trap: f.trapOn && s.trap ? { ...s.trap, price: Number(s.trap.price) } : null,
    persona: s.persona,
    weak_spots: f.weakSpots.split('\n').map((l) => l.trim()).filter(Boolean),
    fixed_facts: s.fixed_facts,
    proposal_intro: s.proposal_intro,
    proposal_specs: toPairs(f.specs).map(([label, value]) => ({ label, value })),
    proposal_documents: s.proposal_documents,
    offer_terms: Object.fromEntries(toPairs(f.terms)),
    site_content: {
      ...s.site_content,
      about: f.about.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      highlights: toPairs(f.highlights).map(([title, text]) => ({ title, text })),
      stats: toPairs(f.stats).map(([value, label]) => ({ value, label })),
    },
    materials: s.materials ?? [],
  };
};

interface TestState {
  history: { id: string; role: 'team' | 'supplier'; content: string; price_after: number | null; created_at: string }[];
  conversation: Record<string, unknown> | null;
  cost: number;
}

const SupplierEditor = ({ overview, reload }: Props) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(overview.suppliers[0]?.key ?? null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [test, setTest] = useState<TestState>({ history: [], conversation: null, cost: 0 });
  const [testText, setTestText] = useState('');
  const [testing, setTesting] = useState(false);

  const current = useMemo(() => overview.suppliers.find((s) => s.key === selected) ?? null, [overview.suppliers, selected]);

  useEffect(() => {
    if (isNew) return;
    setForm(current ? toForm(current) : null);
  }, [current, isNew]);

  const set = (patch: Partial<Supplier>) => form && setForm({ ...form, supplier: { ...form.supplier, ...patch } });
  const setSite = (patch: Record<string, unknown>) =>
    form && setForm({ ...form, supplier: { ...form.supplier, site_content: { ...form.supplier.site_content, ...patch } } });
  const setTrap = (patch: Record<string, unknown>) =>
    form && form.supplier.trap && setForm({ ...form, supplier: { ...form.supplier, trap: { ...form.supplier.trap, ...patch } as Supplier['trap'] } });

  const startNew = () => {
    setIsNew(true);
    setSelected(null);
    setForm(toForm(emptySupplier()));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { supplier } = await adminApi<{ supplier: Supplier }>('negotiation-supplier-save', { values: fromForm(form) });
      await reload();
      setIsNew(false);
      setSelected(supplier.key);
      toast({ title: 'Supplier saved', description: supplier.name });
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!current || !window.confirm(`Delete ${current.name}? All team chats and deals with this supplier are deleted too.`)) return;
    try {
      await adminApi('negotiation-supplier-delete', { key: current.key });
      await reload();
      setSelected(overview.suppliers.find((s) => s.key !== current.key)?.key ?? null);
      toast({ title: 'Supplier deleted' });
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const uploadMaterial = async (file: File | undefined) => {
    if (!file || !form) return;
    if (isNew) {
      toast({ title: 'Save the supplier first', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile('negotiation-materials', file, ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'], 10 * 1024 * 1024, (ext) =>
        adminApi<{ path: string; token: string; publicUrl: string }>('negotiation-material-upload-url', { supplier_key: form.supplier.key, ext }),
      );
      const label = file.name.replace(/\.[^.]+$/, '');
      set({ materials: [...(form.supplier.materials ?? []), { label, url }] });
      toast({ title: 'File uploaded', description: 'Remember to save the supplier.' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const showPrompt = async () => {
    if (!current) return;
    try {
      const { system } = await adminApi<{ system: string }>('negotiation-prompt-preview', { supplier_key: current.key });
      setPreview(system);
    } catch (err) {
      toast({ title: 'Failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const sendTest = async () => {
    if (!current || !testText.trim()) return;
    setTesting(true);
    const text = testText.trim();
    try {
      const res = await adminApi<{ reply: string; conversation: Record<string, unknown>; meta: Record<string, unknown> }>('negotiation-test-chat', {
        supplier_key: current.key,
        text,
        history: test.history,
        conversation: test.conversation,
      });
      const now = new Date().toISOString();
      setTest({
        history: [
          ...test.history,
          { id: `t${test.history.length}`, role: 'team', content: text, price_after: null, created_at: now },
          { id: `s${test.history.length}`, role: 'supplier', content: res.reply, price_after: Number(res.conversation.current_price), created_at: now },
        ],
        conversation: res.conversation,
        cost: test.cost + (typeof res.meta.cost_usd === 'number' ? res.meta.cost_usd : 0),
      });
      setTestText('');
    } catch (err) {
      toast({ title: 'Test failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const s = form?.supplier;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <Card className="bg-card border-border p-3 h-fit space-y-1">
        {overview.suppliers.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => {
              setIsNew(false);
              setSelected(x.key);
              setTest({ history: [], conversation: null, cost: 0 });
            }}
            className={`w-full rounded px-3 py-2 text-left text-sm ${x.key === selected && !isNew ? 'bg-primary/20 text-primary' : 'hover:bg-muted'}`}
          >
            <div className="font-semibold">
              {x.key} – {x.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatUsd(x.initial_price)} → {formatUsd(x.min_price)}
              {!x.qualified && ' · disq.'}
              {x.trap && ' · trap'}
              {!x.enabled && ' · hidden'}
            </div>
          </button>
        ))}
        <Button variant="outline" size="sm" className="w-full mt-2" onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" /> New supplier
        </Button>
      </Card>

      {form && s && (
        <div className="space-y-6">
          <Card className="bg-card border-border p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl text-primary">{isNew ? 'New supplier' : `${s.key} – ${s.name}`}</h3>
              <div className="flex flex-wrap gap-2">
                {!isNew && (
                  <>
                    <Button variant="outline" size="sm" onClick={showPrompt}>
                      <Eye className="mr-2 h-4 w-4" /> Prompt
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                      <MessageSquare className="mr-2 h-4 w-4" /> Test chat
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/negotiation`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> Portal
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Key</Label>
                <Input className="bg-background" value={s.key} disabled={!isNew} onChange={(e) => set({ key: e.target.value.toUpperCase() })} placeholder="G" />
              </div>
              <div className="md:col-span-2">
                <Label>Company name</Label>
                <Input className="bg-background" value={s.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div>
                <Label>Order</Label>
                <Input type="number" className="bg-background" value={s.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Label>Region</Label>
                <Input className="bg-background" value={s.region} onChange={(e) => set({ region: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={s.qualified} onCheckedChange={(v) => set({ qualified: v })} id="q" />
                <Label htmlFor="q">Passes qualification</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={s.enabled} onCheckedChange={(v) => set({ enabled: v })} id="en" />
                <Label htmlFor="en">Visible to teams</Label>
              </div>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 space-y-4">
            <h4 className="font-display text-lg text-primary">Price rules (enforced by the server)</h4>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Initial price USD/t</Label>
                <Input type="number" className="bg-background" value={s.initial_price} onChange={(e) => set({ initial_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Minimum USD/t</Label>
                <Input type="number" className="bg-background" value={s.min_price} onChange={(e) => set({ min_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Weak-spot concession %</Label>
                <Input
                  type="number"
                  step="0.5"
                  className="bg-background"
                  value={s.concession_weak_spot_pct}
                  onChange={(e) => set({ concession_weak_spot_pct: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Alt. minimum (optional)</Label>
                <Input
                  type="number"
                  className="bg-background"
                  value={s.alt_min_price ?? ''}
                  onChange={(e) => set({ alt_min_price: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="e.g. 2800"
                />
              </div>
              <div className="md:col-span-4">
                <Label>Alt. minimum applies when (shown to the model)</Label>
                <Input
                  className="bg-background"
                  value={s.alt_min_condition ?? ''}
                  onChange={(e) => set({ alt_min_condition: e.target.value })}
                  placeholder="the team drops the replacement guarantee"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              General discount request ≤ 1 %, competing offer ≤ 2 %, weak spot / something in return ≤ the % above; pressure and probing 0 %. Steps shrink near the minimum.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <Switch checked={form.trapOn} onCheckedChange={(v) => setForm({ ...form, trapOn: v })} id="trap" />
              <Label htmlFor="trap">This supplier has a trap offer</Label>
            </div>
            {form.trapOn && s.trap && (
              <div className="grid gap-4 md:grid-cols-4 rounded border border-accent/40 p-4">
                <div>
                  <Label>Trap price USD/t</Label>
                  <Input type="number" className="bg-background" value={s.trap.price} onChange={(e) => setTrap({ price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Changes offer term</Label>
                  <Input className="bg-background" value={s.trap.term_key} onChange={(e) => setTrap({ term_key: e.target.value })} placeholder="delivery" />
                </div>
                <div className="md:col-span-2">
                  <Label>New value of that term</Label>
                  <Input className="bg-background" value={s.trap.term_value} onChange={(e) => setTrap({ term_value: e.target.value })} placeholder="4 weeks after signature" />
                </div>
                <div className="md:col-span-4">
                  <Label>How the supplier offers it ({'{{TRAP_PRICE}}'} = trap price)</Label>
                  <Textarea className="bg-background" value={s.trap.offer_text} onChange={(e) => setTrap({ offer_text: e.target.value })} />
                </div>
                <div className="md:col-span-4">
                  <Label>Requirement it breaks (leaders only, never shown to teams)</Label>
                  <Input className="bg-background" value={s.trap.breaks} onChange={(e) => setTrap({ breaks: e.target.value })} />
                </div>
              </div>
            )}
          </Card>

          <Card className="bg-card border-border p-6 space-y-4">
            <h4 className="font-display text-lg text-primary">Chatbot prompt</h4>
            <div>
              <Label>Persona (personality, what it defends, what it responds to, trap behaviour)</Label>
              <Textarea className="bg-background min-h-[180px]" value={s.persona} onChange={(e) => set({ persona: e.target.value })} />
            </div>
            <div>
              <Label>Weak spots the team can argue with (one per line)</Label>
              <Textarea className="bg-background min-h-[110px]" value={form.weakSpots} onChange={(e) => setForm({ ...form, weakSpots: e.target.value })} />
            </div>
            <div>
              <Label>Fixed facts that never change (disqualified suppliers)</Label>
              <Textarea className="bg-background" value={s.fixed_facts} onChange={(e) => set({ fixed_facts: e.target.value })} />
            </div>
          </Card>

          <Card className="bg-card border-border p-6 space-y-4">
            <h4 className="font-display text-lg text-primary">Proposal & materials (the only facts the chatbot may state; shown on the website)</h4>
            <div>
              <Label>Company introduction</Label>
              <Textarea className="bg-background min-h-[90px]" value={s.proposal_intro} onChange={(e) => set({ proposal_intro: e.target.value })} />
            </div>
            <div>
              <Label>Response to requirements (one per line: Label | value)</Label>
              <Textarea className="bg-background font-mono text-xs min-h-[260px]" value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} />
            </div>
            <div>
              <Label>Attached documents (text)</Label>
              <Textarea className="bg-background" value={s.proposal_documents} onChange={(e) => set({ proposal_documents: e.target.value })} />
            </div>
            <div>
              <Label>Offer terms shown in every offer summary (one per line: key | value; keys quantity, delivery, payment, guarantee)</Label>
              <Textarea className="bg-background font-mono text-xs min-h-[100px]" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Downloadable materials (PDF or images, max 10 MB)</Label>
              {(s.materials ?? []).map((m, i) => (
                <div key={m.url} className="flex items-center gap-2">
                  <Input
                    className="bg-background"
                    value={m.label}
                    onChange={(e) => set({ materials: s.materials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                  />
                  <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline whitespace-nowrap">
                    open
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => set({ materials: s.materials.filter((_, j) => j !== i) })} aria-label="Remove file">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload file'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploading}
                  onChange={(e) => {
                    uploadMaterial(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 space-y-4">
            <h4 className="font-display text-lg text-primary">Website</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>Tagline</Label>
                <Input className="bg-background" value={String(s.site_content.tagline ?? '')} onChange={(e) => setSite({ tagline: e.target.value })} />
              </div>
              <div>
                <Label>Established</Label>
                <Input className="bg-background" value={String(s.site_content.since ?? '')} onChange={(e) => setSite({ since: e.target.value })} />
              </div>
              {(['city', 'email', 'phone'] as const).map((k) => (
                <div key={k}>
                  <Label className="capitalize">{k}</Label>
                  <Input
                    className="bg-background"
                    value={String(s.site_content.contact?.[k] ?? '')}
                    onChange={(e) => setSite({ contact: { ...(s.site_content.contact ?? {}), [k]: e.target.value } })}
                  />
                </div>
              ))}
              {(
                [
                  ['palette', PALETTES.map((p) => p.id)],
                  ['font', FONTS.map((f) => f.id)],
                  ['hero', [...HEROES]],
                ] as const
              ).map(([k, options]) => (
                <div key={k}>
                  <Label className="capitalize">{k}</Label>
                  <Select
                    value={String(s.site_content.theme?.[k] ?? 'auto')}
                    onValueChange={(v) => setSite({ theme: { ...(s.site_content.theme ?? {}), [k]: v === 'auto' ? undefined : v } })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">auto (generated)</SelectItem>
                      {options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div>
              <Label>About us (paragraphs separated by an empty line)</Label>
              <Textarea className="bg-background min-h-[120px]" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Highlights (Title | text)</Label>
                <Textarea className="bg-background font-mono text-xs min-h-[100px]" value={form.highlights} onChange={(e) => setForm({ ...form, highlights: e.target.value })} />
              </div>
              <div>
                <Label>Stats (value | label)</Label>
                <Textarea className="bg-background font-mono text-xs min-h-[100px]" value={form.stats} onChange={(e) => setForm({ ...form, stats: e.target.value })} />
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
              <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save supplier'}
            </Button>
            {!isNew && (
              <Button variant="outline" onClick={remove} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>System prompt sent to the model</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-xs font-mono">{preview}</pre>
          <p className="text-xs text-muted-foreground">Each turn also gets a state block (current price, allowed concession, messages left, trap allowed) built by the server.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Test chat · {current?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Uses the saved prompt and the active model ({overview.settings.llm_provider} / {overview.settings.llm_model}). Nothing is stored. Spent: {formatCost(test.cost)}
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto min-h-[200px]">
            {test.history.map((m) => (
              <div key={m.id} className={m.role === 'team' ? 'ml-8 rounded bg-primary/15 p-2 text-sm' : 'mr-8 rounded bg-muted p-2 text-sm whitespace-pre-wrap'}>
                {m.content}
              </div>
            ))}
            {testing && <div className="mr-8 rounded bg-muted p-2 text-sm text-muted-foreground">…</div>}
          </div>
          <div className="flex gap-2">
            <Input
              className="bg-background"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendTest()}
              placeholder="Write as a team…"
              disabled={testing}
            />
            <Button onClick={sendTest} disabled={testing || !testText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setTest({ history: [], conversation: null, cost: 0 })}>
              Reset
            </Button>
          </div>
          {test.conversation && (
            <div className="text-xs text-muted-foreground font-mono">
              price {String(test.conversation.current_price)} · used {String(test.conversation.messages_used)} · trap {String(test.conversation.trap_on_table)}
              {current && <Badge className="ml-2">min {formatUsd(current.min_price)}</Badge>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierEditor;
