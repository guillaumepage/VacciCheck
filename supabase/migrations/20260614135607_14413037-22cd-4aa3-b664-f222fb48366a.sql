CREATE TABLE public.vaccine_carnets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  source_filename TEXT,
  raw_markdown TEXT,
  page_count INT,
  expected_entries INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccine_carnets TO authenticated;
GRANT ALL ON public.vaccine_carnets TO service_role;
ALTER TABLE public.vaccine_carnets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own carnets" ON public.vaccine_carnets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all carnets" ON public.vaccine_carnets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.vaccine_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  carnet_id UUID NOT NULL REFERENCES public.vaccine_carnets(id) ON DELETE CASCADE,
  given_at DATE,
  vaccine_generic TEXT,
  commercial_name TEXT,
  lot TEXT,
  site TEXT,
  dose TEXT,
  notes TEXT,
  page_number INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccine_entries TO authenticated;
GRANT ALL ON public.vaccine_entries TO service_role;
ALTER TABLE public.vaccine_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own entries" ON public.vaccine_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all entries" ON public.vaccine_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vaccine_carnets_updated_at BEFORE UPDATE ON public.vaccine_carnets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER vaccine_entries_updated_at BEFORE UPDATE ON public.vaccine_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX vaccine_entries_carnet_idx ON public.vaccine_entries(carnet_id);
CREATE INDEX vaccine_entries_user_idx ON public.vaccine_entries(user_id);
CREATE INDEX vaccine_carnets_user_idx ON public.vaccine_carnets(user_id);