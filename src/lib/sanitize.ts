import DOMPurify from 'dompurify';

// Only these hosts may be embedded (video embeds from the rich text editor)
const ALLOWED_IFRAME_SRC = /^https:\/\/(www\.youtube\.com\/embed\/|player\.vimeo\.com\/video\/)/;
// Audio (phase voice intros) only from this project's public storage
const STORAGE_PREFIX = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/`;

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'iframe') {
    const src = (node as Element).getAttribute('src') || '';
    if (!ALLOWED_IFRAME_SRC.test(src)) node.parentNode?.removeChild(node);
  }
  if (data.tagName === 'audio') {
    const src = (node as Element).getAttribute('src') || '';
    if (!src.startsWith(STORAGE_PREFIX)) node.parentNode?.removeChild(node);
  }
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Links open in a new tab safely
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Sanitizes rich text HTML stored in the database before rendering it. */
export const sanitizeHtml = (html: string | null | undefined) =>
  DOMPurify.sanitize(html || '', {
    ADD_TAGS: ['iframe', 'audio'],
    ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'frameborder', 'controls', 'preload'],
  });

/** Turns legacy plain text (no tags) into paragraphs so it can be edited and shown as rich text. */
export const plainTextToHtml = (text: string | null | undefined): string => {
  const value = text || '';
  if (!value.trim() || /<[a-z][\s\S]*>/i.test(value)) return value;
  const escape = (line: string) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => `<p>${paragraph.split(/\r?\n/).map(escape).join('<br>')}</p>`)
    .join('');
};

/**
 * About page: the QR code and the Google Drive link are no longer used. Removes QR images and
 * Drive links (with the paragraph/list item they leave empty) from already saved content.
 */
export const stripQrAndDriveLinks = (html: string): string => {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html || '';
  const isDrive = (url: string | null) => /^https?:\/\/(drive|docs)\.google\.com\//i.test(url || '');
  const isQr = (img: Element) =>
    /\bqr\b|qr[-_ ]?code|qrcode/i.test(`${img.getAttribute('alt') || ''} ${img.getAttribute('title') || ''} ${img.getAttribute('src') || ''}`);
  doc.body.querySelectorAll('img').forEach((img) => {
    if (isQr(img)) (img.closest('.image-wrapper') ?? img).remove();
  });
  doc.body.querySelectorAll('a').forEach((a) => {
    if (isDrive(a.getAttribute('href'))) a.remove();
  });
  // Drop blocks left without text or media, so no empty gap remains
  doc.body.querySelectorAll('p, li, div, h1, h2, h3, ul, ol').forEach((el) => {
    if (!el.textContent?.trim() && !el.querySelector('img, iframe, audio, video')) el.remove();
  });
  return doc.body.innerHTML;
};
