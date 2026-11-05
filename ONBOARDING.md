# Onboarding – Narcos Workshop template

Gamified workshop app for teaching **AI in project management**. Teams move through timed phases, use an "AI Arsenal" of tools, negotiate with AI-played suppliers and compete in rankings.

> ⚠️ Template only: **no phase content, teams, suppliers or keys are included.** You bring your own scenario and your own Supabase project.

---

## 1. What you get

| Area | Route | Who |
|---|---|---|
| Home / About | `/`, `/about` | Everyone |
| Phases (timer, background, task, materials, voice intro) | `/phases` | Everyone |
| AI Arsenal (tool catalogue by category) | `/ai-tools` | Everyone |
| Cartel Rankings | `/teams` | Everyone (codes facilitator-only) |
| Team page (profile, crew, intro video) | `/team/<team token>` | One team |
| Negotiation Room (AI suppliers + chat) | `/negotiation/<team token>` | One team |
| Learnings summary + PDF export | `/learnings` | When published |
| Facilitator cheat sheet | `/cheat` | Link-only |
| Mission Control big screen | `/live` | Link-only |
| Admin console | `/admin` | Password |

Check `src/App.tsx` for the exact route list.

## 2. Prerequisites

- Node.js 20+ and npm (or bun)
- A **Supabase** project (or a Lovable Cloud project, which wraps Supabase)
- Supabase CLI (to push migrations and deploy edge functions) – optional if using Lovable
- Deno (only to run edge-function tests)
- Anthropic API key (only for the Negotiation Room)

## 3. Setup (≈15 min)

```sh
git clone <this repo> && cd <repo>
npm install
cp .env.example .env        # fill in your Supabase URL + anon key
```

**Database**
```sh
supabase link --project-ref <your-ref>
supabase db push            # applies supabase/migrations/*
```
Using Lovable instead? It applies `drizzle/migrations` (see `AGENTS.md`).

**Edge functions** – deploy all of them after every change in `supabase/functions/`:
```sh
supabase functions deploy admin-api negotiation-api team-api team-codes update-team-scores
```

**Secrets** (Supabase → Edge Functions → Secrets, or Lovable → Cloud → Secrets)

| Secret | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | Login to `/admin`; changing it logs everyone out |
| `ANTHROPIC_API_KEY` | For negotiation | Default LLM provider |
| `LOVABLE_API_KEY` | Optional | Alternative provider |
| `WEBHOOK_SECRET` | Optional | Protects `update-team-scores` (Google Sheet sync) |
| `HIDE_TEAM_CODES` | Optional | `true` hides team tokens on the rankings page |

Generate strong values: `openssl rand -base64 24`. The values in `.env.example` are random placeholders – **do not reuse them**.

**Run**
```sh
npm run dev                 # http://localhost:8080
```

## 4. Build your workshop (in `/admin`)

1. **Teams** – create teams; each gets a token = its only credential. Share `/team/<token>` links (QR codes available).
2. **Phases** – name, background, task, output, materials, budget, duration, tools, evaluation, learnings, cheat sheet, optional voice intro. Two adjacent phases can run **in parallel** (shared timer).
3. **AI Arsenal** – add tools (logo, link, category, visibility).
4. **Negotiation** (optional) – set the shared rules prompt, create suppliers (prices, minimums, persona, weak spots, optional trap, website text), test in the prompt preview, then switch the room **OPEN**.
5. **Sections** – toggle menu pages (e.g. Learnings) on/off.
6. **Workshop transfer** – export/import the whole setup as a workbook to reuse it.

## 5. Running the day

- Start/stop phases in admin → timers appear for everyone and on `/live`.
- Score phases in Rankings; standings update in real time.
- Publish Learnings at the end → `/learnings` + one-page PDF.

## 6. Development

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `bun test src/lib` (or `node --test`) | Frontend unit tests (`src/lib/*.test.ts`, node:test) |
| `deno test supabase/functions/` | Negotiation engine / admin tests |

Key files: `src/contexts/WorkshopContext.tsx` (state + realtime), `src/lib/api.ts` (edge-function calls), `src/lib/phaseBlocks.ts` (parallel phases), `supabase/functions/_shared/negotiation/engine.ts` (price rules enforced in code, not by the model). Project rules: `AGENTS.md`.

## 7. Security notes

- All writes go through edge functions (`admin-api` = password session, `team-api` = team token); the anon key is read-only.
- Never commit `.env` or any key – `.gitignore` already blocks it.
- Rotate `ADMIN_PASSWORD` and team tokens after each workshop.

## 8. Customising the theme

The Narcos look lives in `tailwind.config.ts`, `src/index.css` and `src/assets/`. The negotiation scenario copy (currently a corn-purchase example) is in `src/negotiation/*` – adapt it to your own scenario.
