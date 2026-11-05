import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseWorkshopFile, toRows } from './workshopTransfer';
import type { Phase } from './workshopData';

test('keeps both learning categories and multiple bullets through export and import', async () => {
  const phase: Phase = {
    id: 'learning-test', name: 'Learning test', background: '', output: '', task: '', materials: '', evaluation: '',
    learningsProjectManagement: '<ul><li>Agree scope</li><li>Review progress</li></ul>',
    learningsAiArsenal: '<ul><li>Compare tools</li><li>Validate results</li></ul>',
    learningsVisible: true, cheatSheet: '<ul><li>Ask for the brief first</li></ul>', budget: 0, tools: [], durationMinutes: 30, status: 'inactive', startTime: null, endTime: null, order: 1, parallelWith: '',
  };
  const rows = toRows({ phases: [phase], teams: [], tools: [], sections: [] });
  const parsed = await parseWorkshopFile(new File([JSON.stringify(rows)], 'learnings.json'));
  assert.equal(parsed.phases?.[0].learnings_project_management, phase.learningsProjectManagement);
  assert.equal(parsed.phases?.[0].learnings_ai_arsenal, phase.learningsAiArsenal);
  assert.equal(parsed.phases?.[0].cheat_sheet, phase.cheatSheet);
});

test('older imports leave saved learnings unchanged', async () => {
  const parsed = await parseWorkshopFile(new File([JSON.stringify({ phases: [{ id: 'existing', name: 'Existing phase' }] })], 'old.json'));
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.phases?.[0] ?? {}, 'learnings_project_management'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.phases?.[0] ?? {}, 'learnings_ai_arsenal'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.phases?.[0] ?? {}, 'cheat_sheet'), false);
});