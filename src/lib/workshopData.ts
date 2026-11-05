// Workshop data types

export interface Team {
  id: string;
  // Only present for the global admin (tokens are not publicly readable)
  token?: string;
  name: string;
  logoUrl: string;
  driveShareUrl?: string;
  // Team page profile; only loaded through team-api / admin-api (not public)
  introVideoUrl?: string;
  pmName?: string;
  members?: string[];
  budget: number;
  timeWeeks: number;
  expectedRevenue: number;
  timeBonus: number;
  totalRevenue: number;
  rank: number;
  lastRecalculated: string | null;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface Phase {
  id: string;
  name: string;
  background: string;
  output: string;
  task: string;
  materials: string;
  // Facilitator's free-text evaluation of the phase outcome (same for all teams)
  evaluation: string;
  learningsProjectManagement: string;
  learningsAiArsenal: string;
  learningsVisible: boolean;
  // Facilitator crib notes shown on the unlisted /cheat page
  cheatSheet: string;
  budget: number;
  tools: string[];
  durationMinutes: number;
  status: 'inactive' | 'running' | 'completed';
  startTime: string | null;
  endTime: string | null;
  order: number;
  // Id of the phase this one runs at the same time with (team splits in half), '' = none.
  // Kept symmetric on both phases by admin-api; see lib/phaseBlocks
  parallelWith: string;
}

export interface Tool {
  id: string;
  toolName: string;
  description: string;
  linkUrl: string;
  logoUrl: string;
  // Id of a ToolCategory; empty = uncategorised ("Other" on the AI Arsenal page)
  category: string;
  visible: boolean;
  displayOrder: number;
}

/** Fixed AI Arsenal group; only the description (HTML) and order are editable. */
export interface ToolCategory {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
}

export const UNCATEGORISED_LABEL = 'Other';

/** Groups tools by category in category order; uncategorised (or unknown) tools come last under "Other". */
export const groupToolsByCategory = (
  tools: Tool[],
  categories: ToolCategory[],
): { category: ToolCategory | null; tools: Tool[] }[] => {
  const sorted = [...tools].sort((a, b) => a.displayOrder - b.displayOrder);
  const known = new Set(categories.map((c) => c.id));
  const groups: { category: ToolCategory | null; tools: Tool[] }[] = [...categories]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c) => ({ category: c, tools: sorted.filter((t) => t.category === c.id) }));
  groups.push({ category: null, tools: sorted.filter((t) => !known.has(t.category)) });
  return groups.filter((g) => g.tools.length > 0);
};

export interface Section {
  id: string;
  pageKey: 'home' | 'phases' | 'aiTools' | 'teamsDashboard' | 'aboutUs' | 'learnings';
  enabled: boolean;
  contentRTF: string;
  parameters: Record<string, any>;
  displayOrder: number;
}

/** Financial impact (USD) of one phase on one team; a missing entry means "not recorded yet". */
export interface RankingEntry {
  teamId: string;
  phaseId: string;
  amount: number;
}
