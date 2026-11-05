import { useEffect, useState } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { negotiationApi, publicTeamCodes } from '@/lib/api';
import { EXPECTED_API_VERSION, REDEPLOY_PROMPT } from '@/lib/negotiation';

type Status = { name: string; version: string | null; error?: string };

/**
 * Warns when a deployed edge function runs older code than this frontend.
 * Lovable syncs function code from GitHub but does not redeploy it by itself.
 */
const BackendStatus = ({ adminVersion }: { adminVersion?: string }) => {
  const { toast } = useToast();
  const [others, setOthers] = useState<Status[] | null>(null);

  useEffect(() => {
    let alive = true;
    const probe = async (name: string, call: () => Promise<{ api_version?: string }>): Promise<Status> => {
      try {
        const res = await call();
        return { name, version: res.api_version ?? null };
      } catch (err) {
        return { name, version: null, error: err instanceof Error ? err.message : String(err) };
      }
    };
    Promise.all([
      probe('negotiation-api', () => negotiationApi<{ api_version?: string }>('version', '')),
      probe('team-codes', () => publicTeamCodes()),
    ]).then((list) => alive && setOthers(list));
    return () => {
      alive = false;
    };
  }, []);

  if (!others) return null;
  const all: Status[] = [{ name: 'admin-api', version: adminVersion ?? null }, ...others];
  const outdated = all.filter((s) => s.version !== EXPECTED_API_VERSION);
  if (!outdated.length) return null;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(REDEPLOY_PROMPT);
      toast({ title: 'Prompt copied', description: 'Paste it into the Lovable chat.' });
    } catch {
      toast({ title: 'Copy failed', description: REDEPLOY_PROMPT, variant: 'destructive' });
    }
  };

  return (
    <Card className="mb-4 border-accent/60 bg-accent/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-accent">Backend functions are out of date</p>
          <p className="text-muted-foreground">
            The site was updated, but these edge functions still run older code, so some features (e.g. Reset all, the special-offer fix, team codes) do not work yet:
          </p>
          <ul className="list-disc pl-5 font-mono text-xs">
            {outdated.map((s) => (
              <li key={s.name}>
                {s.name}: {s.version ? `version ${s.version}` : s.error && /not found|404/i.test(s.error) ? 'not deployed' : 'older version'} (expected {EXPECTED_API_VERSION})
              </li>
            ))}
          </ul>
          <p>
            In Lovable, ask: <span className="font-mono text-xs">"{REDEPLOY_PROMPT}"</span>
          </p>
          <Button size="sm" variant="outline" onClick={copyPrompt}>
            <Copy className="mr-2 h-4 w-4" /> Copy prompt
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default BackendStatus;
