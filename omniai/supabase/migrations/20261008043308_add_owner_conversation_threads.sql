CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT 'New chat' CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.conversations FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.conversations FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.conversations TO authenticated;
CREATE POLICY owner_conversations ON public.conversations FOR ALL TO authenticated
USING (owner_id = (SELECT auth.uid()) AND (SELECT auth.uid()) = '07332edf-15ce-434b-b683-4c68a7277030'::uuid)
WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT auth.uid()) = '07332edf-15ce-434b-b683-4c68a7277030'::uuid);
ALTER TABLE public.messages ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE RESTRICT;
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at, id);
DO $$
DECLARE
  verified_owner uuid;
  legacy_thread uuid;
BEGIN
  SELECT id INTO verified_owner FROM auth.users WHERE id = '07332edf-15ce-434b-b683-4c68a7277030'::uuid AND email = 'darkmisfitlabs@hotmail.com';
  IF verified_owner IS NULL THEN
    RAISE EXCEPTION 'Owner identity mismatch; migration aborted';
  END IF;
  INSERT INTO public.conversations (owner_id, title) VALUES (verified_owner, 'Previous conversations') RETURNING id INTO legacy_thread;
  UPDATE public.messages SET conversation_id = legacy_thread WHERE conversation_id IS NULL;
END
$$;
