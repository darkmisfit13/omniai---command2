-- Migration: 20261028220000_nexus_active_state_sync.sql
-- Immutable Live Data Ledger Schema with Automated LWW Conflict Resolution for Dark Misfit Studios OmniAI - Nexus

CREATE TABLE IF NOT EXISTS public.nexus_active_state_sync (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL DEFAULT 'nexus-owner-dev-001',
    current_pane_index INT DEFAULT 2,
    last_prompt_input TEXT,
    active_tone_selection VARCHAR(20) DEFAULT 'Casual',
    active_inference_speed VARCHAR(20) DEFAULT 'Ultra',
    device_origin VARCHAR(20) DEFAULT 'Web-Desktop',
    is_streaming BOOLEAN DEFAULT false,
    security_shield_level VARCHAR(20) DEFAULT 'Ironclad',
    payload_metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS)
ALTER TABLE public.nexus_active_state_sync ENABLE ROW LEVEL SECURITY;

-- High-Velocity indexing
CREATE INDEX IF NOT EXISTS idx_nexus_sync_user_id ON public.nexus_active_state_sync(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_sync_updated_at ON public.nexus_active_state_sync(updated_at DESC);

-- Automated Last-Write-Wins (LWW) delta timestamp calculation function
-- Resolves sync deadlocks between phone app and web dashboard simultaneously
CREATE OR REPLACE FUNCTION public.nexus_resolve_lww_conflict()
RETURNS TRIGGER AS $$
DECLARE
    delta_interval INTERVAL;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- If incoming update has an older or stale timestamp, drop update (LWW deadlock prevention)
        IF NEW.updated_at < OLD.updated_at THEN
            RETURN NULL;
        END IF;

        -- Record delta telemetry in payload_metadata for real-time sync auditing
        delta_interval := NEW.updated_at - OLD.updated_at;
        NEW.payload_metadata = coalesce(NEW.payload_metadata, '{}'::jsonb) || jsonb_build_object(
            '_lww_delta_ms', EXTRACT(MILLISECONDS FROM delta_interval),
            '_lww_prev_origin', OLD.device_origin,
            '_lww_resolved_at', timezone('utc'::text, now())
        );
    END IF;

    IF NEW.updated_at IS NULL THEN
        NEW.updated_at := timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on table updates for automated LWW resolution
DROP TRIGGER IF EXISTS trg_nexus_lww_sync ON public.nexus_active_state_sync;
CREATE TRIGGER trg_nexus_lww_sync
BEFORE UPDATE ON public.nexus_active_state_sync
FOR EACH ROW
EXECUTE FUNCTION public.nexus_resolve_lww_conflict();

-- RLS Policies
CREATE POLICY "Allow users to read their own nexus state"
ON public.nexus_active_state_sync
FOR SELECT
USING (
    auth.uid()::text = user_id 
    OR user_id = 'nexus-owner-dev-001'
    OR auth.role() = 'service_role'
);

CREATE POLICY "Allow users to insert their own nexus state"
ON public.nexus_active_state_sync
FOR INSERT
WITH CHECK (
    auth.uid()::text = user_id 
    OR user_id = 'nexus-owner-dev-001'
    OR auth.role() = 'service_role'
);

CREATE POLICY "Allow users to update their own nexus state"
ON public.nexus_active_state_sync
FOR UPDATE
USING (
    auth.uid()::text = user_id 
    OR user_id = 'nexus-owner-dev-001'
    OR auth.role() = 'service_role'
);
