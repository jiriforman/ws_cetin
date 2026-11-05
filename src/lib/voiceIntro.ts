// Voice intro of a phase: an audio player block stored at the top of the phase's background
// (rich text HTML), so it needs no extra database column and travels with export/import.

const MARKER = 'data-voice-intro';

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'webm'];
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

const parse = (html: string) => {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html || '';
  return doc.body;
};

/** URL of the voice intro in a phase background, or '' when there is none. */
export const getVoiceIntro = (html: string): string =>
  parse(html).querySelector(`[${MARKER}] audio`)?.getAttribute('src') ?? '';

/** Returns the background with the voice intro set to `url` (or removed when `url` is empty). */
export const setVoiceIntro = (html: string, url: string): string => {
  const body = parse(html);
  body.querySelectorAll(`[${MARKER}]`).forEach((el) => el.remove());
  if (url) {
    const block = body.ownerDocument.createElement('div');
    block.className = 'audio-embed';
    block.setAttribute(MARKER, 'true');
    const audio = body.ownerDocument.createElement('audio');
    audio.setAttribute('controls', '');
    audio.setAttribute('preload', 'metadata');
    audio.setAttribute('src', url);
    block.appendChild(audio);
    body.insertBefore(block, body.firstChild);
  }
  return body.innerHTML;
};
