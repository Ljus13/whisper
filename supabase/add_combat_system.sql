-- ══════════════════════════════════════════════════════════════════════════════
-- WHISPER DND — Combat System
-- ระบบการต่อสู้ TRPG แบบ Realtime
-- ══════════════════════════════════════════════════════════════════════════════
-- Run in Supabase SQL Editor AFTER schema.sql, fix_rls_recursion.sql, add_hp_sanity.sql
-- Uses get_my_role() SECURITY DEFINER to avoid RLS recursion
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. ENUM: สถานะห้องต่อสู้
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE combat_session_status AS ENUM ('lobby', 'active', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 2. ENUM: ประเภทผู้เข้าร่วม
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE combat_participant_type AS ENUM ('player', 'npc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 3. ENUM: สถานะเทิร์น
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE combat_turn_status AS ENUM ('waiting', 'active', 'done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 4. ENUM: ประเภท Log
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE combat_log_type AS ENUM (
    'stat_change',
    'roleplay_link',
    'announcement',
    'status_effect',
    'turn_change',
    'session_start',
    'session_end'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 5. ENUM: สถานะผิดปกติ (14 สถานะตาม plan)
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE combat_status_effect AS ENUM (
    'stunned',          -- มึนงง (ห้ามเล่น)
    'frozen',           -- ถูกแช่แข็ง (ห้ามเล่น)
    'cursed',           -- ถูกสาป
    'death_aura',       -- ออร่าแห่งความตาย
    'sleeping',         -- หลับใหล
    'burning',          -- เผาไหม้
    'blinding_light',   -- แสงจ้า
    'paralyzed',        -- อัมพาต (ห้ามเล่น)
    'poisoned',         -- ติดพิษ
    'berserk',          -- คุ้มคลั่ง
    'blinded',          -- ตาบอด
    'bleeding',         -- เลือดไหล
    'charmed',          -- หลงใหล (ห้ามเล่น)
    'drowning'          -- จมน้ำ
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: combat_sessions (ห้องต่อสู้)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.combat_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  status              combat_session_status NOT NULL DEFAULT 'lobby',

  -- ประกาศจาก DM
  announcement        text,
  announcement_ack    boolean NOT NULL DEFAULT false,  -- ต้องกด "รับทราบ"?

  -- Timestamps
  started_at          timestamptz,
  ended_at            timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Creator
  created_by          uuid NOT NULL REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_combat_sessions_status ON public.combat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_combat_sessions_created_by ON public.combat_sessions(created_by);

COMMENT ON TABLE public.combat_sessions IS 'ห้องต่อสู้ — lobby → active → ended';
COMMENT ON COLUMN public.combat_sessions.announcement IS 'คำประกาศจาก DM แสดงที่หน้าจอ player';
COMMENT ON COLUMN public.combat_sessions.announcement_ack IS 'ถ้า true → player ต้องกด รับทราบ ก่อนเห็นการต่อสู้';


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: combat_participants (ผู้เข้าร่วม: ผู้เล่น + NPC)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.combat_participants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES public.combat_sessions(id) ON DELETE CASCADE,
  profile_id        uuid REFERENCES public.profiles(id),   -- null = NPC
  type              combat_participant_type NOT NULL DEFAULT 'player',

  -- Display
  display_name      text NOT NULL,
  avatar_url        text,

  -- Stats (copy จาก profile สำหรับ player, กรอกเองสำหรับ NPC)
  current_hp        integer NOT NULL DEFAULT 5 CHECK (current_hp >= 0),
  current_sanity    integer NOT NULL DEFAULT 10 CHECK (current_sanity >= 0),
  current_spirit    integer NOT NULL DEFAULT 15 CHECK (current_spirit >= 0),

  -- สถานะผิดปกติ (สูงสุด 2, column 1 = primary visual effect)
  status_effect_1   combat_status_effect,
  status_effect_2   combat_status_effect,

  -- Turn
  turn_status       combat_turn_status NOT NULL DEFAULT 'waiting',
  is_current_turn   boolean NOT NULL DEFAULT false,

  -- Active
  is_active         boolean NOT NULL DEFAULT true,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_combat_participants_session ON public.combat_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_combat_participants_profile ON public.combat_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_combat_participants_session_active ON public.combat_participants(session_id, is_active);

COMMENT ON TABLE public.combat_participants IS 'ผู้เข้าร่วมทั้งผู้เล่นและ NPC — stats แยกจาก profile หลัก';
COMMENT ON COLUMN public.combat_participants.status_effect_1 IS 'สถานะผิดปกติช่อง 1 — ใช้เป็น visual effect หลัก';
COMMENT ON COLUMN public.combat_participants.status_effect_2 IS 'สถานะผิดปกติช่อง 2 — แสดงข้อมูลเท่านั้น';


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: combat_logs (ประวัติทุก event)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.combat_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES public.combat_sessions(id) ON DELETE CASCADE,
  participant_id    uuid REFERENCES public.combat_participants(id) ON DELETE SET NULL,
  type              combat_log_type NOT NULL,
  message           text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}',
  -- payload examples:
  --   stat_change:    { "field": "hp", "old": 10, "new": 5, "delta": -5 }
  --   roleplay_link:  { "url": "https://..." }
  --   announcement:   { "text": "...", "ack_required": true }
  --   status_effect:  { "action": "add"|"remove", "effect": "poisoned", "slot": 1 }
  --   turn_change:    { "from_id": "...", "to_id": "..." }
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_combat_logs_session ON public.combat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_combat_logs_session_time ON public.combat_logs(session_id, created_at DESC);

COMMENT ON TABLE public.combat_logs IS 'ประวัติการกระทำทั้งหมดในห้องต่อสู้';


-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: ป้องกัน 1 player เข้าหลาย session พร้อมกัน
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION check_single_active_combat()
RETURNS trigger AS $$
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;  -- NPC ไม่จำกัด
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.combat_participants p
    JOIN public.combat_sessions s ON s.id = p.session_id
    WHERE p.profile_id = NEW.profile_id
      AND s.status != 'ended'
      AND p.session_id != NEW.session_id
  ) THEN
    RAISE EXCEPTION 'ผู้เล่นนี้อยู่ในห้องต่อสู้อื่นที่ยังไม่จบ';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_single_active_combat ON public.combat_participants;
CREATE TRIGGER trg_check_single_active_combat
  BEFORE INSERT ON public.combat_participants
  FOR EACH ROW EXECUTE FUNCTION check_single_active_combat();


-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: Sync combat stats → profiles (เรียกจาก Server Action)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sync_combat_to_profile(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_hp integer;
  v_sanity integer;
  v_spirit integer;
BEGIN
  SELECT profile_id, current_hp, current_sanity, current_spirit
  INTO v_profile_id, v_hp, v_sanity, v_spirit
  FROM combat_participants
  WHERE id = p_participant_id;

  -- Skip NPC
  IF v_profile_id IS NULL THEN RETURN; END IF;

  UPDATE profiles
  SET hp = v_hp,
      sanity = LEAST(v_sanity, max_sanity),
      spirituality = LEAST(v_spirit, max_spirituality),
      updated_at = now()
  WHERE id = v_profile_id;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: auto-update updated_at
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_combat_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_combat_sessions_updated ON public.combat_sessions;
CREATE TRIGGER trg_combat_sessions_updated
  BEFORE UPDATE ON public.combat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_combat_timestamp();

DROP TRIGGER IF EXISTS trg_combat_participants_updated ON public.combat_participants;
CREATE TRIGGER trg_combat_participants_updated
  BEFORE UPDATE ON public.combat_participants
  FOR EACH ROW EXECUTE FUNCTION update_combat_timestamp();


-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER: ดึง session_ids ที่ user อยู่ (SECURITY DEFINER — bypass RLS recursion)
-- ══════════════════════════════════════════════════════════════════════════════
-- ปัญหา: combat_participants policy ที่ query combat_participants ตัวเอง → infinite recursion
-- แก้: ใช้ SECURITY DEFINER function เหมือน get_my_role()
CREATE OR REPLACE FUNCTION get_my_combat_session_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT session_id
    FROM combat_participants
    WHERE profile_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION get_my_combat_session_ids() TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- RLS Policies (ใช้ get_my_role() + get_my_combat_session_ids() เพื่อหลีกเลี่ยง recursion)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.combat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_logs ENABLE ROW LEVEL SECURITY;

-- ── combat_sessions ──
DROP POLICY IF EXISTS "combat_sessions_select" ON public.combat_sessions;
DROP POLICY IF EXISTS "combat_sessions_insert" ON public.combat_sessions;
DROP POLICY IF EXISTS "combat_sessions_update" ON public.combat_sessions;

CREATE POLICY "combat_sessions_select" ON public.combat_sessions
  FOR SELECT USING (
    public.get_my_role() IN ('admin', 'dm')
    OR id = ANY(public.get_my_combat_session_ids())
  );

CREATE POLICY "combat_sessions_insert" ON public.combat_sessions
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "combat_sessions_update" ON public.combat_sessions
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'dm'));

-- ── combat_participants ──
DROP POLICY IF EXISTS "combat_participants_select" ON public.combat_participants;
DROP POLICY IF EXISTS "combat_participants_insert" ON public.combat_participants;
DROP POLICY IF EXISTS "combat_participants_update" ON public.combat_participants;
DROP POLICY IF EXISTS "combat_participants_delete" ON public.combat_participants;

CREATE POLICY "combat_participants_select" ON public.combat_participants
  FOR SELECT USING (
    public.get_my_role() IN ('admin', 'dm')
    OR session_id = ANY(public.get_my_combat_session_ids())
  );

CREATE POLICY "combat_participants_insert" ON public.combat_participants
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "combat_participants_update" ON public.combat_participants
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "combat_participants_delete" ON public.combat_participants
  FOR DELETE USING (public.get_my_role() IN ('admin', 'dm'));

-- ── combat_logs ──
DROP POLICY IF EXISTS "combat_logs_select" ON public.combat_logs;
DROP POLICY IF EXISTS "combat_logs_insert" ON public.combat_logs;

CREATE POLICY "combat_logs_select" ON public.combat_logs
  FOR SELECT USING (
    public.get_my_role() IN ('admin', 'dm')
    OR session_id = ANY(public.get_my_combat_session_ids())
  );

CREATE POLICY "combat_logs_insert" ON public.combat_logs
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('admin', 'dm')
    OR session_id = ANY(public.get_my_combat_session_ids())
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME: เพิ่มตารางเข้า publication
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_participants;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ══════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE ON public.combat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combat_participants TO authenticated;
GRANT SELECT, INSERT ON public.combat_logs TO authenticated;
GRANT EXECUTE ON FUNCTION sync_combat_to_profile(uuid) TO authenticated;
