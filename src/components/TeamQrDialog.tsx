import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface TeamQrDialogProps {
  team: { name: string; token?: string } | null;
  onClose: () => void;
}

// Generated in the browser so team URLs (which contain the access token) never leave the device
const TeamQrDialog = ({ team, onClose }: TeamQrDialogProps) => {
  const [dataUrl, setDataUrl] = useState('');
  const url = team?.token ? `${window.location.origin}/team/${team.token}` : '';

  useEffect(() => {
    setDataUrl('');
    if (!url) return;
    QRCode.toDataURL(url, { width: 600, margin: 2 }).then(setDataUrl).catch(console.error);
  }, [url]);

  return (
    <Dialog open={!!team} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{team?.name}</DialogTitle>
          <DialogDescription className="break-all font-mono text-xs">{url}</DialogDescription>
        </DialogHeader>
        {dataUrl && <img src={dataUrl} alt={`QR code for ${team?.name}`} className="w-full rounded bg-white" />}
        <Button asChild disabled={!dataUrl}>
          <a href={dataUrl} download={`${team?.name ?? 'team'}-qr.png`}>
            <Download className="mr-2 h-4 w-4" />
            Download PNG
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default TeamQrDialog;
