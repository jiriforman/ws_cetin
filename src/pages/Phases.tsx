import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkshop } from '@/contexts/WorkshopContext';
import PhaseCountdown from '@/components/PhaseCountdown';
import { CheckCircle2, Circle, PlayCircle, ChevronDown, ChevronUp, GitFork, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useToast } from '@/hooks/use-toast';
import type { Phase } from '@/lib/workshopData';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { sanitizeHtml } from '@/lib/sanitize';
import LearningContent from '@/components/LearningContent';
import { blockDuration, blockEndTime, blockName, blockStatus, groupPhaseBlocks, PARALLEL_LABEL, PhaseBlock, runningBlock, totalWorkshopMinutes } from '@/lib/phaseBlocks';
import { getVoiceIntro, setVoiceIntro } from '@/lib/voiceIntro';

const isEmptyHTML = (html: string | undefined | null): boolean => {
  if (!html) return true;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length === 0;
};

const RICH_TEXT_CLASSES = 'prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2 [&_.video-embed]:my-4 [&_.audio-embed]:my-3 [&_audio]:w-full [&_.video-embed_iframe]:rounded-lg [&_.video-embed_iframe]:shadow-lg';

/** Facilitator's written outcome of a phase; editable in place by a logged-in admin. */
const PhaseEvaluation = ({ phase, title = 'Evaluation' }: { phase: Phase; title?: string }) => {
  const { isAdmin, updatePhase } = useWorkshop();
  const { toast } = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft === null) return;
    setSaving(true);
    const saved = await updatePhase(phase.id, { evaluation: draft });
    setSaving(false);
    if (!saved) return;
    setDraft(null);
    toast({ title: 'Evaluation saved' });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-secondary">{title}</h4>
        {isAdmin && draft === null && (
          <Button size="sm" variant="outline" onClick={() => setDraft(phase.evaluation)}>
            {isEmptyHTML(phase.evaluation) ? 'Write' : 'Edit'}
          </Button>
        )}
      </div>
      {draft !== null ? (
        <div className="space-y-2">
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="How did the phase turn out? A short summary for all teams."
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : !isEmptyHTML(phase.evaluation) || /<(img|iframe|table)\b/i.test(phase.evaluation) ? (
        <div className={`text-muted-foreground break-words ${RICH_TEXT_CLASSES}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(phase.evaluation) }} />
      ) : (
        <p className="text-sm text-muted-foreground italic">Not evaluated yet.</p>
      )}
    </div>
  );
};

const StatusIcon = ({ status }: { status: Phase['status'] }) =>
  status === 'completed' ? (
    <CheckCircle2 className="h-8 w-8 text-primary" />
  ) : status === 'running' ? (
    <PlayCircle className="h-8 w-8 text-primary animate-pulse-glow" />
  ) : (
    <Circle className="h-8 w-8 text-muted-foreground" />
  );

const StatusBadge = ({ status }: { status: Phase['status'] }) => (
  <Badge
    variant={status === 'running' ? 'default' : status === 'completed' ? 'secondary' : 'outline'}
    className={status === 'running' ? 'bg-primary/20 text-primary border-primary' : ''}
  >
    {status.toUpperCase()}
  </Badge>
);

const RichBlock = ({ title, html, tone = 'text-secondary' }: { title: string; html: string; tone?: string }) => (
  <div>
    <h4 className={`text-sm font-semibold mb-2 ${tone}`}>{title}</h4>
    <div className={`text-muted-foreground ${RICH_TEXT_CLASSES}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
  </div>
);

interface PhaseCardProps {
  phase: Phase;
  number: number;
  expanded: boolean;
  onToggle: () => void;
  /** Inside a parallel block the voice intro and timer are shown once for the block; the evaluation stays per phase. */
  inParallel?: boolean;
}

const PhaseCard = ({ phase, number, expanded, onToggle, inParallel = false }: PhaseCardProps) => {
  const { tools } = useWorkshop();
  const background = inParallel ? setVoiceIntro(phase.background, '') : phase.background;
  return (
    <Collapsible open={expanded} onOpenChange={onToggle} className="h-full">
      <Card
        className={`h-full transition-all ${
          phase.status === 'running' ? 'border-primary bg-primary/5' : phase.status === 'completed' ? 'border-muted bg-card' : 'border-border bg-card'
        }`}
      >
        <CollapsibleTrigger className="w-full p-6 text-left">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center gap-3">
              <StatusIcon status={phase.status} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-display text-xl font-bold break-words">
                  <span className="mr-2 font-mono text-base text-muted-foreground">{number}.</span>
                  {phase.name}
                </h3>
                <div className="flex items-center gap-2">
                  <StatusBadge status={phase.status} />
                  {!inParallel && <span className="text-sm text-muted-foreground font-mono">{phase.durationMinutes} min</span>}
                  {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-6 pb-6 pt-2 space-y-4">
            <div className="border-t border-border pt-4">
              <RichBlock title="Background" html={background} tone="text-primary" />
            </div>

            {(phase.status === 'running' || phase.status === 'completed') && (
              <>
                {!isEmptyHTML(phase.task) && <RichBlock title="Task" html={phase.task} />}
                {!isEmptyHTML(phase.materials) && <RichBlock title="Materials" html={phase.materials} />}
                {!isEmptyHTML(phase.output) && <RichBlock title="Output" html={phase.output} />}
              </>
            )}

            <PhaseEvaluation phase={phase} />
            {phase.learningsVisible && (
              <section className="space-y-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-primary">Learnings</h4>
                <div className={`grid gap-4 ${inParallel ? '' : 'md:grid-cols-2'}`}>
                  <div><h5 className="mb-2 font-semibold text-secondary">Project management</h5><LearningContent html={phase.learningsProjectManagement} /></div>
                  <div><h5 className="mb-2 font-semibold text-secondary">AI Arsenal</h5><LearningContent html={phase.learningsAiArsenal} /></div>
                </div>
              </section>
            )}

            {phase.tools && phase.tools.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-primary mb-2">AI Arsenal</h4>
                <div className="flex flex-wrap gap-2">
                  {phase.tools.map((toolId) => {
                    const tool = tools.find((t) => t.id === toolId);
                    if (!tool) return null;
                    return (
                      <div key={tool.id} className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:border-primary/50 transition-all">
                        {tool.logoUrl && <img src={tool.logoUrl} alt={`${tool.toolName} logo`} className="w-6 h-6 object-contain rounded" />}
                        <span className="text-sm font-medium">{tool.toolName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!inParallel && phase.status === 'running' && phase.endTime && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Remaining:</span>
                  <PhaseCountdown endTime={phase.endTime} />
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

/** Phases that run at the same time (team splits in half): one container, one voice intro, one timer; each phase keeps its own evaluation. */
const ParallelBlock = ({ block, expanded, onToggle }: { block: PhaseBlock; expanded: Set<string>; onToggle: (id: string) => void }) => {
  const status = blockStatus(block);
  const endTime = blockEndTime(block);
  // Shared voice intro: the first one found in the block, played once
  const voice = block.phases.map((p) => getVoiceIntro(p.background)).find(Boolean);
  return (
    <section
      aria-label={`${PARALLEL_LABEL}: ${blockName(block)}`}
      className={`rounded-xl border-2 border-dashed p-3 md:p-4 space-y-4 ${status === 'running' ? 'border-primary bg-primary/5' : 'border-accent/60 bg-accent/5'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-wide text-accent">
          <GitFork className="h-5 w-5" aria-hidden="true" />
          {PARALLEL_LABEL}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-sm text-muted-foreground font-mono" title="Both phases run at the same time; the block lasts as long as the longest phase">
            {blockDuration(block)} min total
          </span>
        </div>
      </div>

      {voice && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Mic className="h-4 w-4" aria-hidden="true" /> Voiceover
          </div>
          <audio controls preload="metadata" src={voice} className="w-full" />
        </div>
      )}

      {status === 'running' && endTime && (
        <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">Time Remaining:</span>
          <PhaseCountdown endTime={endTime} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 items-start">
        {block.phases.map((phase, i) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            number={block.numbers[i]}
            expanded={expanded.has(phase.id)}
            onToggle={() => onToggle(phase.id)}
            inParallel
          />
        ))}
      </div>
    </section>
  );
};

const Phases = () => {
  const { phases } = useWorkshop();
  const blocks = groupPhaseBlocks(phases);
  const running = runningBlock(phases);
  const runningEnd = running ? blockEndTime(running) : null;
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <h1 className="narcos-title text-4xl font-bold text-secondary">Mission Phases</h1>
          <p className="text-muted-foreground text-lg">Track your progress through the workshop phases</p>
          {phases.length > 0 && (
            <p className="text-sm text-muted-foreground font-mono">Total time: {totalWorkshopMinutes(phases)} min</p>
          )}

          {running && (
            <div className="inline-block">
              <Card className="bg-card border-primary/30 p-6">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">{running.parallel ? 'CURRENT PHASES (PARALLEL)' : 'CURRENT PHASE'}</div>
                  <div className="font-display text-2xl text-primary">{blockName(running)}</div>
                  {runningEnd && <PhaseCountdown endTime={runningEnd} />}
                </div>
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {blocks.map((block) =>
            block.parallel ? (
              <ParallelBlock key={block.id} block={block} expanded={expandedPhases} onToggle={togglePhase} />
            ) : (
              <PhaseCard
                key={block.id}
                phase={block.phases[0]}
                number={block.numbers[0]}
                expanded={expandedPhases.has(block.id)}
                onToggle={() => togglePhase(block.id)}
              />
            ),
          )}
        </div>

        {!running && (
          <div className="mt-12 text-center">
            <Card className="bg-card border-border p-8 max-w-md mx-auto">
              <p className="text-muted-foreground">
                <span className="font-mono text-primary">[STANDBY]</span> No phase currently active.
                Awaiting admin to start the next mission phase.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Phases;
