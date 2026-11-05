import { plainTextToHtml } from '@/lib/sanitize';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Team, Phase, Tool, ToolCategory, Section, RankingEntry } from '@/lib/workshopData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { adminApi, adminLogin, getAdminSession, setAdminSession } from '@/lib/api';
import { blockOf } from '@/lib/phaseBlocks';

// Columns readable with the public key (token and drive_share_url are admin/team only)
const PUBLIC_TEAM_COLUMNS =
  'id, name, logo_url, budget, time_weeks, status, created_at, updated_at, expected_revenue, time_bonus, total_revenue, last_recalculated, rank';

const REFRESH_INTERVAL_MS = 15_000;

type Row =Record<string, any>;

export const mapTeam = (t: Row): Team => ({
  id: t.id,
  token: t.token,
  name: t.name,
  logoUrl: t.logo_url || '',
  driveShareUrl: t.drive_share_url || '',
  introVideoUrl: t.intro_video_url || '',
  pmName: t.pm_name || '',
  members: Array.isArray(t.members) ? t.members.map(String) : [],
  budget: t.budget || 0,
  timeWeeks: t.time_weeks || 0,
  expectedRevenue: t.expected_revenue || 0,
  timeBonus: t.time_bonus || 0,
  totalRevenue: t.total_revenue || 0,
  rank: t.rank || 0,
  lastRecalculated: t.last_recalculated || null,
  status: t.status as 'active' | 'disabled',
  createdAt: t.created_at || new Date().toISOString(),
  updatedAt: t.updated_at || new Date().toISOString(),
});

const mapPhase = (p: Row): Phase => ({
  id: p.id,
  name: p.name,
  background: p.background || '',
  output: p.output || '',
  task: p.task || '',
  materials: p.materials || '',
  evaluation: plainTextToHtml(p.evaluation),
  learningsProjectManagement: p.learnings_project_management || '',
  learningsAiArsenal: p.learnings_ai_arsenal || '',
  learningsVisible: p.learnings_visible ?? false,
  cheatSheet: p.cheat_sheet || '',
  budget: p.budget || 0,
  tools: p.tools || [],
  durationMinutes: p.duration_minutes || 0,
  status: p.status as 'inactive' | 'running' | 'completed',
  startTime: p.start_time,
  endTime: p.end_time,
  order: p.order,
  parallelWith: p.parallel_with || '',
});

const mapRankingEntry = (e: Row): RankingEntry => ({
  teamId: e.team_id,
  phaseId: e.phase_id,
  amount: Number(e.amount) || 0,
});

const mapTool = (t: Row): Tool => ({
  id: t.id,
  toolName: t.tool_name,
  description: t.description || '',
  linkUrl: t.link_url || '',
  logoUrl: t.logo_url || '',
  category: t.category || '',
  visible: t.visible ?? true,
  displayOrder: t.display_order || 0,
});

const mapToolCategory = (c: Row): ToolCategory => ({
  id: c.id,
  name: c.name,
  description: c.description || '',
  displayOrder: c.display_order || 0,
});

const mapSection = (s: Row): Section => ({
  id: s.id,
  pageKey: s.page_key as Section['pageKey'],
  enabled: s.enabled ?? true,
  contentRTF: s.content_rtf || '',
  parameters: (s.parameters as Record<string, any>) || {},
  displayOrder: s.display_order || 0,
});

const teamToDb = (u: Partial<Team>) => {
  const db: Row = {};
  if (u.name !== undefined) db.name = u.name;
  if (u.logoUrl !== undefined) db.logo_url = u.logoUrl;
  if (u.driveShareUrl !== undefined) db.drive_share_url = u.driveShareUrl;
  if (u.budget !== undefined) db.budget = u.budget;
  if (u.timeWeeks !== undefined) db.time_weeks = u.timeWeeks;
  if (u.expectedRevenue !== undefined) db.expected_revenue = u.expectedRevenue;
  if (u.timeBonus !== undefined) db.time_bonus = u.timeBonus;
  if (u.totalRevenue !== undefined) db.total_revenue = u.totalRevenue;
  if (u.status !== undefined) db.status = u.status;
  return db;
};

