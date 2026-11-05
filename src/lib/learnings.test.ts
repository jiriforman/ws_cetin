import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { isLearningsPageEnabled, visibleLearningPhases } from './learnings';
import type { Phase, Section } from './workshopData';

const section: Section = { id: 'learnings', pageKey: 'learnings', enabled: false, contentRTF: '', parameters: {}, displayOrder: 5 };
const phase: Phase = { id: 'one', name: 'One', order: 1, status: 'inactive', background: '', task: '', output: '', materials: '', evaluation: '', learningsProjectManagement: '', learningsAiArsenal: '', learningsVisible: false, cheatSheet: '', budget: 0, durationMinutes: 30, tools: [], startTime: null, endTime: null, parallelWith: '' };

test('Learnings page stays unavailable until admin activates it', () => {
  assert.equal(isLearningsPageEnabled([]), false);
  assert.equal(isLearningsPageEnabled([section]), false);
  assert.equal(isLearningsPageEnabled([{ ...section, enabled: true }]), true);
});
test('hidden phase learnings never enter the summary', () => {
  assert.deepEqual(visibleLearningPhases([phase]), []);
  assert.deepEqual(visibleLearningPhases([{ ...phase, learningsVisible: true }]).map((p) => p.id), ['one']);
});
test('summary follows phase order without requiring active status', () => {
  assert.deepEqual(visibleLearningPhases([{ ...phase, id: 'later', order: 2, learningsVisible: true }, { ...phase, learningsVisible: true }]).map((p) => p.id), ['one', 'later']);
});