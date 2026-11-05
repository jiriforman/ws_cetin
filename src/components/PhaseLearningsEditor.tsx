import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Switch } from '@/components/ui/switch';

interface Props {
  projectManagement: string;
  aiArsenal: string;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onProjectManagementChange: (value: string) => void;
  onAiArsenalChange: (value: string) => void;
}

export default function PhaseLearningsEditor({ projectManagement, aiArsenal, visible, onVisibilityChange, onProjectManagementChange, onAiArsenalChange }: Props) {
  return (
    <fieldset className="min-w-0 space-y-3 border-t border-border pt-3">
      <legend className="font-display text-lg font-bold text-primary">Learnings</legend>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={visible} onCheckedChange={onVisibilityChange} aria-label="Show phase learnings" />
        Show on phase details and Learnings page
      </label>
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <div className="min-w-0 space-y-1" role="group" aria-label="Project management learnings">
          <Label className="text-sm font-medium">Project management</Label>
          <RichTextEditor value={projectManagement} onChange={onProjectManagementChange} placeholder="Project management" />
        </div>
        <div className="min-w-0 space-y-1" role="group" aria-label="AI Arsenal learnings">
          <Label className="text-sm font-medium">AI Arsenal</Label>
          <RichTextEditor value={aiArsenal} onChange={onAiArsenalChange} placeholder="AI Arsenal" />
        </div>
      </div>
    </fieldset>
  );
}