import { useEffect } from 'react';
import { useWorkshop } from '@/contexts/WorkshopContext';
import LearningContent from '@/components/LearningContent';
import PhaseMap from '@/components/PhaseMap';
import { phaseAnchorId } from '@/lib/phaseBlocks';

/** Unlisted page (no menu entry): phase map plus each phase's cheat sheet and published learnings. */
export default function CheatSheet() {
  const { phases, isLoaded } = useWorkshop();

  // Keep the link-only page out of search results.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  if (!isLoaded) return <div className="container mx-auto px-4 py-12 text-muted-foreground" role="status">Loading…</div>;
  const sorted = [...phases].sort((a, b) => a.order - b.order);

  return (
    <main className="container mx-auto px-4 py-6 md:py-12">
      <h1 className="mb-4 font-display text-2xl font-bold text-secondary md:mb-6 md:text-4xl">Cheat Sheet</h1>
      {!sorted.length ? <p className="text-muted-foreground">No phases yet.</p> : (
        <>
          <PhaseMap phases={sorted} className="mb-6 md:mb-8" />

          <div className="space-y-4 md:space-y-6">
            {sorted.map((phase, i) => (
              <section key={phase.id} id={phaseAnchorId(phase.id)} className="scroll-mt-24 rounded-lg border border-border bg-card p-4 md:p-5">
                <h2 className="mb-3 break-words font-display text-xl font-bold text-foreground md:mb-4 md:text-2xl">
                  <span className="mr-2 font-mono text-base text-muted-foreground">{i + 1}.</span>{phase.name}
                </h2>
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-primary">Cheat sheet</h3>
                    <LearningContent html={phase.cheatSheet} />
                  </div>
                  {phase.learningsVisible && (
                    <div className="border-t border-border pt-4">
                      <h3 className="mb-3 text-sm font-semibold text-primary">Learnings</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div><h4 className="mb-2 font-semibold text-secondary">Project management</h4><LearningContent html={phase.learningsProjectManagement} /></div>
                        <div><h4 className="mb-2 font-semibold text-secondary">AI Arsenal</h4><LearningContent html={phase.learningsAiArsenal} /></div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
