-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Skill System Schema
-- Tables: skill_types, skill_pathways, skill_sequences,
--         skills, player_pathways
-- ══════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────────┐
-- │  1. TABLE: skill_types (กลุ่ม)                 │
-- │  Top-level grouping for skills                 │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skill_types (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  description  text,
  sort_order   int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.skill_types IS 'Top-level skill grouping (กลุ่ม). e.g. "เวทมนตร์", "กายภาพ"';

-- ┌────────────────────────────────────────────────┐
-- │  2. TABLE: skill_pathways (เส้นทาง)            │
-- │  Paths within each type                        │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skill_pathways (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id      uuid        NOT NULL REFERENCES public.skill_types(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  description  text,
  sort_order   int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.skill_pathways IS 'Skill pathway within a type (เส้นทาง). e.g. "สายไฟ", "สายน้ำ"';
CREATE INDEX IF NOT EXISTS idx_skill_pathways_type ON public.skill_pathways(type_id);

-- ┌────────────────────────────────────────────────┐
-- │  3. TABLE: skill_sequences (ลำดับ)             │
-- │  Inverted tiers: 9 = weakest → 0 = strongest  │
-- │  Players accumulate skills as they descend     │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skill_sequences (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id   uuid        NOT NULL REFERENCES public.skill_pathways(id) ON DELETE CASCADE,
  seq_number   int         NOT NULL CHECK (seq_number >= 0 AND seq_number <= 9),
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pathway_id, seq_number)
);

COMMENT ON TABLE public.skill_sequences IS 'ลำดับขั้น: 9 = อ่อนแอที่สุด → 0 = แข็งแกร่งที่สุด. สกิลสะสมจากลำดับก่อนหน้า';
CREATE INDEX IF NOT EXISTS idx_skill_sequences_pathway ON public.skill_sequences(pathway_id);

-- ┌────────────────────────────────────────────────┐
-- │  4. TABLE: skills (สกิล)                       │
-- │  Individual skills linked to a pathway         │
-- │  with spirit cost and sequence requirement     │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skills (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id      uuid        NOT NULL REFERENCES public.skill_pathways(id) ON DELETE CASCADE,
  sequence_id     uuid        NOT NULL REFERENCES public.skill_sequences(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  spirit_cost     int         NOT NULL DEFAULT 1,
  icon_url        text,
  sort_order      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.skills IS 'Individual skill definition with spirit cost and sequence requirement.';
COMMENT ON COLUMN public.skills.spirit_cost IS 'จำนวนพลังวิญญาณที่ใช้';
COMMENT ON COLUMN public.skills.sequence_id IS 'ลำดับขั้นขั้นต่ำที่ต้องถึงจึงจะใช้สกิลนี้ได้ (ยิ่งเลขน้อย = ยิ่งยาก)';
CREATE INDEX IF NOT EXISTS idx_skills_pathway ON public.skills(pathway_id);
CREATE INDEX IF NOT EXISTS idx_skills_sequence ON public.skills(sequence_id);

-- ┌────────────────────────────────────────────────┐
-- │  5. TABLE: player_pathways                     │
-- │  Links players to their pathways + sequence    │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.player_pathways (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pathway_id   uuid        REFERENCES public.skill_pathways(id) ON DELETE SET NULL,
  sequence_id  uuid        REFERENCES public.skill_sequences(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, pathway_id)
);

COMMENT ON TABLE public.player_pathways IS 'Player progression: which pathway and current sequence level.';
CREATE INDEX IF NOT EXISTS idx_player_pathways_player ON public.player_pathways(player_id);
CREATE INDEX IF NOT EXISTS idx_player_pathways_pathway ON public.player_pathways(pathway_id);


-- ┌────────────────────────────────────────────────┐
-- │  6. TRIGGER: Auto-create player_pathways       │
-- │  on first login (after profile created)        │
-- └────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_player_pathways()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert a default NULL pathway entry so player has a row in player_pathways
  INSERT INTO public.player_pathways (player_id, pathway_id, sequence_id)
  VALUES (NEW.id, NULL, NULL)
  ON CONFLICT (player_id, pathway_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_pathways ON public.profiles;
CREATE TRIGGER on_profile_created_pathways
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_player_pathways();


-- ┌────────────────────────────────────────────────┐
-- │  7. BACKFILL: Add player_pathways for          │
-- │  existing users who don't have one yet         │
-- └────────────────────────────────────────────────┘
INSERT INTO public.player_pathways (player_id, pathway_id, sequence_id)
SELECT p.id, NULL, NULL
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.player_pathways pp WHERE pp.player_id = p.id
)
ON CONFLICT DO NOTHING;


-- ┌────────────────────────────────────────────────┐
-- │  8. Auto-update updated_at triggers            │
-- └────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_skill_types ON public.skill_types;
CREATE TRIGGER set_updated_at_skill_types
  BEFORE UPDATE ON public.skill_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_skill_pathways ON public.skill_pathways;
CREATE TRIGGER set_updated_at_skill_pathways
  BEFORE UPDATE ON public.skill_pathways
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_skill_sequences ON public.skill_sequences;
CREATE TRIGGER set_updated_at_skill_sequences
  BEFORE UPDATE ON public.skill_sequences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_skills ON public.skills;
CREATE TRIGGER set_updated_at_skills
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_player_pathways ON public.player_pathways;
CREATE TRIGGER set_updated_at_player_pathways
  BEFORE UPDATE ON public.player_pathways
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ┌────────────────────────────────────────────────┐
-- │  9. ROW LEVEL SECURITY                         │
-- │  Uses public.get_my_role() SECURITY DEFINER    │
-- │  to avoid RLS recursion on profiles table      │
-- └────────────────────────────────────────────────┘

-- skill_types: Everyone can read, admin/dm can write
ALTER TABLE public.skill_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill_types"
  ON public.skill_types FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skill_types"
  ON public.skill_types FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_types"
  ON public.skill_types FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_types"
  ON public.skill_types FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skill_pathways: Everyone can read, admin/dm can write
ALTER TABLE public.skill_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill_pathways"
  ON public.skill_pathways FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skill_pathways"
  ON public.skill_pathways FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_pathways"
  ON public.skill_pathways FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_pathways"
  ON public.skill_pathways FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skill_sequences: Everyone can read, admin/dm can write
ALTER TABLE public.skill_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill_sequences"
  ON public.skill_sequences FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skill_sequences"
  ON public.skill_sequences FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_sequences"
  ON public.skill_sequences FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_sequences"
  ON public.skill_sequences FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skills: Everyone can read, admin/dm can write
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skills"
  ON public.skills FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skills"
  ON public.skills FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skills"
  ON public.skills FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skills"
  ON public.skills FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- player_pathways: Players read own, admin/dm reads all, admin/dm writes
ALTER TABLE public.player_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own pathways"
  ON public.player_pathways FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Admin/DM can view all player_pathways"
  ON public.player_pathways FOR SELECT
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM or self can insert player_pathways"
  ON public.player_pathways FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'dm')
    OR auth.uid() = player_id
  );

CREATE POLICY "Admin/DM can update player_pathways"
  ON public.player_pathways FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete player_pathways"
  ON public.player_pathways FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));


-- ══════════════════════════════════════════════════════════════
-- DONE — Skill System Schema
--
-- Summary:
--   ✓ skill_types       — กลุ่ม (Type) top-level grouping
--   ✓ skill_pathways    — เส้นทาง (Pathways) within each type
--   ✓ skill_sequences   — ลำดับ (Sequence) numbered tiers
--   ✓ skills            — สกิล with spirit_cost, sequence requirement
--   ✓ player_pathways   — Player progression tracking
--   ✓ Trigger: auto-create player_pathways on new profile
--   ✓ Backfill: existing users get default NULL entry
--   ✓ updated_at triggers on all tables
--   ✓ RLS: read-all, write-admin for skill tables
--   ✓ RLS: player sees own pathways, admin sees all
-- ══════════════════════════════════════════════════════════════
