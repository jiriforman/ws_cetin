import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bot, ClipboardList, Download, Hash, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { isLearningsPageEnabled, visibleLearningPhases } from '@/lib/learnings';
import LearningContent from '@/components/LearningContent';
import { exportLearningsPdf } from '@/lib/exportLearningsPdf';
import { useToast } from '@/hooks/use-toast';
import narcosLogo from '@/assets/narcos-logo.png';
import narcosLogoDark from '@/assets/narcos-logo-dark.png';

export default function Learnings() {
  const { phases, sections, isLoaded } = useWorkshop();
  const tableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  if (!isLoaded) return <div className="container mx-auto px-4 py-12 text-muted-foreground" role="status">Loading…</div>;
  if (!isLearningsPageEnabled(sections)) return <Navigate to="/phases" replace />;
  const visiblePhases = visibleLearningPhases(phases);
  const download = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try { await exportLearningsPdf(tableRef.current); }
    catch { toast({ title: 'PDF export failed', description: 'Please try again.', variant: 'destructive' }); }
    finally { setExporting(false); }
  };
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={narcosLogo} alt="Narcos workshop" className="h-14 w-auto" />
          <h1 className="font-display text-4xl font-bold text-secondary">Learnings</h1>
        </div>
        <Button variant="outline" onClick={download} disabled={exporting || !visiblePhases.length}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export one-page PDF
        </Button>
      </div>
      {!visiblePhases.length ? <p className="text-muted-foreground">No phase learnings published yet.</p> : (
        <div className="overflow-x-auto">
          <div ref={tableRef} data-learnings-export className="bg-background py-3">
            <div className="mb-4 flex items-center justify-center gap-3">
              <img src={narcosLogo} alt="" aria-hidden="true" data-learnings-logo-light className="h-10 w-auto" />
              <img src={narcosLogoDark} alt="" aria-hidden="true" data-learnings-logo-dark className="hidden h-10 w-auto" />
              <h2 className="font-display text-2xl text-secondary">Workshop Learnings</h2>
            </div>
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <colgroup><col className="w-1/5" /><col className="w-2/5" /><col className="w-2/5" /></colgroup>
              <thead className="bg-muted text-secondary">
                <tr>
                  <th scope="col" className="border border-border p-3 text-left font-semibold"><span className="inline-flex items-center gap-2"><Hash className="h-4 w-4" />Phase</span></th>
                  <th scope="col" className="border border-border p-3 text-left font-semibold"><span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" />Project management</span></th>
                  <th scope="col" className="border border-border p-3 text-left font-semibold"><span className="inline-flex items-center gap-2"><Bot className="h-4 w-4" />AI Arsenal</span></th>
                </tr>
              </thead>
              <tbody>{visiblePhases.map((phase) => (
                <tr key={phase.id}>
                  <th scope="row" className="break-words border border-border p-3 text-left align-top font-semibold text-foreground">{phase.name}</th>
                  <td className="border border-border p-3 align-top"><LearningContent html={phase.learningsProjectManagement} /></td>
                  <td className="border border-border p-3 align-top"><LearningContent html={phase.learningsAiArsenal} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}