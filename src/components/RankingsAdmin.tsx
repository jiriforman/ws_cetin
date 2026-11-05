import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { useToast } from '@/hooks/use-toast';
import { computeStandings, formatUsd, parseUsd, scoringLabel, scoringPhases } from '@/lib/rankings';
import { blockOf } from '@/lib/phaseBlocks';
import { ExternalLink, RotateCcw, Trophy } from 'lucide-react';

/** Amount input that saves on Enter / leaving the field. Empty = not recorded. */
const AmountCell = ({
  value,
  onSave,
  allowEmpty = true,
  label,
}: {
  value: number | undefined;
  onSave: (amount: number | null) => Promise<boolean>;
  allowEmpty?: boolean;
  label: string;
}) => {
  const shown = value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Follow changes made elsewhere (another facilitator, reset) while not being edited
  useEffect(() => setDraft(shown), [shown]);

  const commit = async () => {
    const amount = parseUsd(draft);
    if (amount === null ? shown === '' : amount === value) return setDraft(shown);
    if (Number.isNaN(amount) || (amount === null && !allowEmpty)) {
      toast({ title: 'Invalid amount', description: 'Enter a whole number of US dollars, e.g. -10000, 0 or 5000.', variant: 'destructive' });
      return setDraft(shown);
    }
    setSaving(true);
    const saved = await onSave(amount);
    setSaving(false);
    if (!saved) setDraft(shown);
  };

  const parsed = parseUsd(draft);
  const tone = parsed === null || Number.isNaN(parsed) ? '' : parsed > 0 ? 'text-green-500' : parsed < 0 ? 'text-destructive' : '';

  return (
    <Input
      inputMode="numeric"
      value={draft}
      disabled={saving}
      placeholder="–"
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(shown);
      }}
      className={`h-8 w-28 text-right font-mono text-sm ml-auto ${tone}`}
    />
  );
};

const RankingsAdmin = () => {
  const { teams, phases, startingBudget, rankingEntries, setStartingBudget, setRankingEntry, resetRankings } = useWorkshop();
  const { toast } = useToast();

  // One row per phase; parallel phases share one row (joint evaluation)
  const sortedPhases = scoringPhases(phases);
  const standings = computeStandings(teams, rankingEntries, startingBudget);
  const columns = [...standings].sort((a, b) => a.team.name.localeCompare(b.team.name));

  const handleReset = async () => {
    if (!(await resetRankings())) return;
    toast({ title: 'Rankings reset', description: 'The leaderboard is empty. Enter the starting budget for the new game.' });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-primary">Cartel Rankings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              All amounts in USD. Balance = Start + the gain (+), loss (−) or 0 of every phase. Changes save when you leave a
              field or press Enter and appear on the leaderboard immediately. Clear a field to mark a phase as not recorded.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-secondary text-secondary">
              <Link to="/teams" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open leaderboard
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset rankings
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the rankings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you really want to reset the rankings? The starting budget and all recorded phase amounts of every team
                    will be deleted. The data cannot be restored.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 border border-border rounded-lg max-w-md">
          <Label className="text-sm font-medium whitespace-nowrap">Start budget (same for all teams)</Label>
          <AmountCell
            label="Start budget"
            value={startingBudget}
            allowEmpty={false}
            onSave={async (amount) => {
              if (amount === null || amount < 0) {
                toast({ title: 'Invalid amount', description: 'The starting budget cannot be negative.', variant: 'destructive' });
                return false;
              }
              return setStartingBudget(amount);
            }}
          />
        </div>
      </Card>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-display text-primary min-w-[160px]">Phase</TableHead>
                {columns.map(({ team }) => (
                  <TableHead key={team.id} className="font-display text-primary text-right min-w-[130px]">
                    {team.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-border">
                <TableCell className="font-medium">Start</TableCell>
                {columns.map(({ team }) => (
                  <TableCell key={team.id} className="text-right font-mono text-sm text-muted-foreground">
                    {formatUsd(startingBudget)}
                  </TableCell>
                ))}
              </TableRow>
              {sortedPhases.map((phase) => (
                <TableRow key={phase.id} className="border-border">
                  <TableCell className="font-medium">
                    {scoringLabel(phase, phases)}
                    {blockOf(phases, phase.id)?.parallel && <span className="ml-2 text-xs text-accent">(parallel, joint)</span>}
                    {blockOf(phases, phase.id)?.phases.some((p) => p.status === 'running') && <span className="ml-2 text-xs text-primary">(running)</span>}
                  </TableCell>
                  {columns.map(({ team, impacts }) => (
                    <TableCell key={team.id} className="text-right py-1">
                      <AmountCell
                        label={`${scoringLabel(phase, phases)} – ${team.name}`}
                        value={impacts[phase.id]}
                        onSave={(amount) => setRankingEntry(team.id, phase.id, amount)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="border-border bg-primary/5 hover:bg-primary/5">
                <TableCell className="font-display font-bold text-primary">Current balance</TableCell>
                {columns.map(({ team, balance, rank }) => (
                  <TableCell key={team.id} className="text-right font-mono font-bold text-accent whitespace-nowrap">
                    {formatUsd(balance)}
                    <div className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1 ml-2">
                      {rank === 1 && <Trophy className="h-3 w-3 text-accent" />}#{rank}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {columns.length === 0 && <p className="p-6 text-sm text-muted-foreground">No active teams.</p>}
      </Card>
    </div>
  );
};

export default RankingsAdmin;
