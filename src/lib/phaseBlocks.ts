// Parallel phases: a phase can name another phase it runs at the same time with (`parallelWith`,
// kept symmetric on both phases; the team splits in half). Linked phases form one block that is
// started, timed and voiced over together; each phase keeps its own evaluation. A block of one phase is an ordinary phase.
import type { Phase } from '@/lib/workshopData';

export const PARALLEL_LABEL = 'PARALLEL PHASES – team splits in half';

export interface PhaseBlock {
  /** Id of the first phase; joint data (ranking entry, voice intro) is stored on it. */
  id: string;
  phases: Phase[];
  /** 1-based position of each phase in the full list (phase numbering is kept: 5, 6, 8, 9...). */
  numbers: number[];
  parallel: boolean;
}

/** Phases in game order, grouped into blocks of phases that run at the same time. A block sits at the position of its first phase. */
export const groupPhaseBlocks = (phases: Phase[]): PhaseBlock[] => {
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  const index = new Map(sorted.map((p, i) => [p.id, i]));
  // Union-find over the parallel links (a link to an unknown phase or to itself is ignored)
  const root = sorted.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  sorted.forEach((p, i) => {
    const j = p.parallelWith ? index.get(p.parallelWith) : undefined;
    if (j !== undefined && j !== i) root[Math.max(find(i), find(j))] = Math.min(find(i), find(j));
  });
  const blocks = new Map<number, PhaseBlock>();
  sorted.forEach((phase, i) => {
    const r = find(i);
    const block = blocks.get(r);
    if (block) {
      block.phases.push(phase);
      block.numbers.push(i + 1);
      block.parallel = true;
    } else {
      blocks.set(r, { id: phase.id, phases: [phase], numbers: [i + 1], parallel: false });
    }
  });
  return [...blocks.values()];
};

/** Phases that run at the same time do not add up: a block lasts as long as its longest phase. */
export const blockDuration = (block: PhaseBlock) => Math.max(0, ...block.phases.map((p) => p.durationMinutes || 0));

export const totalWorkshopMinutes = (phases: Phase[]) =>
  groupPhaseBlocks(phases).reduce((sum, block) => sum + blockDuration(block), 0);

/** running if any phase runs; completed only when every phase of the block is completed. */
export const blockStatus = (block: PhaseBlock): Phase['status'] =>
  block.phases.some((p) => p.status === 'running')
    ? 'running'
    : block.phases.every((p) => p.status === 'completed')
      ? 'completed'
      : 'inactive';

/** Latest end time in the block (the block's shared countdown). */
export const blockEndTime = (block: PhaseBlock): string | null => {
  const ends = block.phases.map((p) => p.endTime).filter((t): t is string => !!t);
  if (!ends.length) return null;
  return ends.reduce((a, b) => (new Date(b).getTime() > new Date(a).getTime() ? b : a));
};

export const runningBlock = (phases: Phase[]) => groupPhaseBlocks(phases).find((b) => blockStatus(b) === 'running') ?? null;

export const blockOf = (phases: Phase[], phaseId: string) =>
  groupPhaseBlocks(phases).find((b) => b.phases.some((p) => p.id === phaseId)) ?? null;

/** "Quality Control + Risk mitigation" */
export const blockName = (block: PhaseBlock) => block.phases.map((p) => p.name).join(' + ');

/** "5 + 6" */
export const blockNumbers = (block: PhaseBlock) => block.numbers.join(' + ');

/** Anchor id of a phase section that the phase map links to. */
export const phaseAnchorId = (id: string) => `phase-${id}`;
