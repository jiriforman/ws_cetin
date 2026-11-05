import type { Phase, Section } from './workshopData';

export const isLearningsPageEnabled = (sections: Section[]) =>
  sections.some((section) => section.pageKey === 'learnings' && section.enabled);

export const visibleLearningPhases = (phases: Phase[]) =>
  [...phases].filter((phase) => phase.learningsVisible).sort((a, b) => a.order - b.order);