const phaseToDb = (u: Partial<Phase>) => {
  const db: Row = {};
  if (u.name !== undefined) db.name = u.name;
  if (u.background !== undefined) db.background = u.background;
  if (u.output !== undefined) db.output = u.output;
  if (u.task !== undefined) db.task = u.task;
  if (u.materials !== undefined) db.materials = u.materials;
  if (u.evaluation !== undefined) db.evaluation = u.evaluation;
  if (u.learningsProjectManagement !== undefined) db.learnings_project_management = u.learningsProjectManagement;
  if (u.learningsAiArsenal !== undefined) db.learnings_ai_arsenal = u.learningsAiArsenal;
  if (u.learningsVisible !== undefined) db.learnings_visible = u.learningsVisible;
  if (u.cheatSheet !== undefined) db.cheat_sheet = u.cheatSheet;
  if (u.budget !== undefined) db.budget = u.budget;
  if (u.durationMinutes !== undefined) db.duration_minutes = u.durationMinutes;
  if (u.tools !== undefined) db.tools = u.tools;
  if (u.status !== undefined) db.status = u.status;
  if (u.startTime !== undefined) db.start_time = u.startTime;
  if (u.endTime !== undefined) db.end_time = u.endTime;
  if (u.order !== undefined) db.order = u.order;
  return db;
};

const toolToDb = (u: Partial<Tool>) => {
  const db: Row = {};
  if (u.toolName !== undefined) db.tool_name = u.toolName;
  if (u.description !== undefined) db.description = u.description;
  if (u.linkUrl !== undefined) db.link_url = u.linkUrl;
  if (u.logoUrl !== undefined) db.logo_url = u.logoUrl;
  if (u.category !== undefined) db.category = u.category;
  if (u.visible !== undefined) db.visible = u.visible;
  if (u.displayOrder !== undefined) db.display_order = u.displayOrder;
  return db;
};

interface WorkshopContextType {
  teams: Team[];
  phases: Phase[];
  tools: Tool[];
  toolCategories: ToolCategory[];
  sections: Section[];
  /** Cartel Rankings: Start phase amount (USD), the same for every team */
  startingBudget: number;
  rankingEntries: RankingEntry[];
  isLoaded: boolean;
  isAdmin: boolean;
  loginAdmin: (password: string) => Promise<void>;
  logoutAdmin: () => void;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<boolean>;
  updatePhase: (id: string, updates: Partial<Phase>) => Promise<boolean>;
  updateTool: (id: string, updates: Partial<Tool>) => Promise<boolean>;
  updateSection: (id: string, updates: Partial<Section>) => Promise<boolean>;
  createTool: (tool: Omit<Tool, 'id'>) => Promise<boolean>;
  deleteTool: (id: string) => Promise<boolean>;
  createPhase: (phase: Omit<Phase, 'id'>) => Promise<boolean>;
  deletePhase: (id: string) => Promise<boolean>;
  reorderPhase: (id: string, direction: 'up' | 'down') => Promise<boolean>;
  /** Runs the phase in parallel with `partnerId` (null = alone); saved on both phases. */
  setPhaseParallel: (id: string, partnerId: string | null) => Promise<boolean>;
  reorderTool: (id: string, direction: 'up' | 'down') => Promise<boolean>;
  updateToolCategoryDescription: (id: string, description: string) => Promise<boolean>;
  reorderToolCategory: (id: string, direction: 'up' | 'down') => Promise<boolean>;
  getRunningPhase: () => Phase | null;
  /** Starts the phase together with the phases running in parallel with it. */
  startPhase: (id: string) => Promise<boolean>;
  /** Completes the phase together with the phases running in parallel with it. */
  stopPhase: (id: string) => Promise<boolean>;
  recalculateRankings: () => Promise<void>;
  setStartingBudget: (amount: number) => Promise<boolean>;
  /** amount null removes the entry (not recorded yet) */
  setRankingEntry: (teamId: string, phaseId: string, amount: number | null) => Promise<boolean>;
  resetRankings: () => Promise<boolean>;
}

// Keep one context instance across hot reloads so live edits never split provider and consumers.
const globalStore = globalThis as unknown as { __workshopContext?: React.Context<WorkshopContextType | undefined> };
const WorkshopContext =
  globalStore.__workshopContext ?? (globalStore.__workshopContext = createContext<WorkshopContextType | undefined>(undefined));

