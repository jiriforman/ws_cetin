import { sanitizeHtml } from '@/lib/sanitize';

export default function LearningContent({ html }: { html: string }) {
  const cleaned = sanitizeHtml(html);
  const empty = !cleaned.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() && !/<(img|iframe|audio)\b/i.test(cleaned);
  return empty ? <span className="text-muted-foreground">—</span> : (
    <div className="break-words text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-primary [&_a]:underline [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: cleaned }} />
  );
}