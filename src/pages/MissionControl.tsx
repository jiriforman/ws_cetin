import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Crosshair, GitFork, Maximize, Minimize, PlayCircle, Trophy } from 'lucide-react';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { sanitizeHtml } from '@/lib/sanitize';
import { setVoiceIntro } from '@/lib/voiceIntro';
import { computeStandings, formatUsd, rankMovement, scoredPhases, scoringLabel } from '@/lib/rankings';
import {
  blockEndTime,
  blockName,
  blockNumbers,
  blockStatus,
  groupPhaseBlocks,
  PARALLEL_LABEL,
  type PhaseBlock,
} from '@/lib/phaseBlocks';
import narcosLogo from '@/assets/narcos-logo.png';
import type { Phase } from '@/lib/workshopData';

const RICH =
  'prose prose-invert max-w-none text-[1.05rem] leading-relaxed lg:text-[1.35rem] text-secondary/90 [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold [&_iframe]:hidden [&_audio]:hidden [&_.video-embed]:hidden';

const isEmptyHTML = (html: string) => !html || !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

const pad = (n: number) => String(n).padStart(2, '0');
const WORLD_CLOCKS = [
  { label: 'Brasil (Rio)', zone: 'America/Sao_Paulo' },
  { label: 'HQ', zone: 'Europe/Prague' },
];

const formatClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};

/** Current time, ticking every second (drives the countdown and the clock). */
const useNow = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

const useFullscreen = () => {
  const [isFull, setIsFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return { isFull, toggle };
};

const Panel = ({ title, icon, children, className = '' }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`flex min-h-0 flex-col rounded-xl border border-border bg-card/70 p-5 backdrop-blur ${className}`}>
    <h2 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

/** Briefing + task of one phase (voice intro and embedded players are left out on the big screen). */
const MissionBrief = ({ phase, number, showName }: { phase: Phase; number: number; showName: boolean }) => {
  const background = setVoiceIntro(phase.background, '');
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {showName && (
        <h3 className="font-display text-xl font-bold text-primary">
          <span className="mr-2 font-mono text-muted-foreground">{number}.</span>
          {phase.name}
        </h3>
      )}
      <div className="mission-scroll min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
        {!isEmptyHTML(background) && (
          <div>
            <h4 className="mb-1 font-mono text-xs uppercase tracking-widest text-primary">Briefing</h4>
            <div className={RICH} dangerouslySetInnerHTML={{ __html: sanitizeHtml(background) }} />
          </div>
        )}
        {!isEmptyHTML(phase.task) && (
          <div>
            <h4 className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Your task</h4>
            <div className={RICH} dangerouslySetInnerHTML={{ __html: sanitizeHtml(phase.task) }} />
          </div>
        )}
        {!isEmptyHTML(phase.output) && (
          <div>
            <h4 className="mb-1 font-mono text-xs uppercase tracking-widest text-secondary">Deliverable</h4>
            <div className={RICH} dangerouslySetInnerHTML={{ __html: sanitizeHtml(phase.output) }} />
          </div>
        )}
      </div>
    </div>
  );
};

