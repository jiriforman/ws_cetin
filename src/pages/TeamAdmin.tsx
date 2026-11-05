import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkshop } from '@/contexts/WorkshopContext';
import PhaseCountdown from '@/components/PhaseCountdown';
import { Shield, Clock, Handshake, Video, Users, Plus, Trash2, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { teamApi, uploadImage } from '@/lib/api';
import { mapTeam } from '@/contexts/WorkshopContext';
import { Team } from '@/lib/workshopData';
import { computeStandings, formatUsd } from '@/lib/rankings';
import { blockEndTime, blockName, runningBlock } from '@/lib/phaseBlocks';
import { videoEmbedUrl } from '@/lib/video';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MAX_MEMBERS = 30;

/** Video player for a YouTube / Vimeo link. */
const VideoPlayer = ({ url, title }: { url: string; title: string }) => {
  const src = videoEmbedUrl(url);
  if (!src) return null;
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border" style={{ paddingBottom: '56.25%' }}>
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    </div>
  );
};

const TeamAdmin = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { phases, teams, startingBudget, rankingEntries } = useWorkshop();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', logoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Team profile (intro video, PM, crew): anyone with the team link may edit it
  const [profile, setProfile] = useState({ introVideoUrl: '', pmName: '', members: [''] });
  const [profileSaving, setProfileSaving] = useState(false);

  const profileOf = (t: Team) => ({
    introVideoUrl: t.introVideoUrl ?? '',
    pmName: t.pmName ?? '',
    members: t.members && t.members.length ? [...t.members] : [''],
  });

  useEffect(() => {
    if (!token) return;
    teamApi<{ team: Record<string, unknown> }>('get', token)
      .then(({ team: row }) => {
        const found = mapTeam(row);
        setTeam(found);
        setFormData({ name: found.name, logoUrl: found.logoUrl });
        setProfile(profileOf(found));
      })
      .catch((error: Error) => {
        toast({ title: 'Access Denied', description: error.message, variant: 'destructive' });
        navigate('/');
      });
  }, [token, navigate, toast]);

  const running = runningBlock(phases);
  const runningEnd = running ? blockEndTime(running) : null;
  const standing = team ? computeStandings(teams, rankingEntries, startingBudget).find((s) => s.team.id === team.id) : undefined;

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !team) return;

    setUploading(true);

    try {
      const publicUrl = await uploadImage(file, (ext) =>
        teamApi<{ path: string; token: string; publicUrl: string }>('upload-url', token!, { ext }),
      );
      setFormData({ ...formData, logoUrl: publicUrl });

      toast({
        title: 'Logo Uploaded',
        description: 'Your team logo has been uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!team || !token) return;
    setSaving(true);
    try {
      const { team: row } = await teamApi<{ team: Record<string, unknown> }>('update', token, {
        name: formData.name,
        logo_url: formData.logoUrl,
      });
      setTeam(mapTeam(row));
      toast({
        title: 'Team Updated',
        description: 'Your team information has been saved',
      });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!team || !token) return;
    const introVideoUrl = profile.introVideoUrl.trim();
    if (introVideoUrl && (!/^https:\/\//i.test(introVideoUrl) || !videoEmbedUrl(introVideoUrl))) {
      toast({ title: 'Invalid video link', description: 'Paste a Vimeo or YouTube link, e.g. https://vimeo.com/123456789', variant: 'destructive' });
      return;
    }
    setProfileSaving(true);
    try {
      const { team: row } = await teamApi<{ team: Record<string, unknown> }>('update', token, {
        intro_video_url: introVideoUrl,
        pm_name: profile.pmName.trim(),
        members: profile.members.map((m) => m.trim()).filter(Boolean),
      });
      const saved = mapTeam(row);
      setTeam(saved);
      setProfile(profileOf(saved));
      toast({ title: 'Team page saved', description: 'Intro video, PM and crew are stored.' });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const saved = team ? profileOf(team) : null;
  const profileDirty = !!saved && JSON.stringify({ ...profile, members: profile.members.map((m) => m.trim()).filter(Boolean) }) !==
    JSON.stringify({ ...saved, members: saved.members.filter(Boolean) });

  if (!team) return null;

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Team Header */}
        <Card className="bg-card border-primary/50 p-8 mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              {team.logoUrl ? (
                <img
                  src={team.logoUrl}
                  alt={team.name}
                  className="h-16 w-16 rounded border-2 border-primary object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded border-2 border-primary bg-muted flex items-center justify-center">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                <h1 className="narcos-title text-3xl font-bold text-secondary">
                  {team.name}
                </h1>
                <p className="text-muted-foreground font-mono text-sm mt-1">
                  TOKEN: {team.token}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
              className="border-primary text-primary hover:bg-primary/20"
            >
              {isEditing ? 'Cancel' : 'Edit Team'}
            </Button>
          </div>

          {isEditing && (
            <div className="mt-6 pt-6 border-t border-border space-y-4">
              <div>
                <Label htmlFor="name">Team Name</Label>
                <Input
                  id="name"
                  maxLength={60}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label htmlFor="logo">Team Logo</Label>
                <div className="space-y-2">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="bg-background border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload an image (max 2MB). Supported formats: JPG, PNG, GIF, WEBP
                  </p>
                  {formData.logoUrl && (
                    <div className="mt-2">
                      <img
                        src={formData.logoUrl}
                        alt="Preview"
                        className="h-20 w-20 rounded border-2 border-primary object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
              <Button 
                onClick={handleSave} 
                disabled={uploading || saving}
                className="bg-primary text-primary-foreground"
              >
                {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </Card>

        <Card className="bg-card border-accent/50 p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <Handshake className="h-6 w-6 text-accent" />
              <div>
                <h2 className="font-display text-xl font-bold text-accent">Negotiation Room</h2>
                <p className="text-muted-foreground text-sm">Chat with the corn suppliers and close your deal. One deal per team, and it is final.</p>
              </div>
            </div>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to={`/negotiation/${token}`}>Open supplier portal</Link>
            </Button>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Phase(s) */}
          <Card className="bg-card border-border p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold text-primary">{running?.parallel ? 'Current Phases' : 'Current Phase'}</h2>
            </div>

            {running ? (
              <div className="space-y-4">
                <div>
                  {running.parallel && (
                    <p className="font-mono text-xs text-accent mb-1">PARALLEL PHASES – team splits in half</p>
                  )}
                  <h3 className="font-display text-lg font-bold">{blockName(running)}</h3>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground mb-2">Time Remaining:</div>
                  {runningEnd && <PhaseCountdown endTime={runningEnd} />}
                </div>
                <Badge className="bg-primary/20 text-primary border-primary">RUNNING</Badge>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="font-mono">[STANDBY]</p>
                <p className="mt-2">No active phase. Awaiting mission start.</p>
              </div>
            )}
          </Card>

          {/* Intro video */}
          <Card className="bg-card border-border p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Video className="h-5 w-5 text-secondary" />
              <h2 className="font-display text-xl font-bold text-secondary">Team Intro Video</h2>
            </div>
            {team.introVideoUrl && videoEmbedUrl(team.introVideoUrl) ? (
              <VideoPlayer url={team.introVideoUrl} title={`${team.name} intro video`} />
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="font-mono text-accent">[NO VIDEO YET]</p>
                <p className="mt-2 text-sm">Upload your intro to Vimeo (see AI Arsenal) and paste the link below.</p>
              </div>
            )}
            <div className="mt-4 space-y-1">
              <Label htmlFor="intro-video">Vimeo or YouTube link</Label>
              <Input
                id="intro-video"
                inputMode="url"
                placeholder="https://vimeo.com/123456789"
                value={profile.introVideoUrl}
                onChange={(e) => setProfile({ ...profile, introVideoUrl: e.target.value })}
                className="bg-background border-border"
              />
            </div>
          </Card>
        </div>

        {/* Crew: PM + members, filled in by the team */}
        <Card className="bg-card border-border p-6 mt-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold text-primary">Crew</h2>
            </div>
            <p className="text-xs text-muted-foreground">Anyone with this team link can edit the crew, PM and intro video.</p>
          </div>
          <div className="space-y-1 mb-4 max-w-md">
            <Label htmlFor="pm-name">PM name</Label>
            <Input
              id="pm-name"
              maxLength={80}
              placeholder="Project manager"
              value={profile.pmName}
              onChange={(e) => setProfile({ ...profile, pmName: e.target.value })}
              className="bg-background border-border"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-12 font-display text-primary">#</TableHead>
                <TableHead className="font-display text-primary">Team member name</TableHead>
                <TableHead className="w-12"><span className="sr-only">Remove</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.members.map((member, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="py-1">
                    <Input
                      aria-label={`Team member ${i + 1}`}
                      maxLength={80}
                      placeholder="Name"
                      value={member}
                      onChange={(e) => setProfile({ ...profile, members: profile.members.map((m, j) => (j === i ? e.target.value : m)) })}
                      className="bg-background border-border"
                    />
                  </TableCell>
                  <TableCell className="py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove team member ${i + 1}`}
                      onClick={() => {
                        const rest = profile.members.filter((_, j) => j !== i);
                        setProfile({ ...profile, members: rest.length ? rest : [''] });
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProfile({ ...profile, members: [...profile.members, ''] })}
              disabled={profile.members.length >= MAX_MEMBERS}
              className="border-primary text-primary hover:bg-primary/20"
            >
              <Plus className="mr-2 h-4 w-4" /> Add member
            </Button>
            <Button onClick={saveProfile} disabled={profileSaving || !profileDirty} className="bg-primary text-primary-foreground ml-auto">
              {profileSaving ? 'Saving...' : profileDirty ? 'Save team page' : 'Saved'}
            </Button>
          </div>
        </Card>

        {/* Team Stats: set by the facilitators only (Rankings), never editable here */}
        <div className="flex items-center gap-2 mt-6 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Rank and balance are set by the facilitators.
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <Card className="bg-card border-border p-4 text-center">
            <div className="text-2xl font-display font-bold text-primary">{standing?.rank ?? '-'}</div>
            <div className="text-sm text-muted-foreground mt-1">Rank</div>
          </Card>
          <Card className="bg-card border-border p-4 text-center">
            <div className="text-2xl font-display font-bold text-accent">{standing ? formatUsd(standing.balance) : '-'}</div>
            <div className="text-sm text-muted-foreground mt-1">Balance (USD)</div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TeamAdmin;
