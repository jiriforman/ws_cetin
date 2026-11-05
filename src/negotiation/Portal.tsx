import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Lock, MapPin, MessageSquare } from 'lucide-react';
import { CorpShell, Monogram } from './CorpShell';
import { PORTAL_THEME, themeFor } from './siteTheme';
import { useNegotiationState } from './useNegotiationState';
import { formatUsd, orderedTerms, tokenFromInput } from '@/lib/negotiation';

const PORTAL_NAME = 'AgriSource Trade Portal';

const PortalHeader = ({ teamName, token }: { teamName?: string; token?: string }) => (
  <header className="border-b" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
      <Link to={token ? `/negotiation/${token}` : '/negotiation'} className="flex items-center gap-2 no-underline">
        <Monogram name="Agri Source" theme={PORTAL_THEME} size={34} />
        <span className="text-lg font-semibold" style={{ color: 'var(--c-primary)' }}>
          {PORTAL_NAME}
        </span>
      </Link>
      <nav className="hidden items-center gap-6 text-sm md:flex corp-muted">
        <span>Suppliers</span>
        <span>Commodities</span>
        <span>Logistics</span>
        <span>Help</span>
      </nav>
      <div className="flex items-center gap-2">
        {teamName && (
          <span className="hidden rounded-full px-3 py-1 text-sm font-medium sm:inline" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
            Buyer: {teamName}
          </span>
        )}
        {/* Way back to the Narcos main page */}
        <Link to="/" className="corp-btn corp-btn-outline no-underline" title="Back to the Narcos main page">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to Narcos</span>
          <span className="sm:hidden">Narcos</span>
        </Link>
      </div>
    </div>
  </header>
);

const PortalFooter = () => (
  <footer className="mt-16 border-t py-8 text-center text-xs corp-muted" style={{ borderColor: 'var(--c-border)' }}>
    © 2026 AgriSource Trade Portal · Connecting buyers with verified grain suppliers across Brazil · Terms · Privacy
  </footer>
);

const Login = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="corp-card mx-auto mt-8 max-w-xl p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const token = tokenFromInput(value);
        setInvalid(!token);
        if (token) navigate(`/negotiation/${encodeURIComponent(token)}`);
      }}
    >
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Lock className="h-4 w-4" /> Buyer access
      </div>
      <p className="mb-4 text-sm corp-muted">Enter your team code (token), or paste your team link, to start talking to suppliers.</p>
      <div className="flex gap-2">
        <input
          className="corp-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder="Team code, e.g. 7f3k9q2xlp"
          aria-label="Team code or team link"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button className="corp-btn corp-btn-primary" type="submit">
          Enter <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {invalid && <p className="mt-2 text-sm" style={{ color: '#9b1c1c' }}>Please enter your team code or team link.</p>}
    </form>
  );
};

const Portal = () => {
  const { token } = useParams();
  const { state, error, loading } = useNegotiationState(token);
  const supplierName = (key: string) => state?.suppliers.find((s) => s.key === key)?.name ?? key;

  return (
    <CorpShell theme={PORTAL_THEME} title={PORTAL_NAME}>
      <PortalHeader teamName={state?.team.name} token={token} />

      <section className="corp-hero-art text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="mb-2 text-sm uppercase tracking-wider opacity-80">Request for proposal · Yellow corn, 20 t, DAP</p>
          <h1 className="max-w-2xl text-3xl font-bold md:text-4xl">Find and negotiate with verified corn suppliers</h1>
          <p className="mt-3 max-w-2xl opacity-90">
            Visit each supplier's website and chat with their sales team. When you are happy with an offer, accept it. Your team can accept only one
            offer, and it is final.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4">
        {!token && <Login />}

        {token && loading && !state && <p className="py-12 text-center corp-muted">Loading suppliers…</p>}
        {token && error && !state && (
          <div className="corp-card mx-auto mt-8 max-w-xl p-6 text-center">
            <p className="font-semibold">We could not sign you in.</p>
            <p className="mt-1 text-sm corp-muted">{error}</p>
            <Link to="/negotiation" className="corp-btn corp-btn-outline mt-4">
              Try another link
            </Link>
          </div>
        )}

        {state && (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="corp-card p-4">
                <div className="text-xs uppercase corp-muted">Status</div>
                <div className="mt-1 font-semibold">{state.settings.is_open ? 'Negotiations open' : 'Negotiations not open yet'}</div>
              </div>
              <div className="corp-card p-4">
                <div className="text-xs uppercase corp-muted">Messages per supplier</div>
                <div className="mt-1 font-semibold">{state.settings.max_messages}</div>
              </div>
              <div className="corp-card p-4">
                <div className="text-xs uppercase corp-muted">Your deal</div>
                <div className="mt-1 font-semibold">
                  {state.deal ? `${supplierName(state.deal.supplier_key)} · ${formatUsd(state.deal.price)} USD/t` : 'No offer accepted yet'}
                </div>
              </div>
            </div>

            {state.deal && (
              <div className="mt-4 flex items-start gap-3 rounded-lg p-4" style={{ background: '#e8f5ec', border: '1px solid #b7dfc3', color: '#1d5c33' }}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Deal closed with {supplierName(state.deal.supplier_key)} at {formatUsd(state.deal.price)} USD/t.
                  </div>
                  <div className="text-sm">The deal is final. You can still browse the supplier websites, but negotiations are over.</div>
                </div>
              </div>
            )}

            <h2 className="mb-4 mt-10 text-xl font-semibold">Suppliers matching your request ({state.suppliers.length})</h2>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {state.suppliers.map((s) => {
                const conv = state.conversations.find((c) => c.supplier_key === s.key);
                const theme = themeFor(s.key, s.site_content.theme);
                const used = conv?.messages_used ?? 0;
                return (
                  <article key={s.key} className="corp-card flex flex-col overflow-hidden">
                    <div className="h-20" style={{ background: theme.heroArt, backgroundSize: 'cover, 14px 14px' }} />
                    <div className="-mt-7 flex flex-1 flex-col p-5 pt-0">
                      <div className="mb-3 rounded-lg bg-white p-1" style={{ width: 'fit-content' }}>
                        <Monogram name={s.name} theme={theme} size={48} />
                      </div>
                      <h3 className="text-lg font-semibold">{s.name}</h3>
                      <div className="mt-1 flex items-center gap-1 text-sm corp-muted">
                        <MapPin className="h-3.5 w-3.5" /> {s.region}
                      </div>
                      <p className="mt-3 text-sm">{s.site_content.tagline ?? s.proposal_intro.slice(0, 110)}</p>

                      <dl className="mt-4 space-y-1 text-sm">
                        <div className="flex justify-between gap-2">
                          <dt className="corp-muted">Current offer</dt>
                          <dd className="font-semibold">{formatUsd(conv?.offer.price ?? s.initial_price)} USD/t</dd>
                        </div>
                        {orderedTerms(conv?.offer.terms ?? s.offer_terms)
                          .slice(0, 2)
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <dt className="capitalize corp-muted">{k}</dt>
                              <dd className="text-right">{v}</dd>
                            </div>
                          ))}
                        <div className="flex justify-between gap-2">
                          <dt className="corp-muted">Messages used</dt>
                          <dd>
                            {used} / {state.settings.max_messages}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-auto pt-5">
                        <Link to={`/negotiation/${token}/s/${s.key}`} className="corp-btn corp-btn-primary w-full no-underline">
                          <Building2 className="h-4 w-4" /> Visit website
                          {used > 0 && <MessageSquare className="h-4 w-4 opacity-80" />}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
      <PortalFooter />
    </CorpShell>
  );
};

export default Portal;
