import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, MessageCircle, Send, X } from 'lucide-react';
import { negotiationApi } from '@/lib/api';
import { formatUsd, orderedTerms, type ChatMessage, type ConversationView, type PublicDeal, type PublicSupplier } from '@/lib/negotiation';
import { Monogram } from './CorpShell';
import type { SiteTheme } from './siteTheme';

interface Props {
  token: string;
  supplier: PublicSupplier;
  theme: SiteTheme;
  conversation: ConversationView | undefined;
  maxMessages: number;
  isOpen: boolean;
  deal: PublicDeal | null;
  supplierNameOf: (key: string) => string;
  onChanged: () => void;
}

const OFFER_PREFIX = 'Current offer:';

/** Splits the server-appended offer summary from the supplier's text. */
const splitOffer = (content: string) => {
  const idx = content.lastIndexOf(OFFER_PREFIX);
  if (idx < 0) return { text: content, offer: null };
  return { text: content.slice(0, idx).trim(), offer: content.slice(idx + OFFER_PREFIX.length).trim() };
};

const ChatWidget = ({ token, supplier, theme, conversation, maxMessages, isOpen, deal, supplierNameOf, onChanged }: Props) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conv, setConv] = useState<ConversationView | undefined>(conversation);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setConv(conversation), [conversation]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await negotiationApi<{ messages: ChatMessage[]; conversation: ConversationView }>('history', token, { supplier: supplier.key });
      setMessages(res.messages);
      setConv(res.conversation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the chat');
    }
  }, [token, supplier.key]);

  // Load on open and keep in sync while open (a teammate may chat on another phone)
  useEffect(() => {
    if (!open) return;
    loadHistory();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && !sending) loadHistory();
    }, 6000);
    return () => clearInterval(t);
  }, [open, loadHistory, sending]);

  // Follow new messages only while the reader is at the bottom; never pull them down while they read older ones
  const stickToBottom = useRef(true);
  const onListScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // Opening the chat starts at the latest message
  useEffect(() => {
    if (!open) return;
    stickToBottom.current = true;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open]);

  // Sending a message always jumps to it
  useEffect(() => {
    if (pending) stickToBottom.current = true;
  }, [pending]);

  useEffect(() => {
    if (stickToBottom.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending]);

  const used = conv?.messages_used ?? 0;
  const left = Math.max(0, maxMessages - used);
  const dealHere = deal?.supplier_key === supplier.key;
  const locked = !!deal || !isOpen || left === 0;
  const lockReason = deal
    ? dealHere
      ? 'You accepted this offer. The deal is final.'
      : `Your team closed a deal with ${supplierNameOf(deal.supplier_key)}. Negotiations are over.`
    : !isOpen
      ? 'Our sales team is not available yet. Please come back later.'
      : left === 0
        ? `You have used all ${maxMessages} messages with us.`
        : null;

  const send = async () => {
    const value = text.trim();
    if (!value || sending || locked) return;
    setSending(true);
    setError(null);
    setPending(value);
    setText('');
    try {
      await negotiationApi('send', token, { supplier: supplier.key, text: value });
      await loadHistory();
      onChanged();
    } catch (err) {
      setText(value);
      setError(err instanceof Error ? err.message : 'Message not sent');
    } finally {
      setPending(null);
      setSending(false);
    }
  };

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await negotiationApi('accept', token, { supplier: supplier.key });
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the offer');
    } finally {
      setAccepting(false);
    }
  };

  const offer = conv?.offer;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="corp-btn corp-btn-primary fixed bottom-5 right-5 z-40 rounded-full px-5 py-3 shadow-lg"
          aria-label="Chat with our sales team"
        >
          <MessageCircle className="h-5 w-5" /> Chat with sales
          {used > 0 && <span className="rounded-full bg-white/25 px-2 text-xs">{used}/{maxMessages}</span>}
        </button>
      )}

      {open && (
        <section
          className="corp-chat-panel corp-card fixed inset-x-2 bottom-2 z-50 flex flex-col overflow-hidden sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[400px]"
          style={{ height: 'min(640px, calc(100vh - 1rem))' }}
          aria-label={`Chat with ${supplier.name}`}
        >
          <header className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: 'var(--c-primary)' }}>
            <span className="rounded-md bg-white p-0.5">
              <Monogram name={supplier.name} theme={theme} size={30} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{supplier.name}</div>
              <div className="text-xs opacity-85">Sales team · usually replies in a few seconds</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1 hover:bg-white/15">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} onScroll={onListScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ background: 'var(--c-bg)' }}>
            <div className="max-w-[85%] rounded-lg rounded-tl-none px-3 py-2 text-sm" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              Hello! Thanks for visiting {supplier.name}. How can we help with your 20 tonnes of corn?
            </div>
            {messages.map((m) => {
              if (m.role === 'team') {
                return (
                  <div key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-none px-3 py-2 text-sm text-white" style={{ background: 'var(--c-primary)' }}>
                    {m.content}
                  </div>
                );
              }
              const { text: body, offer: offerLine } = splitOffer(m.content);
              return (
                <div key={m.id} className="max-w-[85%] rounded-lg rounded-tl-none text-sm" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                  <div className="whitespace-pre-wrap px-3 py-2">{body}</div>
                  {offerLine && (
                    <div className="border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)' }}>
                      <span className="font-semibold">Current offer:</span> {offerLine}
                    </div>
                  )}
                </div>
              );
            })}
            {pending && (
              <>
                <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-none px-3 py-2 text-sm text-white opacity-80" style={{ background: 'var(--c-primary)' }}>
                  {pending}
                </div>
                <div className="corp-typing w-16 rounded-lg px-3 py-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }} aria-label="Typing">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            )}
          </div>

          {offer && (
            <div className="border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase corp-muted">Current offer</div>
                  <div className="text-lg font-bold">{formatUsd(offer.price)} USD/t</div>
                </div>
                {!deal && isOpen && (
                  <button type="button" className="corp-btn corp-btn-accent" onClick={() => setConfirming(true)} disabled={sending}>
                    Accept offer
                  </button>
                )}
                {dealHere && (
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#1d7a43' }}>
                    <CheckCircle2 className="h-4 w-4" /> Accepted
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs corp-muted">{orderedTerms(offer.terms).map(([, v]) => v).join(' · ')}</div>
            </div>
          )}

          {confirming && (
            <div className="border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--c-border)', background: '#fff8e6' }}>
              <p className="font-semibold">Accept {formatUsd(offer?.price ?? 0)} USD/t from {supplier.name}?</p>
              <p className="mt-1 text-xs">Your team can accept only one offer and it is final. Check the conditions above before you confirm.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="corp-btn corp-btn-primary" onClick={accept} disabled={accepting}>
                  {accepting ? 'Accepting…' : 'Yes, accept'}
                </button>
                <button type="button" className="corp-btn corp-btn-outline" onClick={() => setConfirming(false)} disabled={accepting}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && <div className="px-4 py-2 text-xs" style={{ background: '#fdecec', color: '#9b1c1c' }}>{error}</div>}

          <form
            className="flex items-end gap-2 border-t p-3"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            {lockReason ? (
              <p className="flex-1 text-sm corp-muted">{lockReason}</p>
            ) : (
              <>
                <textarea
                  className="corp-input resize-none"
                  rows={2}
                  maxLength={600}
                  value={text}
                  placeholder="Write your message…"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={sending}
                  aria-label="Message"
                />
                <div className="flex flex-col items-center gap-1">
                  <button type="submit" className="corp-btn corp-btn-primary px-3" disabled={sending || !text.trim()} aria-label="Send">
                    <Send className="h-4 w-4" />
                  </button>
                  <span className="text-[11px] corp-muted" title="Messages left with this supplier">
                    {left} left
                  </span>
                </div>
              </>
            )}
          </form>
        </section>
      )}
    </>
  );
};

export default ChatWidget;
