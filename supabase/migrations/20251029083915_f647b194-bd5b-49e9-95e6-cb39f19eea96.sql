-- Drop existing tables
DROP TABLE IF EXISTS public.sections CASCADE;
DROP TABLE IF EXISTS public.tools CASCADE;
DROP TABLE IF EXISTS public.phases CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;

-- Create teams table with all fields
CREATE TABLE public.teams (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT DEFAULT '',
  drive_share_url TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  budget INTEGER DEFAULT 0,
  time_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create phases table with all fields
CREATE TABLE public.phases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  background TEXT DEFAULT '',
  output TEXT DEFAULT '',
  budget INTEGER DEFAULT 0,
  tools TEXT[] DEFAULT '{}',
  duration_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'inactive' CHECK (status IN ('inactive', 'running', 'completed')),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  "order" INTEGER NOT NULL
);

-- Create tools table with all fields
CREATE TABLE public.tools (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0
);

-- Create sections table with all fields
CREATE TABLE public.sections (
  id TEXT PRIMARY KEY,
  page_key TEXT NOT NULL CHECK (page_key IN ('home', 'phases', 'aiTools', 'teamsDashboard', 'aboutUs')),
  enabled BOOLEAN DEFAULT true,
  content_rtf TEXT DEFAULT '',
  parameters JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Create public read policies
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Anyone can view phases" ON public.phases FOR SELECT USING (true);
CREATE POLICY "Anyone can view tools" ON public.tools FOR SELECT USING (true);
CREATE POLICY "Anyone can view sections" ON public.sections FOR SELECT USING (true);

-- Create public write policies
CREATE POLICY "Anyone can insert teams" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update teams" ON public.teams FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete teams" ON public.teams FOR DELETE USING (true);

CREATE POLICY "Anyone can insert phases" ON public.phases FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update phases" ON public.phases FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete phases" ON public.phases FOR DELETE USING (true);

CREATE POLICY "Anyone can insert tools" ON public.tools FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tools" ON public.tools FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tools" ON public.tools FOR DELETE USING (true);

CREATE POLICY "Anyone can insert sections" ON public.sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sections" ON public.sections FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sections" ON public.sections FOR DELETE USING (true);