const Countdown = ({ block, now }: { block: PhaseBlock; now: number }) => {
  const end = blockEndTime(block);
  const starts = block.phases.map((p) => p.startTime).filter((t): t is string => !!t).map((t) => new Date(t).getTime());
  if (!end) return null;
  const endMs = new Date(end).getTime();
  const startMs = starts.length ? Math.min(...starts) : endMs;
  const left = Math.max(0, endMs - now);
  const total = Math.max(1, endMs - startMs);
  const progress = Math.min(100, ((total - left) / total) * 100);
  const tone = left === 0 ? 'text-destructive' : left < 60_000 ? 'text-destructive animate-pulse' : left < 300_000 ? 'text-accent' : 'text-primary';
  const bar = left < 60_000 ? 'bg-destructive' : left < 300_000 ? 'bg-accent' : 'bg-primary';
  return (
    <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
      <span className={`font-condensed text-5xl font-extrabold tabular-nums tracking-wide sm:text-6xl ${tone}`} role="timer" aria-label="Time remaining">
        {left === 0 ? "TIME'S UP" : formatClock(left)}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted sm:w-64" aria-hidden="true">
        <div className={`h-full transition-[width] duration-1000 ease-linear ${bar}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

const ActiveMission = ({ blocks, now }: { blocks: PhaseBlock[]; now: number }) => {
  const running = blocks.find((b) => blockStatus(b) === 'running');
  const next = blocks.find((b) => blockStatus(b) === 'inactive');
  const block = running ?? next;
  const allDone = blocks.length > 0 && blocks.every((b) => blockStatus(b) === 'completed');

  if (!block) {
    return (
      <Panel title="Active mission" icon={<Crosshair className="h-4 w-4 text-primary" />} className="flex-1">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <CheckCircle2 className="h-16 w-16 text-primary" />
          <p className="font-display text-4xl text-secondary">{allDone ? 'All missions completed' : 'No missions planned'}</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={running ? 'Active mission' : 'Next mission – standing by'}
      icon={running ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" /> : <Circle className="h-4 w-4" />}
      className={`flex-1 ${running ? 'border-primary/60 shadow-[0_0_40px_hsl(var(--primary)/0.15)]' : ''}`}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm text-muted-foreground">
            Mission {blockNumbers(block)} / {blocks.reduce((n, b) => Math.max(n, ...b.numbers), 0)}
          </p>
          <h3 className="narcos-title break-words text-3xl sm:text-5xl font-bold text-secondary">{blockName(block)}</h3>
          {block.parallel && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-dashed border-accent/70 bg-accent/10 px-3 py-0.5 text-sm text-accent">
              <GitFork className="h-4 w-4" /> {PARALLEL_LABEL}
            </p>
          )}
        </div>
        {running ? (
          <Countdown block={block} now={now} />
        ) : (
          <span className="font-mono text-2xl text-muted-foreground">
            {Math.max(0, ...block.phases.map((p) => p.durationMinutes || 0))} min
          </span>
        )}
      </div>
      <div className={`flex min-h-0 flex-1 gap-6 ${block.parallel ? 'flex-col xl:flex-row' : ''}`}>
        {block.phases.map((p, i) => (
          <MissionBrief key={p.id} phase={p} number={block.numbers[i]} showName={block.parallel} />
        ))}
      </div>
    </Panel>
  );
};

const MissionTimeline = ({ blocks }: { blocks: PhaseBlock[] }) => {
  const done = blocks.filter((b) => blockStatus(b) === 'completed').length;
  const pct = blocks.length ? (done / blocks.length) * 100 : 0;
  return (
    <Panel title={`Mission status · ${done}/${blocks.length} completed`}>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <ol className="flex flex-wrap gap-2">
        {blocks.map((b) => {
          const status = blockStatus(b);
          const Icon = status === 'completed' ? CheckCircle2 : status === 'running' ? PlayCircle : Circle;
          return (
            <li
              key={b.id}
              title={`${blockNumbers(b)}. ${blockName(b)} · ${status}`}
              className={`flex max-w-[16rem] items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                status === 'running'
                  ? 'border-primary bg-primary/15 text-primary shadow-[0_0_16px_hsl(var(--primary)/0.4)]'
                  : status === 'completed'
                    ? 'border-border bg-muted/40 text-muted-foreground'
                    : 'border-dashed border-border text-secondary/80'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${status === 'running' ? 'animate-pulse' : ''}`} />
              <span className="whitespace-nowrap font-mono text-xs opacity-70">{blockNumbers(b)}</span>
              <span className="truncate">{blockName(b)}</span>
              {b.parallel && <GitFork className="h-3.5 w-3.5 flex-shrink-0 text-accent" aria-label="parallel" />}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
};

const MEDAL = ['text-accent', 'text-secondary', 'text-orange-400'];

const Leaderboard = () => {
  const { teams, phases, startingBudget, rankingEntries } = useWorkshop();
  const standings = computeStandings(teams, rankingEntries, startingBudget);
  const movement = rankMovement(teams, rankingEntries, startingBudget, phases);
  const scored = scoredPhases(phases, rankingEntries);
  const latest = scored[scored.length - 1];
  const balances = standings.map((s) => s.balance);
  const max = Math.max(1, ...balances);
  const min = Math.min(0, ...balances);

  return (
    <Panel title="Cartel rankings" icon={<Trophy className="h-4 w-4 text-accent" />} className="h-full">
      {latest && (
        <p className="-mt-1 mb-3 font-mono text-xs text-muted-foreground">
          Last scored: <span className="text-secondary">{scoringLabel(latest, phases)}</span>
        </p>
      )}
      {!standings.length ? (
        <p className="m-auto text-muted-foreground">No active teams yet.</p>
      ) : (
        <ol className="flex min-h-0 flex-1 flex-col gap-2">
          {standings.map(({ team, rank, balance, impacts }) => {
            const move = movement[team.id] ?? 0;
            const last = latest ? impacts[latest.id] : undefined;
            const top = rank <= 3;
            return (
              <li
                key={team.id}
                className={`relative flex max-h-24 min-h-[3rem] flex-1 items-center gap-3 overflow-hidden rounded-lg border px-3 transition-all duration-700 ${
                  rank === 1 ? 'border-accent/70 bg-accent/10 shadow-[0_0_24px_hsl(var(--accent)/0.25)]' : 'border-border bg-background/40'
                }`}
              >
                {/* balance bar behind the row */}
                <div
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 ${rank === 1 ? 'bg-accent/10' : 'bg-primary/10'} transition-[width] duration-1000`}
                  style={{ width: `${((balance - min) / (max - min || 1)) * 100}%` }}
                />
                <span className={`relative w-10 text-center font-display text-3xl font-bold ${top ? MEDAL[rank - 1] : 'text-muted-foreground'}`}>
                  {rank}
                </span>
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt="" className="relative h-12 w-12 flex-shrink-0 rounded-lg border border-primary/40 bg-muted object-cover" />
                ) : (
                  <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <span className={`relative min-w-0 flex-1 truncate font-display text-2xl ${rank === 1 ? 'text-accent' : 'text-secondary'}`}>
                  {team.name}
                </span>
                {move !== 0 && (
                  <span
                    className={`relative flex items-center font-mono text-sm ${move > 0 ? 'text-green-500' : 'text-destructive'}`}
                    aria-label={move > 0 ? `up ${move}` : `down ${-move}`}
                  >
                    {move > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    {Math.abs(move)}
                  </span>
                )}
                <span className="relative flex flex-col items-end">
                  <span className="font-mono text-xl font-bold tabular-nums text-secondary">{formatUsd(balance)}</span>
                  {last !== undefined && (
                    <span className={`font-mono text-xs tabular-nums ${last > 0 ? 'text-green-500' : last < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatUsd(last, true)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
};

/** Link-only big-screen dashboard (no menu entry, noindex): active mission, mission status and live rankings. */
export default function MissionControl() {
  const { phases, isLoaded } = useWorkshop();
  const now = useNow();
  const { isFull, toggle } = useFullscreen();

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Mission Control · NARCOS';
    return () => {
      meta.remove();
      document.title = title;
    };
  }, []);

  if (!isLoaded) return <div className="flex h-screen items-center justify-center text-muted-foreground" role="status">Loading…</div>;
  const blocks = groupPhaseBlocks(phases);

  return (
    <main className="relative flex min-h-screen flex-col gap-4 overflow-hidden bg-background p-4 lg:h-screen lg:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
      <header className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={narcosLogo} alt="NARCOS" className="hidden h-12 w-auto opacity-90 sm:block" />
          <h1 className="narcos-title text-xl text-primary text-glow sm:text-3xl">Mission Control</h1>
        </div>
        <div className="flex items-center gap-4">
          {WORLD_CLOCKS.map(({ label, zone }) => (
            <div key={zone} className="rounded-lg border border-border bg-card/60 px-3 py-1 text-right">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground sm:text-xs">Current time: {label}</p>
              <p className="font-condensed text-2xl font-extrabold tabular-nums text-secondary sm:text-4xl">
                {new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone })}
              </p>
            </div>
          ))}
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label={isFull ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFull ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFull ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-h-[28rem] flex-col gap-4 lg:min-h-0">
          <ActiveMission blocks={blocks} now={now} />
          <MissionTimeline blocks={blocks} />
        </div>
        <Leaderboard />
      </div>
    </main>
  );
}
