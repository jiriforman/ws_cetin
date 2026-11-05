-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  project_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create phases table
CREATE TABLE public.phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  background TEXT,
  output TEXT,
  budget INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  "order" INTEGER NOT NULL,
  is_running BOOLEAN DEFAULT false,
  start_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create tools table
CREATE TABLE public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_path TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sections table
CREATE TABLE public.sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content_rtf TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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

-- Create public write policies (for now - should be admin-only in production)
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