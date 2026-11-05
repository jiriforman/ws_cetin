import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rankMovement } from './rankings';
import type { Phase, RankingEntry, Team } from './workshopData';

const team = (id: string): Team => ({
  id, name: id, logoUrl: '', budget: 0, timeWeeks: 0, expectedRevenue: 0, timeBonus: 0, totalRevenue: 0, rank: 0,
  lastRecalculated: null, status: 'active', createdAt: '', updatedAt: '',
});
const phase = (order: number): Phase => ({
  id: `p${order}`, name: `Phase ${order}`, background: '', output: '', task: '', materials: '', evaluation: '',
  learningsProjectManagement: '', learningsAiArsenal: '', learningsVisible: false, cheatSheet: '', budget: 0, tools: [],
  durationMinutes: 10, status: 'completed', startTime: null, endTime: null, order, parallelWith: '',
});
const teams = [team('a'), team('b'), team('c')];
const phases = [phase(1), phase(2)];

test('no movement before two phases are scored', () => {
  const entries: RankingEntry[] = [{ teamId: 'a', phaseId: 'p1', amount: 10 }];
  assert.deepEqual(rankMovement(teams, entries, 100, phases), {});
});

test('movement is caused by the latest scored phase', () => {
  const entries: RankingEntry[] = [
    { teamId: 'a', phaseId: 'p1', amount: 30 },
    { teamId: 'b', phaseId: 'p1', amount: 20 },
    { teamId: 'c', phaseId: 'p1', amount: 10 },
    { teamId: 'c', phaseId: 'p2', amount: 50 },
  ];
  // before p2: a1 b2 c3; after: c1 a2 b3
  assert.deepEqual(rankMovement(teams, entries, 100, phases), { a: -1, b: -1, c: 2 });
});
