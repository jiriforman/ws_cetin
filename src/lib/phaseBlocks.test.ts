import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { blockDuration, blockStatus, groupPhaseBlocks, totalWorkshopMinutes } from './phaseBlocks';
import type { Phase } from './workshopData';

const phase = (order: number, minutes: number, parallelWith = '', status: Phase['status'] = 'inactive'): Phase => ({
  id: `p${order}`, name: `Phase ${order}`, background: '', output: '', task: '', materials: '', evaluation: '',
  learningsProjectManagement: '', learningsAiArsenal: '', learningsVisible: false, cheatSheet: '', budget: 0, tools: [],
  durationMinutes: minutes, status, startTime: null, endTime: null, order, parallelWith,
});

// 9 phases; 5+6 and 8+9 run in parallel
const workshop = [phase(1, 10), phase(2, 10), phase(3, 10), phase(4, 10), phase(5, 20, 'p6'), phase(6, 30, 'p5'), phase(7, 10), phase(8, 15, 'p9'), phase(9, 15, 'p8')];

test('groups 5+6 and 8+9 into parallel blocks and keeps phase numbers', () => {
  const blocks = groupPhaseBlocks(workshop);
  assert.equal(blocks.length, 7);
  assert.deepEqual(blocks.filter((b) => b.parallel).map((b) => b.numbers), [[5, 6], [8, 9]]);
  assert.equal(blocks[4].id, 'p5');
});

test('parallel phases do not add up in the total workshop time', () => {
  assert.equal(blockDuration(groupPhaseBlocks(workshop)[4]), 30);
  assert.equal(totalWorkshopMinutes(workshop), 10 * 4 + 30 + 10 + 15);
});

test('a block is completed only when both parallel phases are completed', () => {
  const [block] = groupPhaseBlocks([phase(1, 10, 'p2', 'completed'), phase(2, 10, 'p1', 'running')]);
  assert.equal(blockStatus(block), 'running');
  const [done] = groupPhaseBlocks([phase(1, 10, 'p2', 'completed'), phase(2, 10, 'p1', 'completed')]);
  assert.equal(blockStatus(done), 'completed');
});

test('a phase can run in parallel with a non-adjacent phase; the pair sits at the first phase', () => {
  const blocks = groupPhaseBlocks([phase(1, 10), phase(2, 10, 'p4'), phase(3, 10), phase(4, 25, 'p2')]);
  assert.deepEqual(blocks.map((b) => b.numbers), [[1], [2, 4], [3]]);
  assert.equal(totalWorkshopMinutes([phase(1, 10), phase(2, 10, 'p4'), phase(3, 10), phase(4, 25, 'p2')]), 45);
});

test('a one-sided or broken link still pairs, a link to itself or a missing phase is ignored', () => {
  assert.deepEqual(groupPhaseBlocks([phase(1, 10, 'p2'), phase(2, 10)]).map((b) => b.numbers), [[1, 2]]);
  assert.deepEqual(groupPhaseBlocks([phase(1, 10, 'p1'), phase(2, 10, 'gone')]).map((b) => b.numbers), [[1], [2]]);
});
