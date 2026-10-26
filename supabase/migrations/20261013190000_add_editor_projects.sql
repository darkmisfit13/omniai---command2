-- OmniAI editor projects.
-- Non-destructive: creates a new table and does not modify existing tables.
-- Apply this migration through the existing Supabase workflow only after review.

CREATE TABLE IF NOT EXISTS public.editor_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  project_version integer NOT NULL DEFAULT 1 CHECK (project_version = 1),
  project_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT editor_projects_data_object CHECK (jsonb_typeof(project_data) = 'object')
);

CREATE INDEX IF NOT EXISTS editor_projects_owner_updated_idx
  ON public.editor_projects (owner_id, updated_at DESC);

ALTER TABLE public.editor_projects ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.editor_projects TO authenticated;

DROP POLICY IF EXISTS "editor projects owner access" ON public.editor_projects;
CREATE POLICY "editor projects owner access"
  ON public.editor_projects
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE OR REPLACE FUNCTION public.editor_projects_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS editor_projects_updated_at ON public.editor_projects;
CREATE TRIGGER editor_projects_updated_at
  BEFORE UPDATE ON public.editor_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.editor_projects_touch_updated_at();
