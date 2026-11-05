// Cartel Rankings: balance = starting budget (Start phase) + sum of the phase impacts, all in USD.
import type { Phase, RankingEntry, Team } from '@/lib/workshopData';
import { blockName, groupPhaseBlocks } from '@/lib/phaseBlocks';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** 100000 -> "$100,000"; signed: 5000 -> "+$5,000", -10000 -> "−$10,000", 0 -> "$0". */
export const formatUsd = (amount: number, signed = false) => {
  const text = usd.format(Math.abs(amount));
  if (amount < 0) return `−${text}`;
  return signed && amount > 0 ? `+${text}` : text;
};

/** Parses what a facilitator typed ("-10 000", "+5,000", "$8000") into whole dollars; null if empty, NaN if invalid. */
export const parseUsd = (input: string): number | null => {
  const cleaned = input.replace(/[\s,$]/g, '').replace(/^−/, '-');
  if (cleaned === '') return null;
  return /^[+-]?\d+$/.test(cleaned) ? Number(cleaned) : NaN;
};

export interface Standing {
  team: Team;
  rank: number;
  balance: number;
  /** phase id -> amount, only for recorded phases */
  impacts: Record<string, number>;
}

/** Active teams ranked by balance (highest first); equal balances share a rank. */
export const computeStandings = (teams: Team[], entries: RankingEntry[], startingBudget: number): Standing[] => {
  const rows = teams
    .filter((t) => t.status === 'active')
    .map((team) => {
      const impacts: Record<string, number> = {};
      for (const e of entries) if (e.teamId === team.id) impacts[e.phaseId] = e.amount;
      const balance = startingBudget + Object.values(impacts).reduce((sum, a) => sum + a, 0);
      return { team, balance, impacts, rank: 0 };
    })
    .sort((a, b) => b.balance - a.balance || a.team.name.localeCompare(b.team.name));
  rows.forEach((row, i) => {
    row.rank = i > 0 && rows[i - 1].balance === row.balance ? rows[i - 1].rank : i + 1;
  });
  return rows;
};

/** Phases in game order that have at least one recorded impact. */
export const scoredPhases = (phases: Phase[], entries: RankingEntry[]) => {
  const ids = new Set(entries.map((e) => e.phaseId));
  return [...phases].sort((a, b) => a.order - b.order).filter((p) => ids.has(p.id));
};

/**
 * Name of a scoring row/column. Parallel phases are evaluated together: their joint amount is
 * stored on the first phase of the block, which is labelled with both names.
 */
export const scoringLabel = (phase: Phase, phases: Phase[]) => {
  const block = groupPhaseBlocks(phases).find((b) => b.id === phase.id);
  return block?.parallel ? blockName(block) : phase.name;
};

/** Phases that get their own scoring row: one per block (the first phase of a parallel pair). */
export const scoringPhases = (phases: Phase[]) => groupPhaseBlocks(phases).map((b) => b.phases[0]);

/**
 * Rank change per team caused by the latest scored phase (positive = moved up), so a live
 * leaderboard can show who climbed. Empty until at least two phases are scored.
 */
export const rankMovement = (
  teams: Team[],
  entries: RankingEntry[],
  startingBudget: number,
  phases: Phase[],
): Record<string, number> => {
  const scored = scoredPhases(phases, entries);
  if (scored.length < 2) return {};
  const latest = scored[scored.length - 1].id;
  const before = new Map(
    computeStandings(teams, entries.filter((e) => e.phaseId !== latest), startingBudget).map((s) => [s.team.id, s.rank]),
  );
  return Object.fromEntries(
    computeStandings(teams, entries, startingBudget).map((s) => [s.team.id, (before.get(s.team.id) ?? s.rank) - s.rank]),
  );
};
