import { useState } from 'react';
import { Mic, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { adminApi, uploadFile } from '@/lib/api';
import { AUDIO_EXTENSIONS, AUDIO_MAX_BYTES, getVoiceIntro, setVoiceIntro } from '@/lib/voiceIntro';

interface Props {
  /** The phase background HTML that holds the voice intro. */
  background: string;
  onChange: (background: string) => void;
}

/** Upload / replace / remove the voice intro shown at the top of a phase description. */
const VoiceIntroInput = ({ background, onChange }: Props) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const url = getVoiceIntro(background);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const publicUrl = await uploadFile('team-logos', file, AUDIO_EXTENSIONS, AUDIO_MAX_BYTES, (ext) =>
        adminApi<{ path: string; token: string; publicUrl: string }>('audio-upload-url', { ext }),
      );
      onChange(setVoiceIntro(background, publicUrl));
      toast({ title: 'Voice intro uploaded', description: 'Save the phase to publish it.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Upload failed',
        description: /unknown action/i.test(message)
          ? 'The admin-api backend function is out of date. In Lovable, ask: "Deploy all edge functions (admin-api, negotiation-api, team-codes) from the current main branch."'
          : message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Mic className="h-4 w-4 text-accent" /> Voice intro (shown with a player at the top of the background)
      </Label>
      {url && <audio controls preload="metadata" src={url} className="w-full" />}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-1.5 text-sm hover:bg-muted">
          <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : url ? 'Replace audio' : 'Upload audio'}
          <input
            type="file"
            className="hidden"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.webm"
            disabled={uploading}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {url && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(setVoiceIntro(background, ''))} className="text-destructive">
            <Trash2 className="mr-1 h-4 w-4" /> Remove
          </Button>
        )}
        <span className="text-xs text-muted-foreground">MP3, M4A, AAC, WAV, OGG or WEBM, max 25 MB</span>
      </div>
    </div>
  );
};

export default VoiceIntroInput;
