import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/api';
import {
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_MAX_MESSAGES,
  LOVABLE_MODEL_HINT,
  MAX_MESSAGES_LIMIT,
  estimateWorkshopCost,
  formatCost,
  isAllowedAnthropicModel,
  type Overview,
  type Settings,
} from '@/lib/negotiation';

interface Props {
  overview: Overview;
  reload: () => Promise<void>;
}

const NegotiationSettings = ({ overview, reload }: Props) => {
  const { toast } = useToast();
  // An Anthropic model outside the allowed list (e.g. from an older setting) is shown as Haiku
  const normalise = (s: Settings): Settings =>
    s.llm_provider === 'anthropic' && !isAllowedAnthropicModel(s.llm_model) ? { ...s, llm_model: DEFAULT_ANTHROPIC_MODEL } : s;
  const [draft, setDraft] = useState<Settings>(normalise(overview.settings));
  const [saving, setSaving] = useState(false);
  const modelNotAllowed = overview.settings.llm_provider === 'anthropic' && !isAllowedAnthropicModel(overview.settings.llm_model);

  useEffect(() => setDraft(normalise(overview.settings)), [overview.settings]);

  const teams = overview.teams.filter((t) => t.status !== 'disabled').length || 10;
  const suppliers = overview.suppliers.filter((s) => s.enabled).length || 6;
  const keyPresent = draft.llm_provider === 'anthropic' ? overview.providers.anthropic : overview.providers.lovable;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi('negotiation-settings', {
        values: {
          llm_provider: draft.llm_provider,
          llm_model: draft.llm_model.trim(),
          max_messages: Number(draft.max_messages),
          rules_prompt: draft.rules_prompt,
        },
      });
      await reload();
      toast({ title: 'Settings saved', description: `${draft.llm_provider} / ${draft.llm_model}` });
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border p-6 space-y-5">
        <h3 className="font-display text-xl text-primary">AI provider & model</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Provider</Label>
            <Select
              value={draft.llm_provider}
              onValueChange={(v) =>
                setDraft({ ...draft, llm_provider: v as Settings['llm_provider'], llm_model: v === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : 'google/gemini-3.7-flash' })
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic API</SelectItem>
                <SelectItem value="lovable">Lovable AI gateway</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs">
              Secret {draft.llm_provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'LOVABLE_API_KEY'}:{' '}
              {keyPresent ? <Badge className="bg-green-600 text-white">set</Badge> : <Badge variant="destructive">missing</Badge>}
            </p>
          </div>
          <div>
            <Label>Model</Label>
            {draft.llm_provider === 'anthropic' ? (
              <Select value={draft.llm_model} onValueChange={(v) => setDraft({ ...draft, llm_model: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANTHROPIC_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} · ${m.input}/${m.output} per M tokens
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input className="bg-background" value={draft.llm_model} onChange={(e) => setDraft({ ...draft, llm_model: e.target.value })} placeholder={LOVABLE_MODEL_HINT} />
            )}
          </div>
          <div>
            <Label>Messages per supplier (1–{MAX_MESSAGES_LIMIT}, default {DEFAULT_MAX_MESSAGES})</Label>
            <Input
              type="number"
              min={1}
              max={MAX_MESSAGES_LIMIT}
              className="bg-background"
              value={draft.max_messages}
              onChange={(e) => setDraft({ ...draft, max_messages: Number(e.target.value) })}
            />
          </div>
        </div>

        {modelNotAllowed && (
          <p className="text-sm text-accent">
            The saved model ({overview.settings.llm_model}) is not allowed any more; replies use Claude Haiku 5.5. Click Save settings to store the change.
          </p>
        )}

        {draft.llm_provider === 'anthropic' && (
          <div>
            <div className="mb-2 text-sm text-muted-foreground">
              Estimated cost of one workshop, worst case ({teams} teams × {suppliers} suppliers × {draft.max_messages} messages, ≈3k input + 0.3k output tokens per reply, before caching):
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-1">Model</th>
                  <th className="py-1">Price in / out per M</th>
                  <th className="py-1">Replies</th>
                  <th className="py-1">≈ Cost</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {ANTHROPIC_MODELS.map((m) => {
                  const est = estimateWorkshopCost(teams, suppliers, Number(draft.max_messages) || DEFAULT_MAX_MESSAGES, m.input, m.output);
                  return (
                    <tr key={m.id} className={`border-b border-border/50 ${m.id === draft.llm_model ? 'text-accent' : ''}`}>
                      <td className="py-1">{m.label}</td>
                      <td className="py-1 font-mono">
                        ${m.input} / ${m.output}
                      </td>
                      <td className="py-1 font-mono">{est.calls}</td>
                      <td className="py-1 font-mono">{formatCost(est.usd)}</td>
                      <td className="py-1 text-xs text-muted-foreground">{m.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Actual spend so far is on the Results tab. Lovable gateway calls are billed in Lovable credits.</p>
          </div>
        )}
      </Card>

      <Card className="bg-card border-border p-6 space-y-3">
        <h3 className="font-display text-xl text-primary">Shared rules prompt</h3>
        <p className="text-sm text-muted-foreground">
          Behaviour rules every supplier follows (spec sections 3–7). Each supplier's own persona and proposal are added after this text. Price limits are also enforced by the
          server, whatever the prompt says.
        </p>
        <Textarea className="bg-background font-mono text-xs min-h-[360px]" value={draft.rules_prompt} onChange={(e) => setDraft({ ...draft, rules_prompt: e.target.value })} />
      </Card>

      <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
        <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
};

export default NegotiationSettings;
