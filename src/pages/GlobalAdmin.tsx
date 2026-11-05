import { Fragment, ReactNode, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/RichTextEditor';
import PhaseLearningsEditor from '@/components/PhaseLearningsEditor';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkshop } from '@/contexts/WorkshopContext';
import AdminLogin from '@/components/AdminLogin';
import WorkshopTransfer from '@/components/WorkshopTransfer';
import TeamQrDialog from '@/components/TeamQrDialog';
import VoiceIntroInput from '@/components/VoiceIntroInput';
import NegotiationAdmin from '@/components/negotiation/NegotiationAdmin';
import RankingsAdmin from '@/components/RankingsAdmin';
import PhaseMap from '@/components/PhaseMap';
import { phaseAnchorId } from '@/lib/phaseBlocks';
import { useToast } from '@/hooks/use-toast';
import { Phase, Section, UNCATEGORISED_LABEL } from '@/lib/workshopData';
import {
  Shield,
  Users,
  Clock,
  Wrench,
  Settings,
  Play,
  Pause,
  Plus,
  Trash2,
  ExternalLink,
  QrCode,
  ChevronUp,
  ChevronDown,
  Trophy,
  StopCircle,
  LogOut,
  Handshake,
  GitFork,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { sanitizeHtml } from '@/lib/sanitize';
import { blockDuration, blockNumbers, groupPhaseBlocks, PARALLEL_LABEL, totalWorkshopMinutes } from '@/lib/phaseBlocks';

const NO_CATEGORY = 'none';

// Content tab: main pages first, About, AI Arsenal and Learnings below
const CONTENT_ORDER: Section['pageKey'][] = ['home', 'phases', 'teamsDashboard', 'aboutUs', 'aiTools', 'learnings'];
const CONTENT_LABELS: Record<Section['pageKey'], string> = {
  home: 'Home',
  phases: 'Phases',
  teamsDashboard: 'Teams Dashboard',
  aboutUs: 'About',
  aiTools: 'AI Arsenal – Intro',
  learnings: 'Learnings',
};

/** Content tab card that starts folded. */
const FoldCard = ({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) => (
  <Collapsible>
    <Card className="bg-card border-border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 p-4 text-left">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <div className="flex items-center gap-3">
          {badge}
          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-4 pb-4">{children}</CollapsibleContent>
    </Card>
  </Collapsible>
);

const GlobalAdmin = () => {
  const { toast } = useToast();
  const {
    teams,
    phases,
    tools,
    toolCategories,
    sections,
    updateTeam,
    updatePhase,
    updateTool,
    updateSection,
    createTool,
    deleteTool,
    createPhase,
    deletePhase,
    reorderPhase,
    setPhaseParallel,
    reorderTool,
    updateToolCategoryDescription,
    reorderToolCategory,
    startPhase,
    stopPhase,
    isLoaded,
    isAdmin,
    logoutAdmin,
  } = useWorkshop();

  const [qrTeam, setQrTeam] = useState<typeof teams[number] | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [newTool, setNewTool] = useState({ toolName: '', description: '', linkUrl: '', logoUrl: '', category: '' });
  const [newPhase, setNewPhase] = useState({ name: '', background: '', output: '', task: '', materials: '', evaluation: '', learningsProjectManagement: '', learningsAiArsenal: '', learningsVisible: false, cheatSheet: '', budget: 0, tools: [] as string[], durationMinutes: 30, parallelWith: '' });
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [teamDrafts, setTeamDrafts] = useState<Record<string, { name: string }>>({});
  const [phaseDrafts, setPhaseDrafts] = useState<Record<string, { name: string; background: string; output: string; task: string; materials: string; evaluation: string; learningsProjectManagement: string; learningsAiArsenal: string; learningsVisible: boolean; cheatSheet: string; budget: number | ''; durationMinutes: number | ''; tools: string[]; parallelOn: boolean; parallelWith: string }>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [toolDrafts, setToolDrafts] = useState<Record<string, { toolName: string; description: string; linkUrl: string; logoUrl: string; category: string }>>({});

  const phaseBlocks = groupPhaseBlocks(phases);
  const [newPhaseOpen, setNewPhaseOpen] = useState(false);

  // Phase map preview: saved phases with the unsaved edits of the phase being edited (name, duration, parallel partner)
  const mapPhases = ((): Phase[] => {
    const draft = editingPhase ? phaseDrafts[editingPhase] : undefined;
    const sorted = [...phases].sort((a, b) => a.order - b.order);
    if (!editingPhase || !draft) return sorted;
    // Mirror admin-api set-parallel: unlink both phases from earlier partners, then link them symmetrically
    const links = new Map(phases.map((p) => [p.id, p.parallelWith || '']));
    const unlink = (id: string) => {
      const other = links.get(id);
      if (other && links.get(other) === id) links.set(other, '');
      links.set(id, '');
    };
    const partner = draft.parallelOn ? draft.parallelWith : '';
    unlink(editingPhase);
    if (partner) {
      unlink(partner);
      links.set(editingPhase, partner);
      links.set(partner, editingPhase);
    }
    return sorted.map((p) => {
      const parallelWith = links.get(p.id) ?? '';
      if (p.id !== editingPhase) return parallelWith === (p.parallelWith || '') ? p : { ...p, parallelWith };
      const minutes = typeof draft.durationMinutes === 'string' ? parseInt(draft.durationMinutes) || 0 : draft.durationMinutes;
      return { ...p, name: draft.name, durationMinutes: minutes, parallelWith };
    });
  })();
  // Phase cards start folded; a row click or a phase-map chip opens one
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set());
  const togglePhaseOpen = (id: string) =>
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const jumpToPhase = (id: string) => {
    setOpenPhases((prev) => new Set(prev).add(id));
    requestAnimationFrame(() =>
      document.getElementById(phaseAnchorId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  const handleStartPhase = async (id: string) => {
    if (!(await startPhase(id))) return;
    toast({ title: 'Phase Started', description: 'The phase is now running' });
  };

  const handleStopPhase = async (id: string) => {
    if (!(await stopPhase(id))) return;
    toast({ title: 'Phase Stopped', description: 'The phase has been completed' });
  };

  const handleCreateTool = async () => {
    if (newTool.toolName && newTool.description && newTool.linkUrl) {
      if (!(await createTool({ ...newTool, visible: true, displayOrder: tools.length + 1 }))) return;
      setNewTool({ toolName: '', description: '', linkUrl: '', logoUrl: '', category: '' });
      toast({ title: 'Tool Added', description: 'New AI tool has been created' });
    }
  };

  const handleDeleteTool = async (id: string) => {
    if (!(await deleteTool(id))) return;
    toast({ title: 'Tool Deleted', description: 'AI tool has been removed' });
  };

  const handleCreatePhase = async () => {
    if (newPhase.name && newPhase.background) {
      const created = await createPhase({ 
        ...newPhase, 
        status: 'inactive',
        startTime: null,
        endTime: null,
        order: phases.length + 1
      });
      if (!created) return;
      setNewPhase({ name: '', background: '', output: '', task: '', materials: '', evaluation: '', learningsProjectManagement: '', learningsAiArsenal: '', learningsVisible: false, cheatSheet: '', budget: 0, tools: [], durationMinutes: 30, parallelWith: '' });
      setNewPhaseOpen(false);
      toast({ title: 'Phase Created', description: 'New phase has been added' });
    }
  };

  const handleDeletePhase = async (id: string) => {
    if (!(await deletePhase(id))) return;
    toast({ title: 'Phase Deleted', description: 'Phase has been removed' });
  };


  // Local edit helpers to avoid caret jumps and debounce DB writes
  const startEditTeam = (team: typeof teams[number]) => {
    setEditingTeam(team.id);
    setTeamDrafts((prev) => ({
      ...prev,
      [team.id]: { name: team.name },
    }));
  };
  const saveTeam = async (teamId: string) => {
    const draft = teamDrafts[teamId];
    if (draft) {
      const saved = await updateTeam(teamId, { name: draft.name });
      if (!saved) return;
    }
    setEditingTeam(null);
    setTeamDrafts(({ [teamId]: _omit, ...rest }) => rest);
  };

  const phaseDraftOf = (phase: typeof phases[number]) => ({
    name: phase.name,
    background: phase.background,
    output: phase.output,
    task: phase.task || '',
    materials: phase.materials || '',
    evaluation: phase.evaluation || '',
    learningsProjectManagement: phase.learningsProjectManagement || '',
    learningsAiArsenal: phase.learningsAiArsenal || '',
    learningsVisible: phase.learningsVisible,
    cheatSheet: phase.cheatSheet || '',
    budget: phase.budget as number | '',
    durationMinutes: phase.durationMinutes as number | '',
    tools: phase.tools || [],
    parallelOn: !!phase.parallelWith,
    parallelWith: phase.parallelWith,
  });
  const startEditPhase = (phase: typeof phases[number]) => {
    setEditingPhase(phase.id);
    setPhaseDrafts((prev) => ({ ...prev, [phase.id]: phaseDraftOf(phase) }));
  };
  const savePhase = async (phaseId: string) => {
    const draft = phaseDrafts[phaseId];
    if (draft) {
      const current = phases.find((p) => p.id === phaseId);
      const partner = draft.parallelOn ? draft.parallelWith : '';
      if (draft.parallelOn && !partner) {
        toast({ title: 'Choose a phase', description: 'Select the phase this one runs in parallel with, or untick the option.', variant: 'destructive' });
        return;
      }
      // Only phases next to each other in the phase order can run in parallel (checked before anything is saved)
      if (partner && partner !== (current?.parallelWith ?? '')) {
        const sorted = [...phases].sort((a, b) => a.order - b.order);
        const gap = Math.abs(sorted.findIndex((p) => p.id === phaseId) - sorted.findIndex((p) => p.id === partner));
        if (gap !== 1) {
          const other = phases.find((p) => p.id === partner);
          toast({
            title: 'Phases are not next to each other',
            description: `${current?.name} and ${other?.name ?? 'the selected phase'} are not adjacent. Only neighbouring phases can run in parallel; move them next to each other first.`,
            variant: 'destructive',
          });
          return;
        }
      }
      const saved = await updatePhase(phaseId, {
        name: draft.name,
        background: draft.background,
        output: draft.output,
        task: draft.task,
        materials: draft.materials,
        evaluation: draft.evaluation,
        learningsProjectManagement: draft.learningsProjectManagement,
        learningsAiArsenal: draft.learningsAiArsenal,
        learningsVisible: draft.learningsVisible,
        cheatSheet: draft.cheatSheet,
        budget: typeof draft.budget === 'string' ? parseInt(draft.budget) || 0 : draft.budget || 0,
        durationMinutes:
          typeof draft.durationMinutes === 'string'
            ? parseInt(draft.durationMinutes) || 0
            : draft.durationMinutes || 0,
        tools: draft.tools,
      });
      if (!saved) return;
      // Saved on both phases (and releases their earlier partners); only when changed
      if (partner !== (current?.parallelWith ?? '')) {
        if (!(await setPhaseParallel(phaseId, partner || null))) return;
        const other = phases.find((p) => p.id === (partner || current?.parallelWith));
        toast({
          title: partner ? 'Parallel phases saved' : 'Parallel link removed',
          description: partner ? `${current?.name} and ${other?.name} now run at the same time.` : `${current?.name} and ${other?.name} run one after the other again.`,
        });
      }
    }
    setEditingPhase(null);
    setPhaseDrafts(({ [phaseId]: _omit, ...rest }) => rest);
  };

  const startEditTool = (tool: typeof tools[number]) => {
    setEditingTool(tool.id);
    setToolDrafts((prev) => ({
      ...prev,
      [tool.id]: {
        toolName: tool.toolName,
        description: tool.description,
        linkUrl: tool.linkUrl,
        logoUrl: tool.logoUrl,
        category: tool.category,
      },
    }));
  };
  const updateToolDraft = (tool: typeof tools[number], field: keyof (typeof toolDrafts)[string], value: string) =>
    setToolDrafts((prev) => ({
      ...prev,
      [tool.id]: {
        ...(prev[tool.id] ?? {
          toolName: tool.toolName,
          description: tool.description,
          linkUrl: tool.linkUrl,
          logoUrl: tool.logoUrl,
          category: tool.category,
        }),
        [field]: value,
      },
    }));
  const contentSections = [...sections].sort(
    (a, b) => CONTENT_ORDER.indexOf(a.pageKey) - CONTENT_ORDER.indexOf(b.pageKey),
  );
  const sortedToolCategories = [...toolCategories].sort((a, b) => a.displayOrder - b.displayOrder);
  const toolCategoryName = (id: string) => toolCategories.find((c) => c.id === id)?.name;
  // Radix Select has no empty value, so "no category" travels as NO_CATEGORY
  const toolCategorySelect = (value: string, onChange: (category: string) => void) => (
    <Select value={value || NO_CATEGORY} onValueChange={(v) => onChange(v === NO_CATEGORY ? '' : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Category" />
      </SelectTrigger>
      <SelectContent>
        {sortedToolCategories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
        <SelectItem value={NO_CATEGORY}>{UNCATEGORISED_LABEL}</SelectItem>
      </SelectContent>
    </Select>
  );

  const saveTool = async (toolId: string) => {
    const draft = toolDrafts[toolId];
    if (draft && !(await updateTool(toolId, draft))) return;
    setEditingTool(null);
    setToolDrafts(({ [toolId]: _omit, ...rest }) => rest);
  };

  if (!isLoaded) return null;
  if (!isAdmin) return <AdminLogin />;

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-accent" />
            <h1 className="narcos-title text-3xl md:text-4xl font-bold text-secondary">
              Global Admin Console
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WorkshopTransfer />
            <Button onClick={logoutAdmin} variant="ghost" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TeamQrDialog team={qrTeam} onClose={() => setQrTeam(null)} />

        <Tabs defaultValue="teams" className="space-y-6">
          <TabsList className="bg-card border border-border max-w-full overflow-x-auto justify-start">
            <TabsTrigger value="teams" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="mr-2 h-4 w-4" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="rankings" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Trophy className="mr-2 h-4 w-4" />
              Rankings
            </TabsTrigger>
            <TabsTrigger value="phases" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Clock className="mr-2 h-4 w-4" />
              Phases
            </TabsTrigger>
            <TabsTrigger value="tools" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Wrench className="mr-2 h-4 w-4" />
              AI Tools
            </TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Settings className="mr-2 h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="negotiation" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Handshake className="mr-2 h-4 w-4" />
              Negotiation
            </TabsTrigger>
          </TabsList>

          {/* Teams Tab */}
          <TabsContent value="teams">
            <Card className="bg-card border-border p-6">
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold text-primary">
                  Manage Teams
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Scores are entered on the Rankings tab. Inactive teams are hidden from the rankings, dashboards and team codes.</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="font-display text-primary w-16">#</TableHead>
                      <TableHead className="font-display text-primary">Team</TableHead>
                      <TableHead className="font-display text-primary">Active</TableHead>
                      <TableHead className="font-display text-primary">Token</TableHead>
                      <TableHead className="font-display text-primary">PM / Crew</TableHead>
                      <TableHead className="font-display text-primary">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((team, index) => (
                      <TableRow key={team.id} className={`border-border ${team.status === 'active' ? '' : 'opacity-60'}`}>
                        <TableCell className="font-mono font-bold">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          {editingTeam === team.id ? (
                            <Input
                              value={teamDrafts[team.id]?.name ?? team.name}
                              onChange={(e) =>
                                setTeamDrafts((prev) => ({
                                  ...prev,
                                  [team.id]: {
                                    ...prev[team.id],
                                    name: e.target.value,
                                  },
                                }))
                              }
                              className="max-w-xs"
                            />
                          ) : (
                            <span className="font-medium">{team.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {/* Inactive teams are hidden from rankings, dashboards and team codes */}
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={team.status === 'active'}
                              onCheckedChange={(on) => updateTeam(team.id, { status: on ? 'active' : 'disabled' })}
                              aria-label={`${team.name} active`}
                            />
                            <span className="text-xs text-muted-foreground">{team.status === 'active' ? 'Active' : 'Inactive'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{team.token}</code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {/* Filled in by the team itself on its team page */}
                          <div className="font-medium">{team.pmName || <span className="text-muted-foreground">PM not set</span>}</div>
                          <div className="text-xs text-muted-foreground max-w-xs truncate" title={(team.members ?? []).join(', ')}>
                            {team.members?.length ? `${team.members.length} members: ${team.members.join(', ')}` : 'No members yet'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                editingTeam === team.id ? saveTeam(team.id) : startEditTeam(team)
                              }
                            >
                              {editingTeam === team.id ? 'Done' : 'Edit'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQrTeam(team)}
                              aria-label={`QR code for ${team.name}`}
                              className="border-secondary text-secondary"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Rankings Tab */}
          <TabsContent value="rankings">
            <RankingsAdmin />
          </TabsContent>

          {/* Phases Tab */}
          <TabsContent value="phases">
            <Card className="bg-card border-border p-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                <h2 className="font-display text-2xl font-bold text-primary">
                  Manage Phases
                </h2>
                <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={async () => {
                    for (const phase of phases) {
                      if (!(await updatePhase(phase.id, { status: 'inactive', startTime: null, endTime: null }))) return;
                    }
                    toast({ title: 'Phases Reset', description: 'All phases have been reset to inactive' });
                  }}
                  variant="outline" 
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  Reset All Phases
                </Button>
                </div>
              </div>

              {/* Phase navigation; previews unsaved edits of the phase being edited */}
              {mapPhases.length > 0 && (
                <PhaseMap
                  phases={mapPhases}
                  onSelect={jumpToPhase}
                  highlightId={editingPhase}
                  className="mb-6 rounded-lg border border-border bg-card/95 p-3 backdrop-blur-sm md:sticky md:top-20 md:z-40"
                />
              )}

              {/* Add New Phase (folded until opened) */}
              <Collapsible open={newPhaseOpen} onOpenChange={setNewPhaseOpen}>
              <Card className="bg-card border-primary/50 mb-6">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 p-4 text-left">
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primary">
                    <Plus className="h-5 w-5" /> Add New Phase
                  </h3>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Phase Name</Label>
                    <Input
                      placeholder="Phase Name"
                      value={newPhase.name}
                      onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                    />
                  </div>
                  <VoiceIntroInput
                    background={newPhase.background}
                    onChange={(value) => setNewPhase((prev) => ({ ...prev, background: value }))}
                  />
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Background</Label>
                    <RichTextEditor
                      placeholder="Background"
                      value={newPhase.background}
                      onChange={(value) => setNewPhase({ ...newPhase, background: value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Output</Label>
                    <RichTextEditor
                      placeholder="Output"
                      value={newPhase.output}
                      onChange={(value) => setNewPhase({ ...newPhase, output: value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Task</Label>
                    <RichTextEditor
                      placeholder="Task"
                      value={newPhase.task}
                      onChange={(value) => setNewPhase({ ...newPhase, task: value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Materials</Label>
                    <RichTextEditor
                      placeholder="Materials"
                      value={newPhase.materials}
                      onChange={(value) => setNewPhase({ ...newPhase, materials: value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Evaluation</Label>
                    <RichTextEditor
                      placeholder="How the phase turned out (same for all teams)"
                      value={newPhase.evaluation}
                      onChange={(value) => setNewPhase((prev) => ({ ...prev, evaluation: value }))}
                    />
                  </div>
                  <PhaseLearningsEditor
                    projectManagement={newPhase.learningsProjectManagement}
                    aiArsenal={newPhase.learningsAiArsenal}
                    visible={newPhase.learningsVisible}
                    onVisibilityChange={(value) => setNewPhase((prev) => ({ ...prev, learningsVisible: value }))}
                    onProjectManagementChange={(value) => setNewPhase((prev) => ({ ...prev, learningsProjectManagement: value }))}
                    onAiArsenalChange={(value) => setNewPhase((prev) => ({ ...prev, learningsAiArsenal: value }))}
                  />
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Cheat sheet</Label>
                    <p className="text-xs text-muted-foreground">Shown only on the unlisted /cheat page.</p>
                    <RichTextEditor value={newPhase.cheatSheet} onChange={(value) => setNewPhase((prev) => ({ ...prev, cheatSheet: value }))} placeholder="Cheat sheet" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Duration (minutes)</Label>
                      <Input
                        type="number"
                        placeholder="Duration (minutes)"
                        value={newPhase.durationMinutes === 0 ? '' : newPhase.durationMinutes}
                        onChange={(e) =>
                          setNewPhase({
                            ...newPhase,
                            durationMinutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Budget</Label>
                      <Input
                        type="number"
                        placeholder="Budget"
                        value={newPhase.budget === 0 ? '' : newPhase.budget}
                        onChange={(e) =>
                          setNewPhase({
                            ...newPhase,
                            budget: e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select Tools</Label>
                    <div className="grid md:grid-cols-2 gap-2 p-3 border border-border rounded-lg">
                      {tools.map((tool) => (
                        <div key={tool.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`new-tool-${tool.id}`}
                            checked={newPhase.tools.includes(tool.id)}
                            onCheckedChange={(checked) => {
                              setNewPhase({
                                ...newPhase,
                                tools: checked
                                  ? [...newPhase.tools, tool.id]
                                  : newPhase.tools.filter((t) => t !== tool.id)
                              });
                            }}
                          />
                          <label
                            htmlFor={`new-tool-${tool.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {tool.toolName}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleCreatePhase} className="bg-primary text-primary-foreground w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Phase
                  </Button>
                </div>
                </CollapsibleContent>
              </Card>
              </Collapsible>
              
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Total workshop time: <span className="font-mono text-foreground">{totalWorkshopMinutes(phases)} min</span>
                  {phaseBlocks.some((b) => b.parallel) && ' (parallel phases count once, by the longest phase)'}
                </p>
                {phases.sort((a, b) => a.order - b.order).map((phase, phaseIndex) => {
                  const isOpen = openPhases.has(phase.id) || editingPhase === phase.id;
                  const block = phaseBlocks.find((b) => b.phases.some((p) => p.id === phase.id));
                  const inParallel = !!block?.parallel;
                  const isLead = block?.id === phase.id;
                  return (
                  <Card key={phase.id} id={phaseAnchorId(phase.id)} className={`scroll-mt-24 md:scroll-mt-64 bg-card p-4 ${inParallel ? 'border-accent/60 border-l-4' : 'border-border'}`}>
                    {inParallel && isLead && block && (
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-mono text-accent">
                        <GitFork className="h-4 w-4" /> {PARALLEL_LABEL} · phases {blockNumbers(block)} · {blockDuration(block)} min · start/stop and voice intro are shared (stored on this phase); evaluation stays per phase
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePhaseOpen(phase.id)}
                        aria-expanded={isOpen}
                        className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        <span className="font-mono text-sm text-muted-foreground">{phaseIndex + 1}.</span>
                        <h3 className="min-w-0 truncate font-display text-base font-semibold group-hover:text-primary">{phase.name}</h3>
                        <span className="flex-shrink-0 font-mono text-xs text-muted-foreground">
                          {phase.durationMinutes} min
                          {phase.parallelWith && (
                            <span className="ml-2 text-accent">∥ {phases.find((p) => p.id === phase.parallelWith)?.name ?? '?'}</span>
                          )}
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={phase.status === 'running' ? 'default' : 'secondary'}
                          className={phase.status === 'running' ? 'bg-primary/20 text-primary border-primary' : ''}
                        >
                          {phase.status}
                        </Badge>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reorderPhase(phase.id, 'up')}
                            disabled={phase.order === 1}
                            className="border-secondary text-secondary"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reorderPhase(phase.id, 'down')}
                            disabled={phase.order === phases.length}
                            className="border-secondary text-secondary"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => (editingPhase === phase.id ? savePhase(phase.id) : startEditPhase(phase))}
                            >
                              {editingPhase === phase.id ? 'Done' : 'Edit'}
                            </Button>
                          {phase.status === 'running' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStopPhase(phase.id)}
                              className="border-destructive text-destructive"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartPhase(phase.id)}
                              className="border-primary text-primary"
                              disabled={phase.status === 'completed'}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePhase(phase.id)}
                            className="border-destructive text-destructive"
                            disabled={phase.status === 'running'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {isOpen && (
                    <div className="mt-4 border-t border-border pt-4">
                        {editingPhase === phase.id ? (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Phase Name</Label>
                              <Input
                                value={phaseDrafts[phase.id]?.name ?? phase.name}
                                onChange={(e) =>
                                  setPhaseDrafts((prev) => ({
                                    ...prev,
                                    [phase.id]: {
                                  ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                      name: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Phase name"
                              />
                            </div>
                            {(() => {
                              const draft = phaseDrafts[phase.id] ?? phaseDraftOf(phase);
                              const setDraft = (patch: Partial<typeof draft>) =>
                                setPhaseDrafts((prev) => ({ ...prev, [phase.id]: { ...(prev[phase.id] ?? phaseDraftOf(phase)), ...patch } }));
                              const candidates = [...phases].sort((a, b) => a.order - b.order).filter((p) => p.id !== phase.id);
                              const chosen = phases.find((p) => p.id === draft.parallelWith);
                              const takenBy = chosen?.parallelWith && chosen.parallelWith !== phase.id ? phases.find((p) => p.id === chosen.parallelWith) : undefined;
                              return (
                                <div className="space-y-2 rounded border border-border p-3">
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      id={`parallel-${phase.id}`}
                                      checked={draft.parallelOn}
                                      onCheckedChange={(checked) => setDraft({ parallelOn: checked === true })}
                                      className="mt-0.5"
                                    />
                                    <label htmlFor={`parallel-${phase.id}`} className="cursor-pointer">
                                      <span className="block text-sm font-medium">Run this in parallel with</span>
                                      <span className="block text-xs text-muted-foreground">
                                        Team splits in half. Both phases start and run together; each keeps its own evaluation. Only a neighbouring phase (directly before or after) can be chosen. Saved on both phases.
                                      </span>
                                    </label>
                                  </div>
                                  {draft.parallelOn && (
                                    <div className="pl-6 space-y-1">
                                      <Select value={draft.parallelWith || undefined} onValueChange={(value) => setDraft({ parallelWith: value })}>
                                        <SelectTrigger aria-label="Phase to run in parallel with" className="max-w-sm">
                                          <SelectValue placeholder="Select a phase" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {candidates.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                              {[...phases].sort((a, b) => a.order - b.order).findIndex((x) => x.id === p.id) + 1}. {p.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {takenBy && (
                                        <p className="text-xs text-accent">
                                          {chosen?.name} currently runs in parallel with {takenBy.name}; saving moves it to this phase.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            <VoiceIntroInput
                              background={phaseDrafts[phase.id]?.background ?? phase.background}
                              onChange={(value) =>
                                setPhaseDrafts((prev) => ({
                                  ...prev,
                                  [phase.id]: {
                                    ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                    background: value,
                                  },
                                }))
                              }
                            />
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Background</Label>
                              <RichTextEditor
                                value={phaseDrafts[phase.id]?.background ?? phase.background}
                                onChange={(value) =>
                                  setPhaseDrafts((prev) => ({
                                    ...prev,
                                    [phase.id]: {
                                  ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                      background: value,
                                    },
                                  }))
                                }
                                placeholder="Background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Output</Label>
                              <RichTextEditor
                                value={phaseDrafts[phase.id]?.output ?? phase.output}
                                onChange={(value) =>
                                  setPhaseDrafts((prev) => ({
                                    ...prev,
                                    [phase.id]: {
                                  ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                      output: value,
                                    },
                                  }))
                                }
                                placeholder="Output"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Task</Label>
                              <RichTextEditor
                                value={phaseDrafts[phase.id]?.task ?? phase.task}
                                onChange={(value) =>
                                  setPhaseDrafts((prev) => ({
                                    ...prev,
                                    [phase.id]: {
                                      ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                      task: value,
                                    },
                                  }))
                                }
                                placeholder="Task"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Materials</Label>
                              <RichTextEditor
                                value={phaseDrafts[phase.id]?.materials ?? phase.materials}
                                onChange={(value) =>
                                  setPhaseDrafts((prev) => ({
                                    ...prev,
                                    [phase.id]: {
                                      ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                      materials: value,
                                    },
                                  }))
                                }
                                placeholder="Materials"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Evaluation</Label>
                              <RichTextEditor
                                value={phaseDrafts[phase.id]?.evaluation ?? phase.evaluation}
                                onChange={(value) =>
                                  setPhaseDrafts((prev) => ({
                                    ...prev,
                                    [phase.id]: { ...(prev[phase.id] ?? phaseDraftOf(phase)), evaluation: value },
                                  }))
                                }
                                placeholder="How the phase turned out (same for all teams)"
                              />
                            </div>
                            <PhaseLearningsEditor
                              projectManagement={phaseDrafts[phase.id]?.learningsProjectManagement ?? phase.learningsProjectManagement}
                              aiArsenal={phaseDrafts[phase.id]?.learningsAiArsenal ?? phase.learningsAiArsenal}
                              visible={phaseDrafts[phase.id]?.learningsVisible ?? phase.learningsVisible}
                              onVisibilityChange={(value) => setPhaseDrafts((prev) => ({
                                ...prev,
                                [phase.id]: { ...(prev[phase.id] ?? phaseDraftOf(phase)), learningsVisible: value },
                              }))}
                              onProjectManagementChange={(value) => setPhaseDrafts((prev) => ({
                                ...prev,
                                [phase.id]: { ...(prev[phase.id] ?? phaseDraftOf(phase)), learningsProjectManagement: value },
                              }))}
                              onAiArsenalChange={(value) => setPhaseDrafts((prev) => ({
                                ...prev,
                                [phase.id]: { ...(prev[phase.id] ?? phaseDraftOf(phase)), learningsAiArsenal: value },
                              }))}
                            />
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Cheat sheet</Label>
                              <p className="text-xs text-muted-foreground">Shown only on the unlisted /cheat page.</p>
                              <RichTextEditor
                                value={phaseDrafts[phase.id]?.cheatSheet ?? phase.cheatSheet}
                                onChange={(value) => setPhaseDrafts((prev) => ({
                                  ...prev,
                                  [phase.id]: { ...(prev[phase.id] ?? phaseDraftOf(phase)), cheatSheet: value },
                                }))}
                                placeholder="Cheat sheet"
                              />
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-sm font-medium">Budget</Label>
                                <Input
                                  type="number"
                                  value={phaseDrafts[phase.id]?.budget ?? (phase.budget === 0 ? '' : phase.budget)}
                                  onChange={(e) =>
                                    setPhaseDrafts((prev) => ({
                                      ...prev,
                                      [phase.id]: {
                                        ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                        budget: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0,
                                      },
                                    }))
                                  }
                                  placeholder="Budget"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-sm font-medium">Duration (minutes)</Label>
                                <Input
                                  type="number"
                                  value={phaseDrafts[phase.id]?.durationMinutes ?? (phase.durationMinutes === 0 ? '' : phase.durationMinutes)}
                                  onChange={(e) =>
                                    setPhaseDrafts((prev) => ({
                                      ...prev,
                                      [phase.id]: {
                                        ...(prev[phase.id] ?? phaseDraftOf(phase)),
                                        durationMinutes: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0,
                                      },
                                    }))
                                  }
                                  placeholder="Duration (minutes)"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Linked Tools</Label>
                              <div className="grid md:grid-cols-2 gap-2 p-3 border border-border rounded-lg">
                                {tools.map((tool) => (
                                  <div key={tool.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`phase-${phase.id}-tool-${tool.id}`}
                                      checked={(phaseDrafts[phase.id]?.tools ?? phase.tools ?? []).includes(tool.id)}
                                      onCheckedChange={(checked) => {
                                        setPhaseDrafts((prev) => {
                                          const current = prev[phase.id] ?? phaseDraftOf(phase);
                                          const toolsArr = current.tools || [];
                                          const nextTools = checked
                                            ? [...toolsArr, tool.id]
                                            : toolsArr.filter((t) => t !== tool.id);
                                          return { ...prev, [phase.id]: { ...current, tools: nextTools } };
                                        });
                                      }}
                                    />
                                    <label
                                      htmlFor={`phase-${phase.id}-tool-${tool.id}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                      {tool.toolName}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div 
                              className="text-muted-foreground text-sm prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-1" 
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(phase.background) }}
                            />
                            {phase.output && (
                              <div 
                                className="text-muted-foreground text-sm mt-2 prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-1" 
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(phase.output) }}
                              />
                            )}
                          </>
                        )}
                    </div>
                    )}
                  </Card>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools">
            <Card className="bg-card border-border p-6">
              <h2 className="font-display text-2xl font-bold text-primary mb-6">
                Manage AI Tools
              </h2>
              
              {/* Add New Tool */}
              <Card className="bg-card border-primary/50 p-4 mb-6">
                <h3 className="font-display text-lg font-bold text-primary mb-3">Add New Tool</h3>
                <div className="grid md:grid-cols-5 gap-3">
                  <Input
                    placeholder="Tool Name"
                    value={newTool.toolName}
                    onChange={(e) => setNewTool({ ...newTool, toolName: e.target.value })}
                  />
                  <Input
                    placeholder="Description"
                    value={newTool.description}
                    onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                  />
                  <Input
                    placeholder="URL"
                    value={newTool.linkUrl}
                    onChange={(e) => setNewTool({ ...newTool, linkUrl: e.target.value })}
                  />
                  <Input
                    placeholder="Logo URL"
                    value={newTool.logoUrl}
                    onChange={(e) => setNewTool({ ...newTool, logoUrl: e.target.value })}
                  />
                  {toolCategorySelect(newTool.category, (category) => setNewTool({ ...newTool, category }))}
                </div>
                <Button onClick={handleCreateTool} className="bg-primary text-primary-foreground w-full mt-3">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tool
                </Button>
              </Card>

              <div className="space-y-3">
                {tools.sort((a, b) => a.displayOrder - b.displayOrder).map((tool, index) => (
                  <Card key={tool.id} className="bg-card border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reorderTool(tool.id, 'up')}
                            disabled={index === 0}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reorderTool(tool.id, 'down')}
                            disabled={index === tools.length - 1}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex-1">
                          {editingTool === tool.id ? (
                            <div className="space-y-2">
                              <Input
                                value={toolDrafts[tool.id]?.toolName ?? tool.toolName}
                                onChange={(e) => updateToolDraft(tool, 'toolName', e.target.value)}
                                placeholder="Tool Name"
                              />
                              <Input
                                value={toolDrafts[tool.id]?.description ?? tool.description}
                                onChange={(e) => updateToolDraft(tool, 'description', e.target.value)}
                                placeholder="Description"
                              />
                              <Input
                                value={toolDrafts[tool.id]?.linkUrl ?? tool.linkUrl}
                                onChange={(e) => updateToolDraft(tool, 'linkUrl', e.target.value)}
                                placeholder="URL"
                              />
                              <Input
                                value={toolDrafts[tool.id]?.logoUrl ?? tool.logoUrl}
                                onChange={(e) => updateToolDraft(tool, 'logoUrl', e.target.value)}
                                placeholder="Logo URL"
                              />
                              {toolCategorySelect(toolDrafts[tool.id]?.category ?? tool.category, (category) =>
                                updateToolDraft(tool, 'category', category),
                              )}
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              {tool.logoUrl && (
                                <img 
                                  src={tool.logoUrl} 
                                  alt={`${tool.toolName} logo`}
                                  className="w-10 h-10 object-contain rounded-lg flex-shrink-0"
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-display font-bold">{tool.toolName}</h4>
                                  <Badge variant={toolCategoryName(tool.category) ? 'outline' : 'secondary'} className="text-xs">
                                    {toolCategoryName(tool.category) ?? UNCATEGORISED_LABEL}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{tool.description}</p>
                                <a
                                  href={tool.linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-secondary hover:underline"
                                >
                                  {tool.linkUrl}
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => (editingTool === tool.id ? saveTool(tool.id) : startEditTool(tool))}
                        >
                          {editingTool === tool.id ? 'Done' : 'Edit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTool(tool.id)}
                          className="border-destructive text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content">
            <Card className="bg-card border-border p-6">
              <h2 className="font-display text-2xl font-bold text-primary mb-6">
                Manage Page Content
              </h2>
              <div className="space-y-3">
                {contentSections.map((section) => (
                  <Fragment key={section.id}>
                    <FoldCard
                      title={CONTENT_LABELS[section.pageKey]}
                      badge={
                        <Badge variant={section.enabled ? 'default' : 'secondary'}>
                          {section.pageKey === 'learnings' ? (section.enabled ? 'In menu' : 'Hidden') : section.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      }
                    >
                      {section.pageKey === 'learnings' ? (
                        // The Learnings page is built from each phase's published learnings; this only shows/hides it
                        <label className="flex items-center justify-between gap-4">
                          <span>
                            <span className="block font-semibold">Show in main menu</span>
                            <span className="block text-sm text-muted-foreground">
                              Learnings content is edited per phase (Phases tab) and shown once its phase is published.
                            </span>
                          </span>
                          <Switch
                            aria-label="Show Learnings page in main menu"
                            checked={section.enabled}
                            onCheckedChange={(enabled) => updateSection(section.id, { enabled })}
                          />
                        </label>
                      ) : (<>
                      <RichTextEditor
                        value={sectionDrafts[section.id] ?? section.contentRTF}
                        onChange={(val) => setSectionDrafts((prev) => ({ ...prev, [section.id]: val }))}
                        placeholder="Section content (HTML)"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const content = sectionDrafts[section.id] ?? section.contentRTF;
                            if (!(await updateSection(section.id, { contentRTF: content }))) return;
                            toast({ title: 'Content Saved', description: 'Section content updated' });
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSection(section.id, { enabled: !section.enabled })}
                        >
                          {section.enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                      </>)}
                    </FoldCard>
                    {section.pageKey === 'aiTools' && (
                      <FoldCard title="AI Arsenal – Categories">
                        <p className="text-sm text-muted-foreground">
                          The categories are fixed. Arrows set the order on the AI Arsenal page; the text tells the reader what each group is for.
                        </p>
                        <div className="space-y-4">
                          {sortedToolCategories.map((category, index) => (
                            <div key={category.id} className="flex gap-3">
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => reorderToolCategory(category.id, 'up')}
                                  disabled={index === 0}
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => reorderToolCategory(category.id, 'down')}
                                  disabled={index === sortedToolCategories.length - 1}
                                  className="h-6 w-6 p-0"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex-1 space-y-2">
                                <h4 className="font-display font-bold">{category.name}</h4>
                                <RichTextEditor
                                  value={categoryDrafts[category.id] ?? category.description}
                                  onChange={(val) => setCategoryDrafts((prev) => ({ ...prev, [category.id]: val }))}
                                  placeholder="What can the reader use these tools for?"
                                />
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const description = categoryDrafts[category.id] ?? category.description;
                                    if (!(await updateToolCategoryDescription(category.id, description))) return;
                                    toast({ title: 'Category Saved', description: `${category.name} text updated` });
                                  }}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </FoldCard>
                    )}
                  </Fragment>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="negotiation">
            <NegotiationAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GlobalAdmin;
