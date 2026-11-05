import { GitFork } from 'lucide-react';
import { blockDuration, groupPhaseBlocks, PARALLEL_LABEL, phaseAnchorId } from '@/lib/phaseBlocks';
import type { Phase } from '@/lib/workshopData';

const PHASE_STATUS_LABEL: Record<Phase['status'], string> = { inactive: 'not started', running: 'running', completed: 'done' };

const StatusDot = ({ status }: { status: Phase['status'] }) => (
  <span
    aria-label={PHASE_STATUS_LABEL[status]}
    className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
      status === 'running' ? 'bg-primary animate-pulse' : status === 'completed' ? 'bg-primary/50' : 'border border-muted-foreground/60'
    }`}
  />
);

/**
 * Compact phase map: small chips that wrap; parallel phases share one dashed group.
 * Chips link to `#phase-<id>`; pass `onSelect` to handle the jump yourself (e.g. scroll without touching the URL).
 */
export default function PhaseMap({
  phases,
  onSelect,
  highlightId,
  className = '',
}: {
  phases: Phase[];
  onSelect?: (id: string) => void;
  highlightId?: string | null;
  className?: string;
}) {
  return (
    <nav aria-label="Phase map" className={className}>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Phase map</h2>
      <ol className="flex flex-wrap items-center gap-1.5">
        {groupPhaseBlocks(phases).map((block) => {
          const chips = block.phases.map((phase, i) => (
            <a
              key={phase.id}
              href={`#${phaseAnchorId(phase.id)}`}
              onClick={onSelect ? (e) => { e.preventDefault(); onSelect(phase.id); } : undefined}
              title={`${block.numbers[i]}. ${phase.name} · ${phase.durationMinutes} min · ${PHASE_STATUS_LABEL[phase.status]}`}
              className={`inline-flex h-7 max-w-[11rem] items-center gap-1.5 rounded-full border px-2 text-xs transition-colors hover:border-primary/60 ${
                phase.status === 'running' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground'
              } ${highlightId === phase.id ? 'ring-2 ring-secondary ring-offset-1 ring-offset-background' : ''}`}
            >
              <StatusDot status={phase.status} />
              <span className="font-mono text-muted-foreground">{block.numbers[i]}</span>
              <span className="truncate">{phase.name || 'Untitled'}</span>
            </a>
          ));
          return block.parallel ? (
            <li
              key={block.id}
              aria-label={`${PARALLEL_LABEL}: phases ${block.numbers.join(' and ')}, ${blockDuration(block)} min`}
              className="inline-flex flex-wrap items-center gap-1 rounded-full border border-dashed border-accent/70 bg-accent/5 p-0.5 pl-1.5"
            >
              <GitFork className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              {chips}
            </li>
          ) : (
            <li key={block.id}>{chips}</li>
          );
        })}
      </ol>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><StatusDot status="running" /> running</span>
        <span className="inline-flex items-center gap-1"><StatusDot status="completed" /> done</span>
        <span className="inline-flex items-center gap-1"><GitFork className="h-3 w-3 text-accent" aria-hidden="true" /> parallel (team splits in half)</span>
      </p>
    </nav>
  );
}
