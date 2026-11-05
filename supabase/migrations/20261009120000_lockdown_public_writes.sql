-- Lock down public access. All writes now go through the `admin-api`
-- (password protected) and `team-api` (team token) edge functions, which
-- use the service role. The anon key becomes read-only.

-- 1) Remove public write policies
DROP POLICY IF EXISTS "Anyone can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can update teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can delete teams" ON public.teams;

DROP POLICY IF EXISTS "Anyone can insert phases" ON public.phases;
DROP POLICY IF EXISTS "Anyone can update phases" ON public.phases;
DROP POLICY IF EXISTS "Anyone can delete phases" ON public.phases;

DROP POLICY IF EXISTS "Anyone can insert tools" ON public.tools;
DROP POLICY IF EXISTS "Anyone can update tools" ON public.tools;
DROP POLICY IF EXISTS "Anyone can delete tools" ON public.tools;

DROP POLICY IF EXISTS "Anyone can insert sections" ON public.sections;
DROP POLICY IF EXISTS "Anyone can update sections" ON public.sections;
DROP POLICY IF EXISTS "Anyone can delete sections" ON public.sections;

-- Defence in depth: no direct writes from browser roles even if a permissive
-- policy is re-added by mistake.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.teams, public.phases, public.tools, public.sections FROM anon, authenticated;

-- 2) Hide team secrets: anon may read every column except token and drive_share_url
REVOKE SELECT ON public.teams FROM anon, authenticated;
GRANT SELECT (
  id, name, logo_url, budget, time_weeks, status, created_at, updated_at,
  expected_revenue, time_bonus, total_revenue, last_recalculated, rank
) ON public.teams TO anon, authenticated;

-- 3) Storage: public read only; uploads use signed upload URLs issued by the edge functions
DROP POLICY IF EXISTS "Teams can upload their own logos" ON storage.objects;
DROP POLICY IF EXISTS "Teams can update their own logos" ON storage.objects;
DROP POLICY IF EXISTS "Teams can delete their own logos" ON storage.objects;
