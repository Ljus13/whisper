-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.action_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reward_hp integer NOT NULL DEFAULT 0,
  reward_sanity integer NOT NULL DEFAULT 0,
  reward_travel integer NOT NULL DEFAULT 0,
  reward_spirituality integer NOT NULL DEFAULT 0,
  reward_max_sanity integer NOT NULL DEFAULT 0,
  reward_max_travel integer NOT NULL DEFAULT 0,
  reward_max_spirituality integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  max_repeats integer,
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT action_codes_pkey PRIMARY KEY (id),
  CONSTRAINT action_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.action_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  action_code_id uuid NOT NULL,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT action_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT action_submissions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT action_submissions_action_code_id_fkey FOREIGN KEY (action_code_id) REFERENCES public.action_codes(id),
  CONSTRAINT action_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.granted_skill_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  granted_skill_id uuid,
  player_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['grant'::text, 'use'::text, 'expire'::text, 'revoke'::text])),
  title text NOT NULL,
  detail text,
  effects_json jsonb,
  reference_code text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT granted_skill_logs_pkey PRIMARY KEY (id),
  CONSTRAINT granted_skill_logs_granted_skill_id_fkey FOREIGN KEY (granted_skill_id) REFERENCES public.granted_skills(id),
  CONSTRAINT granted_skill_logs_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT granted_skill_logs_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id),
  CONSTRAINT granted_skill_logs_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.granted_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  title text NOT NULL,
  detail text,
  reuse_policy text NOT NULL DEFAULT 'once'::text CHECK (reuse_policy = ANY (ARRAY['once'::text, 'cooldown'::text, 'unlimited'::text])),
  cooldown_minutes integer,
  expires_at timestamp with time zone,
  effect_hp integer NOT NULL DEFAULT 0,
  effect_sanity integer NOT NULL DEFAULT 0,
  effect_max_sanity integer NOT NULL DEFAULT 0,
  effect_travel integer NOT NULL DEFAULT 0,
  effect_max_travel integer NOT NULL DEFAULT 0,
  effect_spirituality integer NOT NULL DEFAULT 0,
  effect_max_spirituality integer NOT NULL DEFAULT 0,
  effect_potion_digest integer NOT NULL DEFAULT 0,
  times_used integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  CONSTRAINT granted_skills_pkey PRIMARY KEY (id),
  CONSTRAINT granted_skills_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT granted_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id),
  CONSTRAINT granted_skills_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.map_churches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL,
  religion_id uuid NOT NULL,
  position_x double precision NOT NULL DEFAULT 50,
  position_y double precision NOT NULL DEFAULT 50,
  radius double precision NOT NULL DEFAULT 10,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_churches_pkey PRIMARY KEY (id),
  CONSTRAINT map_churches_map_id_fkey FOREIGN KEY (map_id) REFERENCES public.maps(id),
  CONSTRAINT map_churches_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(id),
  CONSTRAINT map_churches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.map_locked_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL,
  zone_x double precision NOT NULL,
  zone_y double precision NOT NULL,
  zone_width double precision NOT NULL,
  zone_height double precision NOT NULL,
  message text NOT NULL DEFAULT 'พื้นที่นี้ถูกล็อค'::text,
  allowed_user_ids ARRAY NOT NULL DEFAULT '{}'::uuid[],
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_locked_zones_pkey PRIMARY KEY (id),
  CONSTRAINT map_locked_zones_map_id_fkey FOREIGN KEY (map_id) REFERENCES public.maps(id),
  CONSTRAINT map_locked_zones_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.map_rest_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL,
  name text NOT NULL,
  image_url text,
  radius double precision NOT NULL DEFAULT 10,
  position_x double precision NOT NULL DEFAULT 50,
  position_y double precision NOT NULL DEFAULT 50,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_rest_points_pkey PRIMARY KEY (id),
  CONSTRAINT map_rest_points_map_id_fkey FOREIGN KEY (map_id) REFERENCES public.maps(id),
  CONSTRAINT map_rest_points_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.map_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL,
  user_id uuid,
  npc_name text,
  npc_image_url text,
  token_type text NOT NULL DEFAULT 'player'::text CHECK (token_type = ANY (ARRAY['player'::text, 'npc'::text])),
  position_x double precision NOT NULL DEFAULT 50,
  position_y double precision NOT NULL DEFAULT 50,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  interaction_radius double precision NOT NULL DEFAULT 0,
  CONSTRAINT map_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT map_tokens_map_id_fkey FOREIGN KEY (map_id) REFERENCES public.maps(id),
  CONSTRAINT map_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT map_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.maps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  embed_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT maps_pkey PRIMARY KEY (id),
  CONSTRAINT maps_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.pathway_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  pathway_id uuid NOT NULL,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pathway_grants_pkey PRIMARY KEY (id),
  CONSTRAINT pathway_grants_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT pathway_grants_pathway_id_fkey FOREIGN KEY (pathway_id) REFERENCES public.skill_pathways(id),
  CONSTRAINT pathway_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.player_pathways (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  pathway_id uuid,
  sequence_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_pathways_pkey PRIMARY KEY (id),
  CONSTRAINT player_pathways_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT player_pathways_pathway_id_fkey FOREIGN KEY (pathway_id) REFERENCES public.skill_pathways(id),
  CONSTRAINT player_pathways_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.skill_sequences(id)
);
CREATE TABLE public.prayer_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  church_id uuid NOT NULL,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  sanity_gained integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prayer_logs_pkey PRIMARY KEY (id),
  CONSTRAINT prayer_logs_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id),
  CONSTRAINT prayer_logs_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.map_churches(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text,
  avatar_url text,
  role USER-DEFINED NOT NULL DEFAULT 'player'::user_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  spirituality integer NOT NULL DEFAULT 15,
  max_spirituality integer NOT NULL DEFAULT 15,
  travel_points integer NOT NULL DEFAULT 9,
  max_travel_points integer NOT NULL DEFAULT 9,
  hp integer NOT NULL DEFAULT 1 CHECK (hp >= 0),
  sanity integer NOT NULL DEFAULT 10,
  max_sanity integer NOT NULL DEFAULT 10,
  sanity_last_decay timestamp with time zone NOT NULL DEFAULT now(),
  background_url text,
  bio text,
  display_name_set boolean NOT NULL DEFAULT false,
  religion_id uuid,
  potion_digest_progress integer NOT NULL DEFAULT 0 CHECK (potion_digest_progress >= 0 AND potion_digest_progress <= 100),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(id)
);
CREATE TABLE public.punishment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  punishment_id uuid NOT NULL,
  player_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT punishment_logs_pkey PRIMARY KEY (id),
  CONSTRAINT punishment_logs_punishment_id_fkey FOREIGN KEY (punishment_id) REFERENCES public.punishments(id),
  CONSTRAINT punishment_logs_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT punishment_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.punishment_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  punishment_id uuid NOT NULL,
  player_id uuid NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  penalty_applied boolean NOT NULL DEFAULT false,
  mercy_requested boolean NOT NULL DEFAULT false,
  mercy_requested_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT punishment_players_pkey PRIMARY KEY (id),
  CONSTRAINT punishment_players_punishment_id_fkey FOREIGN KEY (punishment_id) REFERENCES public.punishments(id),
  CONSTRAINT punishment_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.punishment_required_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  punishment_id uuid NOT NULL,
  action_code_id uuid,
  quest_code_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT punishment_required_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT punishment_required_tasks_punishment_id_fkey FOREIGN KEY (punishment_id) REFERENCES public.punishments(id),
  CONSTRAINT punishment_required_tasks_action_code_id_fkey FOREIGN KEY (action_code_id) REFERENCES public.action_codes(id),
  CONSTRAINT punishment_required_tasks_quest_code_id_fkey FOREIGN KEY (quest_code_id) REFERENCES public.quest_codes(id)
);
CREATE TABLE public.punishments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  penalty_sanity integer NOT NULL DEFAULT 0,
  penalty_hp integer NOT NULL DEFAULT 0,
  penalty_travel integer NOT NULL DEFAULT 0,
  penalty_spirituality integer NOT NULL DEFAULT 0,
  penalty_max_sanity integer NOT NULL DEFAULT 0,
  penalty_max_travel integer NOT NULL DEFAULT 0,
  penalty_max_spirituality integer NOT NULL DEFAULT 0,
  deadline timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  event_mode text NOT NULL DEFAULT 'solo'::text CHECK (event_mode = ANY (ARRAY['solo'::text, 'group'::text])),
  group_mode text NOT NULL DEFAULT 'all'::text CHECK (group_mode = ANY (ARRAY['all'::text, 'shared'::text])),
  primary_submitter_id uuid,
  CONSTRAINT punishments_pkey PRIMARY KEY (id),
  CONSTRAINT punishments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT punishments_primary_submitter_id_fkey FOREIGN KEY (primary_submitter_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.quest_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  map_id uuid,
  npc_token_id uuid,
  expires_at timestamp with time zone,
  max_repeats integer,
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT quest_codes_pkey PRIMARY KEY (id),
  CONSTRAINT quest_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT quest_codes_map_id_fkey FOREIGN KEY (map_id) REFERENCES public.maps(id),
  CONSTRAINT quest_codes_npc_token_id_fkey FOREIGN KEY (npc_token_id) REFERENCES public.map_tokens(id)
);
CREATE TABLE public.quest_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  quest_code_id uuid NOT NULL,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quest_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT quest_submissions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT quest_submissions_quest_code_id_fkey FOREIGN KEY (quest_code_id) REFERENCES public.quest_codes(id),
  CONSTRAINT quest_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.religions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name_th text NOT NULL,
  name_en text NOT NULL,
  deity_th text,
  deity_en text,
  overview text,
  bg_url text,
  logo_url text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  teachings text,
  CONSTRAINT religions_pkey PRIMARY KEY (id),
  CONSTRAINT religions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.roleplay_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  url text NOT NULL,
  digest_level text NOT NULL DEFAULT 'pending'::text CHECK (digest_level = ANY (ARRAY['pending'::text, 'none'::text, 'low'::text, 'medium'::text, 'high'::text])),
  digest_percent integer NOT NULL DEFAULT 0,
  digest_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roleplay_links_pkey PRIMARY KEY (id),
  CONSTRAINT roleplay_links_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.roleplay_submissions(id),
  CONSTRAINT roleplay_links_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.roleplay_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  submitted_date date NOT NULL DEFAULT (now())::date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roleplay_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT roleplay_submissions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.skill_pathways (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  bg_url text,
  logo_url text,
  overview text,
  video_url text,
  CONSTRAINT skill_pathways_pkey PRIMARY KEY (id),
  CONSTRAINT skill_pathways_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.skill_types(id)
);
CREATE TABLE public.skill_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL,
  seq_number integer NOT NULL CHECK (seq_number >= 0 AND seq_number <= 9),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  roleplay_keywords text,
  CONSTRAINT skill_sequences_pkey PRIMARY KEY (id),
  CONSTRAINT skill_sequences_pathway_id_fkey FOREIGN KEY (pathway_id) REFERENCES public.skill_pathways(id)
);
CREATE TABLE public.skill_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  overview text,
  CONSTRAINT skill_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.skill_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  spirit_cost integer NOT NULL DEFAULT 0,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  reference_code text,
  note text,
  success_rate integer,
  roll integer,
  outcome text,
  CONSTRAINT skill_usage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT skill_usage_logs_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT skill_usage_logs_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id)
);
CREATE TABLE public.skills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL,
  sequence_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  spirit_cost integer NOT NULL DEFAULT 1,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT skills_pkey PRIMARY KEY (id),
  CONSTRAINT skills_pathway_id_fkey FOREIGN KEY (pathway_id) REFERENCES public.skill_pathways(id),
  CONSTRAINT skills_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.skill_sequences(id)
);
CREATE TABLE public.sleep_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  meal_url text NOT NULL,
  sleep_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sleep_requests_pkey PRIMARY KEY (id),
  CONSTRAINT sleep_requests_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id),
  CONSTRAINT sleep_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.travel_roleplay_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  token_id uuid,
  from_map_id uuid,
  to_map_id uuid,
  from_x double precision,
  from_y double precision,
  to_x double precision,
  to_y double precision,
  origin_url text NOT NULL,
  destination_url text NOT NULL,
  move_type text NOT NULL DEFAULT 'same_map'::text CHECK (move_type = ANY (ARRAY['same_map'::text, 'cross_map'::text, 'first_entry'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT travel_roleplay_logs_pkey PRIMARY KEY (id),
  CONSTRAINT travel_roleplay_logs_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id),
  CONSTRAINT travel_roleplay_logs_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.map_tokens(id),
  CONSTRAINT travel_roleplay_logs_from_map_id_fkey FOREIGN KEY (from_map_id) REFERENCES public.maps(id),
  CONSTRAINT travel_roleplay_logs_to_map_id_fkey FOREIGN KEY (to_map_id) REFERENCES public.maps(id)
);