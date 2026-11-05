// YouTube / Vimeo links -> embeddable player URL (the only iframe hosts sanitizeHtml allows).

export type VideoType = 'youtube' | 'vimeo';

export const extractVideoId = (url: string): { type: VideoType | null; id: string | null } => {
  const value = (url || '').trim();
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare video id
  ];
  for (const pattern of youtubePatterns) {
    const match = value.match(pattern);
    if (match) return { type: 'youtube', id: match[1] };
  }
  const vimeoPatterns = [/player\.vimeo\.com\/video\/(\d+)/, /vimeo\.com\/(?:.*\/)?(\d+)/];
  for (const pattern of vimeoPatterns) {
    const match = value.match(pattern);
    if (match) return { type: 'vimeo', id: match[1] };
  }
  return { type: null, id: null };
};

/** Player URL for a YouTube or Vimeo link, or null when the link is not a supported video. */
export const videoEmbedUrl = (url: string): string | null => {
  const { type, id } = extractVideoId(url);
  if (!type || !id) return null;
  return type === 'youtube' ? `https://www.youtube.com/embed/${id}` : `https://player.vimeo.com/video/${id}`;
};