export const WorkshopProvider = ({ children }: { children: ReactNode }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolCategories, setToolCategories] = useState<ToolCategory[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [startingBudget, setStartingBudgetState] = useState(0);
  const [rankingEntries, setRankingEntries] = useState<RankingEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const loadTeams = useCallback(async (asAdmin: boolean) => {
    if (asAdmin) {
      const { teams: rows } = await adminApi<{ teams: Row[] }>('list-teams');
      setTeams(rows.map(mapTeam));
      return;
    }
    // Inactive (disabled) teams are hidden from every public view: rankings, dashboards, team codes
    const { data, error } = await supabase.from('teams').select(PUBLIC_TEAM_COLUMNS).eq('status', 'active');
    if (error) throw error;
    setTeams((data || []).map(mapTeam));
  }, []);

  const loadRankings = useCallback(async () => {
    const [settingsRes, entriesRes] = await Promise.all([
      supabase.from('ranking_settings').select('starting_budget').maybeSingle(),
      supabase.from('ranking_entries').select('team_id, phase_id, amount'),
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (entriesRes.error) throw entriesRes.error;
    setStartingBudgetState(Number(settingsRes.data?.starting_budget) || 0);
    setRankingEntries((entriesRes.data || []).map(mapRankingEntry));
  }, []);

  const loadData = useCallback(async (asAdmin: boolean) => {
    try {
      const [phasesRes, toolsRes, sectionsRes, categoriesRes] = await Promise.all([
        supabase.from('phases').select('*').order('order'),
        supabase.from('tools').select('*').order('display_order'),
        supabase.from('sections').select('*'),
        supabase.from('tool_categories').select('*').order('display_order'),
        loadTeams(asAdmin),
        loadRankings().catch((e) => console.error('Error loading rankings:', e)),
      ]);
      if (phasesRes.data) setPhases(phasesRes.data.map(mapPhase));
      if (toolsRes.data) setTools(toolsRes.data.map(mapTool));
      if (categoriesRes.data) setToolCategories(categoriesRes.data.map(mapToolCategory));
      if (sectionsRes.data) setSections(sectionsRes.data.map(mapSection));
    } catch (error) {
      console.error('Error loading data:', error);
      if (asAdmin && !getAdminSession()) setIsAdmin(false);
    } finally {
      setIsLoaded(true);
    }
  }, [loadTeams, loadRankings]);

  useEffect(() => {
    const init = async () => {
      let admin = false;
      if (getAdminSession()) {
        try {
          await adminApi('verify');
          admin = true;
        } catch {
          // expired or invalid session - fall back to public view
        }
      }
      setIsAdmin(admin);
      await loadData(admin);
    };
    init();
  }, [loadData]);

  // Keep every open screen in sync during the workshop (phase start/stop, rankings, content).
  // Polling instead of Realtime: Realtime payloads would include the hidden team columns.
  // (The ranking tables hold nothing secret, so they also get Realtime below.)
  useEffect(() => {
    if (!isLoaded) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') loadData(isAdmin);
    };
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isLoaded, isAdmin, loadData]);

  // The leaderboard is reviewed live after each phase: push ranking changes to every screen at once
  useEffect(() => {
    const channel = supabase
      .channel('cartel-rankings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ranking_entries' }, () => {
        loadRankings().catch((e) => console.error('Error loading rankings:', e));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ranking_settings' }, () => {
        loadRankings().catch((e) => console.error('Error loading rankings:', e));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRankings]);

  const loginAdmin = async (password: string) => {
    await adminLogin(password);
    setIsAdmin(true);
    await loadTeams(true);
  };

  const logoutAdmin = () => {
    setAdminSession(null);
    setIsAdmin(false);
    loadTeams(false).catch((e) => console.error('Error loading teams:', e));
  };

  // Runs an admin write; on failure shows an error toast. Resolves to whether it succeeded.
  const mutate = async (fn: () => Promise<void>): Promise<boolean> => {
    try {
      await fn();
      return true;
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unknown error';
      // A column added by a migration that has not been applied to the database yet
      const message = /schema cache/i.test(raw)
        ? `${raw}. The database is missing a migration: apply the latest file from drizzle/migrations.`
        : /unknown action/i.test(raw)
          ? `${raw}. The admin-api backend function is out of date: redeploy the edge functions from the current main branch.`
          : raw;
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
      if (!getAdminSession()) setIsAdmin(false);
      return false;
    }
  };

  const updateTeam = (id: string, updates: Partial<Team>) =>
    mutate(async () => {
      const { row } = await adminApi<{ row: Row }>('update', { table: 'teams', id, values: teamToDb(updates) });
      setTeams((prev) => prev.map((t) => (t.id === id ? mapTeam(row) : t)));
    });

  const updatePhase = (id: string, updates: Partial<Phase>) =>
    mutate(async () => {
      const { row } = await adminApi<{ row: Row }>('update', { table: 'phases', id, values: phaseToDb(updates) });
      setPhases((prev) => prev.map((p) => (p.id === id ? mapPhase(row) : p)));
    });

  const updateTool = (id: string, updates: Partial<Tool>) =>
    mutate(async () => {
      const { row } = await adminApi<{ row: Row }>('update', { table: 'tools', id, values: toolToDb(updates) });
      setTools((prev) => prev.map((t) => (t.id === id ? mapTool(row) : t)));
    });

  const updateSection = (id: string, updates: Partial<Section>) =>
    mutate(async () => {
      const values: Row = {};
      if (updates.contentRTF !== undefined) values.content_rtf = updates.contentRTF;
      if (updates.enabled !== undefined) values.enabled = updates.enabled;
      const { row } = await adminApi<{ row: Row }>('update', { table: 'sections', id, values });
      setSections((prev) => prev.map((s) => (s.id === id ? mapSection(row) : s)));
    });

  const createTool = (tool: Omit<Tool, 'id'>) =>
    mutate(async () => {
      const { row } = await adminApi<{ row: Row }>('insert', { table: 'tools', values: toolToDb(tool) });
      setTools((prev) => [...prev, mapTool(row)]);
    });

  const deleteTool = (id: string) =>
    mutate(async () => {
      await adminApi('delete', { table: 'tools', id });
      setTools((prev) => prev.filter((t) => t.id !== id));
    });

  const createPhase = (phase: Omit<Phase, 'id'>) =>
    mutate(async () => {
      const maxOrder = Math.max(...phases.map((p) => p.order), 0);
      const { row } = await adminApi<{ row: Row }>('insert', {
        table: 'phases',
        values: phaseToDb({ ...phase, order: maxOrder + 1 }),
      });
      setPhases((prev) => [...prev, mapPhase(row)]);
    });

  const deletePhase = (id: string) =>
    mutate(async () => {
      await adminApi('delete', { table: 'phases', id });
      setPhases((prev) => prev.filter((p) => p.id !== id));
      setRankingEntries((prev) => prev.filter((e) => e.phaseId !== id));
    });

  const reorder = <T extends { id: string },>(items: T[], id: string, direction: 'up' | 'down') => {
    const index = items.findIndex((i) => i.id === id);
    if (index === -1 || (direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) return null;
    const sorted = [...items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [sorted[index], sorted[newIndex]] = [sorted[newIndex], sorted[index]];
    return sorted;
  };

  const reorderPhase = (id: string, direction: 'up' | 'down') =>
    mutate(async () => {
      const sorted = reorder([...phases].sort((a, b) => a.order - b.order), id, direction);
      if (!sorted) return;
      await adminApi('reorder', { table: 'phases', ids: sorted.map((p) => p.id) });
      setPhases(sorted.map((phase, idx) => ({ ...phase, order: idx + 1 })));
    });

  const setPhaseParallel = (id: string, partnerId: string | null) =>
    mutate(async () => {
      const { rows } = await adminApi<{ rows: Row[] }>('set-parallel', { id, partner_id: partnerId });
      const byId = new Map(rows.map((r) => [r.id as string, mapPhase(r)]));
      setPhases((prev) => prev.map((p) => byId.get(p.id) ?? p));
    });

  const reorderTool = (id: string, direction: 'up' | 'down') =>
    mutate(async () => {
      const sorted = reorder([...tools].sort((a, b) => a.displayOrder - b.displayOrder), id, direction);
      if (!sorted) return;
      await adminApi('reorder', { table: 'tools', ids: sorted.map((t) => t.id) });
      setTools(sorted.map((tool, idx) => ({ ...tool, displayOrder: idx + 1 })));
    });

  const updateToolCategoryDescription = (id: string, description: string) =>
    mutate(async () => {
      const { row } = await adminApi<{ row: Row }>('update', { table: 'tool_categories', id, values: { description } });
      setToolCategories((prev) => prev.map((c) => (c.id === id ? mapToolCategory(row) : c)));
    });

  const reorderToolCategory = (id: string, direction: 'up' | 'down') =>
    mutate(async () => {
      const sorted = reorder([...toolCategories].sort((a, b) => a.displayOrder - b.displayOrder), id, direction);
      if (!sorted) return;
      await adminApi('reorder', { table: 'tool_categories', ids: sorted.map((c) => c.id) });
      setToolCategories(sorted.map((c, idx) => ({ ...c, displayOrder: idx + 1 })));
    });

  const getRunningPhase = () => phases.find((p) => p.status === 'running') || null;

  // The server starts the whole parallel block. An older admin-api returns only the one row and
  // completes the others, so the rest of the block is started here with the same timer.
  const startPhase = (id: string) =>
    mutate(async () => {
      const block = blockOf(phases, id);
      const { row, rows } = await adminApi<{ row: Row; rows?: Row[] }>('start-phase', { id });
      let started = (rows ?? [row]).map(mapPhase);
      if (!rows && block && block.parallel) {
        const end = block.phases.reduce((max, p) => Math.max(max, p.durationMinutes || 0), 0);
        const startTime = row.start_time as string;
        const endTime = new Date(new Date(startTime).getTime() + end * 60_000).toISOString();
        const others = await Promise.all(
          block.phases.map(async (p) => {
            const values = { status: 'running', start_time: startTime, end_time: endTime };
            const res = await adminApi<{ row: Row }>('update', { table: 'phases', id: p.id, values });
            return mapPhase(res.row);
          }),
        );
        started = others;
      }
      const byId = new Map(started.map((p) => [p.id, p]));
      setPhases((prev) =>
        prev.map((p) => {
          const next = byId.get(p.id);
          if (next) return next;
          if (p.status === 'running') return { ...p, status: 'completed' as const };
          return p;
        }),
      );
    });

  const stopPhase = (id: string) =>
    mutate(async () => {
      const ids = (blockOf(phases, id)?.phases ?? []).filter((p) => p.status === 'running' || p.id === id).map((p) => p.id);
      const rows = await Promise.all(
        ids.map((pid) => adminApi<{ row: Row }>('update', { table: 'phases', id: pid, values: { status: 'completed' } })),
      );
      const byId = new Map(rows.map(({ row }) => [row.id as string, mapPhase(row)]));
      setPhases((prev) => prev.map((p) => byId.get(p.id) ?? p));
    });

  const recalculateRankings = async () => {
    // Reload data from database (all values come from the Google Sheet)
    await loadData(isAdmin);
  };

  const setStartingBudget = (amount: number) =>
    mutate(async () => {
      await adminApi('set-starting-budget', { amount });
      setStartingBudgetState(amount);
    });

  const setRankingEntry = (teamId: string, phaseId: string, amount: number | null) =>
    mutate(async () => {
      await adminApi('set-ranking-entry', { team_id: teamId, phase_id: phaseId, amount });
      setRankingEntries((prev) => {
        const rest = prev.filter((e) => !(e.teamId === teamId && e.phaseId === phaseId));
        return amount === null ? rest : [...rest, { teamId, phaseId, amount }];
      });
    });

  const resetRankings = () =>
    mutate(async () => {
      await adminApi('reset-rankings');
      setStartingBudgetState(0);
      setRankingEntries([]);
      await loadTeams(true);
    });

  return (
    <WorkshopContext.Provider
      value={{
        teams, phases, tools, toolCategories, sections, startingBudget, rankingEntries, isLoaded, isAdmin, loginAdmin, logoutAdmin,
        updateTeam, updatePhase, updateTool, updateSection, createTool, deleteTool, createPhase, deletePhase,
        reorderPhase, setPhaseParallel, reorderTool, updateToolCategoryDescription, reorderToolCategory, getRunningPhase, startPhase, stopPhase, recalculateRankings,
        setStartingBudget, setRankingEntry, resetRankings,
      }}
    >
      {children}
    </WorkshopContext.Provider>
  );
};

export const useWorkshop = () => {
  const context = useContext(WorkshopContext);
  if (!context) throw new Error('useWorkshop must be used within WorkshopProvider');
  return context;
};
