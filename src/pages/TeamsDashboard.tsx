import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { Trophy, TrendingUp, ChevronDown, ChevronUp, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { publicTeamCodes } from '@/lib/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { sanitizeHtml } from '@/lib/sanitize';
import { computeStandings, formatUsd, scoredPhases, scoringLabel } from '@/lib/rankings';

/** Copies text, also where the async clipboard API is unavailable (plain http, old browsers). */
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
};

const TeamsDashboard = () => {
  const { teams, phases, sections, startingBudget, rankingEntries } = useWorkshop();
  const { toast } = useToast();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Team codes for copy & paste into the supplier portal (admins already have them)
  const teamIds = teams.map((t) => t.id).join(',');
  useEffect(() => {
    let alive = true;
    publicTeamCodes()
      .then(({ codes: list }) => alive && setCodes(Object.fromEntries(list.map((c) => [c.id, c.token]))))
      .catch(() => alive && setCodes({}));
    return () => {
      alive = false;
    };
  }, [teamIds]);
  const codeOf = (team: { id: string; token?: string }) => team.token || codes[team.id] || '';

  const copyCode = async (teamId: string, code: string, name: string) => {
    if (await copyText(code)) {
      setCopiedId(teamId);
      setTimeout(() => setCopiedId((id) => (id === teamId ? null : id)), 1500);
      toast({ title: 'Team code copied', description: `${name}: ${code}` });
    } else {
      toast({ title: 'Copy failed', description: 'Select the code and copy it manually.', variant: 'destructive' });
    }
  };
  
  const standings = computeStandings(teams, rankingEntries, startingBudget);
  const showCodes = standings.some((s) => codeOf(s.team));
  const phaseColumns = scoredPhases(phases, rankingEntries);

  const sectionContent = sections.find((s) => s.pageKey === 'teamsDashboard')?.contentRTF || '';

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center space-x-2 mb-4">
            <Trophy className="h-8 w-8 text-accent" />
            <h1 className="narcos-title text-4xl font-bold text-secondary">
              Cartel Rankings
            </h1>
          </div>
          
          {sectionContent && (
            <Collapsible
              open={isDescriptionExpanded}
              onOpenChange={setIsDescriptionExpanded}
              className="max-w-3xl mx-auto"
            >
              <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mx-auto">
                <span className="text-sm font-medium">
                  RANKING DETAILS
                </span>
                {isDescriptionExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div
                  className="text-muted-foreground text-lg prose prose-invert max-w-none mx-auto mt-4 [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(sectionContent) }}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <Card className="bg-card border-border p-6 mb-8">
          <div className="flex items-center space-x-2 text-muted-foreground mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-mono font-bold">
              Calculation Logic
            </span>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-mono">
              Balance (USD) = Start budget + gains and losses of every phase
            </p>
            <p>Teams are ranked by their current balance, highest first. All amounts are in US dollars.</p>
          </div>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-display text-primary w-8 px-2">#</TableHead>
                  <TableHead className="font-display text-primary px-2 sm:min-w-[120px]">Team</TableHead>
                  {showCodes && <TableHead className="font-display text-primary px-2 whitespace-nowrap sm:min-w-[140px]">
                      <span className="sm:hidden">Code</span>
                      <span className="hidden sm:inline">Team code</span>
                    </TableHead>}
                  <TableHead className="hidden sm:table-cell font-display text-primary text-right px-2 whitespace-nowrap">Start</TableHead>
                  {phaseColumns.map((phase) => (
                    <TableHead key={phase.id} className="hidden sm:table-cell font-display text-primary text-right px-2 min-w-[90px]">
                      {scoringLabel(phase, phases)}
                    </TableHead>
                  ))}
                  <TableHead className="font-display text-primary text-right px-2 whitespace-nowrap font-bold">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map(({ team, rank, balance, impacts }) => {
                  const isLeader = rank === 1;
                  
                  return (
                    <TableRow
                      key={team.id}
                      className={`border-border transition-all ${
                        isLeader
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-card'
                      }`}
                    >
                      <TableCell className="font-mono font-bold px-2 py-2">
                        {isLeader ? (
                          <span className="text-accent text-glow text-base">
                            {rank}
                          </span>
                        ) : (
                          <span className="text-xs">{rank}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          {team.logoUrl ? (
                            <img
                              src={team.logoUrl}
                              alt={team.name}
                              className="h-6 w-6 rounded object-cover border border-primary/50 flex-shrink-0"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded bg-muted border border-border flex items-center justify-center flex-shrink-0">
                              <Trophy className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className={`text-sm truncate max-w-[8rem] sm:max-w-none ${isLeader ? 'text-primary font-bold' : ''}`}>
                            {team.name}
                          </span>
                        </div>
                      </TableCell>
                      {showCodes && (
                        <TableCell className="px-2 py-2">
                          {codeOf(team) && (
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <code className="hidden sm:inline select-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{codeOf(team)}</code>
                              <button
                                type="button"
                                onClick={() => copyCode(team.id, codeOf(team), team.name)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                                aria-label={`Copy team code of ${team.name}`}
                                title="Copy team code"
                              >
                                {copiedId === team.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              <a
                                href={`${window.location.origin}/team/${encodeURIComponent(codeOf(team))}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                                aria-label={`Open the team page of ${team.name}`}
                                title={`${window.location.origin}/team/${codeOf(team)}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="hidden sm:table-cell text-right font-mono text-xs px-2 py-2 whitespace-nowrap">
                        {formatUsd(startingBudget)}
                      </TableCell>
                      {phaseColumns.map((phase) => {
                        const amount = impacts[phase.id];
                        return (
                          <TableCell
                            key={phase.id}
                            className={`hidden sm:table-cell text-right font-mono text-xs px-2 py-2 whitespace-nowrap ${
                              amount > 0 ? 'text-green-500' : amount < 0 ? 'text-destructive' : 'text-muted-foreground'
                            }`}
                          >
                            {amount === undefined ? '–' : formatUsd(amount, true)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-mono font-bold text-accent text-sm px-2 py-2 whitespace-nowrap">
                        {formatUsd(balance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default TeamsDashboard;
