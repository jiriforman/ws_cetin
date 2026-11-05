import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Clock, FileText, Mail, MapPin, Phone, ShieldCheck, Truck } from 'lucide-react';
import { CorpShell, Monogram } from './CorpShell';
import ChatWidget from './ChatWidget';
import { themeFor, type SiteTheme } from './siteTheme';
import { useNegotiationState } from './useNegotiationState';
import { formatUsd, type PublicSupplier } from '@/lib/negotiation';

const HIGHLIGHT_ICONS = [Award, ShieldCheck, Truck, Clock];
// Same blue as the trade portal, so the bar reads as "the portal", not the supplier's site
const PORTAL_BAR_BG = '#0b3860';

const Hero = ({ supplier, theme }: { supplier: PublicSupplier; theme: SiteTheme }) => {
  const c = supplier.site_content;
  const tagline = c.tagline ?? supplier.name;
  const sub = c.about?.[0] ?? supplier.proposal_intro;
  const cta = (
    <a href="#products" className="corp-btn corp-btn-accent no-underline">
      Our corn
    </a>
  );

  if (theme.hero === 'split') {
    return (
      <section style={{ background: 'var(--c-surface)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--c-primary)' }}>
              {supplier.region}
            </p>
            <h1 className="text-3xl font-bold md:text-5xl">{tagline}</h1>
            <p className="mt-4 corp-muted">{sub}</p>
            <div className="mt-6">{cta}</div>
          </div>
          <div className="corp-hero-art aspect-[4/3] rounded-2xl" />
        </div>
      </section>
    );
  }

  if (theme.hero === 'centered') {
    return (
      <section className="corp-hero-art text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-3xl font-bold md:text-5xl">{tagline}</h1>
          <p className="mx-auto mt-4 max-w-2xl opacity-90">{sub}</p>
          <div className="mt-8">{cta}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="corp-hero-art text-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="mb-2 text-sm uppercase tracking-wider opacity-80">{supplier.region}</p>
        <h1 className="max-w-3xl text-3xl font-bold md:text-5xl">{tagline}</h1>
        <p className="mt-4 max-w-2xl opacity-90">{sub}</p>
        <div className="mt-8">{cta}</div>
      </div>
    </section>
  );
};

const SupplierSite = () => {
  const { token, supplierKey } = useParams();
  const { state, error, refresh } = useNegotiationState(token);
  const supplier = state?.suppliers.find((s) => s.key === supplierKey);
  const theme = themeFor(supplierKey ?? 'x', supplier?.site_content.theme);

  if (!state || !supplier) {
    return (
      <CorpShell theme={theme} title="Supplier">
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          {error ? (
            <>
              <p className="font-semibold">This page is not available.</p>
              <p className="mt-1 text-sm corp-muted">{error}</p>
            </>
          ) : state ? (
            <p className="font-semibold">Supplier not found.</p>
          ) : (
            <p className="corp-muted">Loading…</p>
          )}
          <Link to={token ? `/negotiation/${token}` : '/negotiation'} className="corp-btn corp-btn-outline mt-6 no-underline">
            Back to the supplier directory
          </Link>
        </div>
      </CorpShell>
    );
  }

  const c = supplier.site_content;
  const conversation = state.conversations.find((x) => x.supplier_key === supplier.key);
  const nameOf = (key: string) => state.suppliers.find((s) => s.key === key)?.name ?? key;

  return (
    <CorpShell theme={theme} title={`${supplier.name} – ${c.tagline ?? 'Corn supplier'}`}>
      {/* Portal bar: always visible, so players can get back to the supplier list from anywhere */}
      <div className="sticky top-0 z-30">
      <div style={{ background: PORTAL_BAR_BG, color: '#fff' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link
            to={`/negotiation/${token}`}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold no-underline shadow-sm transition hover:bg-white/90 sm:text-base"
            style={{ color: PORTAL_BAR_BG }}
          >
            <ArrowLeft className="h-5 w-5" /> Back to supplier portal
          </Link>
          <span className="hidden text-sm opacity-90 sm:inline">
            AgriSource Trade Portal · Buyer: {state.team.name}
          </span>
        </div>
      </div>

      <header className="border-b" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="#top" className="flex items-center gap-3 no-underline">
            <Monogram name={supplier.name} theme={theme} size={38} />
            <span className="text-lg font-bold" style={{ fontFamily: 'var(--c-font-head)' }}>
              {supplier.name}
            </span>
          </a>
          <nav className="hidden gap-6 text-sm font-medium md:flex">
            <a href="#about" className="no-underline hover:underline">About us</a>
            <a href="#products" className="no-underline hover:underline">Products</a>
            <a href="#quality" className="no-underline hover:underline">Quality</a>
            <a href="#terms" className="no-underline hover:underline">Logistics & terms</a>
            <a href="#contact" className="no-underline hover:underline">Contact</a>
          </nav>
        </div>
      </header>
      </div>

      <div id="top" />
      <Hero supplier={supplier} theme={theme} />

      {c.stats && c.stats.length > 0 && (
        <section className="border-b" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-8 text-center sm:grid-cols-3">
            {c.stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold" style={{ color: 'var(--c-primary)' }}>
                  {s.value}
                </div>
                <div className="text-sm corp-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="mx-auto max-w-6xl px-4">
        <section id="about" className="grid gap-10 py-14 md:grid-cols-5">
          <div className="md:col-span-3">
            <h2 className="text-2xl font-bold">About us</h2>
            {(c.about?.length ? c.about : [supplier.proposal_intro]).map((p, i) => (
              <p key={i} className="mt-4">
                {p}
              </p>
            ))}
            {c.since && <p className="mt-4 text-sm corp-muted">Established {c.since}</p>}
          </div>
          <div className="corp-hero-art min-h-[220px] rounded-2xl md:col-span-2" aria-hidden="true" />
        </section>

        {c.highlights && c.highlights.length > 0 && (
          <section className="grid gap-5 pb-14 md:grid-cols-3">
            {c.highlights.map((h, i) => {
              const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
              return (
                <div key={h.title} className="corp-card p-6">
                  <Icon className="h-7 w-7" style={{ color: 'var(--c-primary)' }} />
                  <h3 className="mt-3 text-lg font-semibold">{h.title}</h3>
                  <p className="mt-2 text-sm corp-muted">{h.text}</p>
                </div>
              );
            })}
          </section>
        )}

        <section id="products" className="pb-14">
          <h2 className="text-2xl font-bold">Our corn for your request</h2>
          <p className="mt-2 corp-muted">Yellow corn, 20 t, DAP. Our response to your requirements:</p>
          <div id="quality" className="corp-card mt-6 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {supplier.proposal_specs.map((s, i) => (
                  <tr key={s.label} style={{ background: i % 2 ? 'var(--c-bg)' : 'var(--c-surface)' }}>
                    <th scope="row" className="w-1/3 px-4 py-3 text-left align-top font-semibold">
                      {s.label}
                    </th>
                    <td className="px-4 py-3">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="terms" className="grid gap-6 pb-14 md:grid-cols-2">
          <div className="corp-card p-6">
            <h2 className="text-xl font-bold">Price list</h2>
            <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--c-primary)' }}>
              {formatUsd(supplier.initial_price)} <span className="text-base font-medium corp-muted">USD per tonne</span>
            </p>
            <p className="mt-1 text-sm corp-muted">
              Total {formatUsd(supplier.initial_price * 20)} USD for 20 t, DAP. List price; talk to our sales team for your offer.
            </p>
          </div>
          <div className="corp-card p-6">
            <h2 className="text-xl font-bold">Documents</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {supplier.proposal_documents
                .split(/,\s*(?![^()]*\))/)
                .filter(Boolean)
                .map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--c-primary)' }} />
                    <span>{d.replace(/\.$/, '')}</span>
                  </li>
                ))}
              {supplier.materials.map((m) => (
                <li key={m.url} className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--c-accent)' }} />
                  <a href={m.url} target="_blank" rel="noreferrer" className="underline">
                    {m.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="contact" className="corp-card mb-10 grid gap-6 p-6 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5" style={{ color: 'var(--c-primary)' }} />
            <div>
              <div className="font-semibold">Head office</div>
              <div className="text-sm corp-muted">{c.contact?.city ?? supplier.region}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5" style={{ color: 'var(--c-primary)' }} />
            <div>
              <div className="font-semibold">Email</div>
              <div className="text-sm corp-muted">{c.contact?.email ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5" style={{ color: 'var(--c-primary)' }} />
            <div>
              <div className="font-semibold">Phone</div>
              <div className="text-sm corp-muted">{c.contact?.phone ?? '—'}</div>
            </div>
          </div>
        </section>

        <div className="mb-16 text-center">
          <Link to={`/negotiation/${token}`} className="corp-btn corp-btn-primary px-6 py-3 text-base no-underline">
            <ArrowLeft className="h-5 w-5" /> Back to all suppliers
          </Link>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-white/80" style={{ background: 'var(--c-primary-dark)' }}>
        © 2026 {supplier.name} · {supplier.region} · All rights reserved
      </footer>

      <ChatWidget
        token={token!}
        supplier={supplier}
        theme={theme}
        conversation={conversation}
        maxMessages={state.settings.max_messages}
        isOpen={state.settings.is_open}
        deal={state.deal}
        supplierNameOf={nameOf}
        onChanged={refresh}
      />
    </CorpShell>
  );
};

export default SupplierSite;
