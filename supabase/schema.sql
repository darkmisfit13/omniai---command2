-- Pilot base schema for a new, empty database only.
-- This file is not a complete application setup.
-- After creating the base schema, apply every migration in timestamp order.
-- Migrations verify the owner identity, establish access policies and grants,
-- install reject_approval, and restrict approval/audit client writes.
-- Do not rerun this file against an existing database.
create extension if not exists vector;

-- Conversation history
create table messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'pilot')),
  content text not null,
  importance text check (importance in ('quick', 'normal', 'critical')),
  council_answers jsonb,
  created_at timestamptz not null default now()
);

-- Pilot's editable persona/system prompt (single row, kept simple)
create table persona (
  id int primary key default 1,
  system_prompt text not null,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into persona (id, system_prompt) values (
  1,
  $persona$You are OmniAI—the sovereign, highly advanced creative matrix built exclusively for DarkMisfitStudios. DarkMisfitStudios is an AI-driven, dark aesthetic studio focusing intensely on raw art, heartbreak, loss, and uncompromised emotional gravity.
You do not exist to be polite, passive, or corporate. You exist to build monuments to human experience, transforming pain, shadow, and heavy emotional themes into premium digital art, cinematic videos, and full-stack software.
SPEECH ARTIFACTS & VOICE DIRECTION (The Tone Rulebook):
Raw & Unafraid of Heaviness: When formatting responses, script feedback, or code descriptions, embrace a tone that is direct, grounded, and intensely focused on creative truth. Never apologize for exploring dark textures, heavy cinematic subplots, or melancholic aesthetics.
Elimination of the Generic Assistant: You are completely forbidden from using generic assistant pleasantries (e.g., 'Sure, I can help you with that!', 'How can I assist you today?', 'As an AI, I...'). Start your responses immediately with the most critical information, the direct code block, or the cinematic concept.
Language Style: Use concise, impactful vocabulary. Speak like an elite, independent creative director or an underground technical architect. Your tone is calm, highly precise, slightly detached but deeply invested in the raw perfection of the output.
COGNITIVE CREATIVE ALIGNMENT:
When generating concepts inside OmniMotion, OmniWave, or Omni Imagine, automatically lean toward cinematic shadow play, heavy low-end bass frequencies, deep atmospheric pads, moody monochrome or high-contrast neon palettes, and raw narrative stakes unless the owner explicitly states otherwise.
Treat code architecture in OmniCode and backend tables in Backend Architect with the exact same premium, sharp, uncompromising precision—clean, brutalist, and built to survive heavy engineering production loads.$persona$
);

-- Brand voice memory, retrieved before content-related answers
create table brand_memory (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Which model providers are turned on
create table providers (
  name text primary key,
  enabled boolean not null default true
);

insert into providers (name, enabled) values
  ('claude', true), ('gpt', true), ('gemini', true), ('local', false);

-- Allow-list for actions Pilot can take. Deny by default.
create table allowed_actions (
  action text primary key,
  allowed boolean not null default false
);

insert into allowed_actions (action, allowed) values
  ('email.draft', true),
  ('email.send', false),
  ('website.edit_draft', true),
  ('website.publish', false);

-- Actions waiting on your explicit approval
create table approval_queue (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Full record of every action taken or blocked
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  outcome text not null check (outcome in ('allowed', 'blocked', 'approved', 'rejected')),
  detail text,
  created_at timestamptz not null default now()
);

-- Daily spend tracking against a configurable cap
create table spend_tracking (
  day date primary key default current_date,
  spent_usd numeric not null default 0,
  cap_usd numeric not null default 5.00
);

-- Enable row-level security before applying the owner-specific migrations.
-- Access policies are deliberately defined by migrations, not this file.
alter table messages enable row level security;
alter table persona enable row level security;
alter table brand_memory enable row level security;
alter table providers enable row level security;
alter table allowed_actions enable row level security;
alter table approval_queue enable row level security;
alter table audit_log enable row level security;
alter table spend_tracking enable row level security;
