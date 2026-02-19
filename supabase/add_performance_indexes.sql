-- ============================================================
-- PERFORMANCE INDEXES — Action Quest System
-- วันที่: 20 กุมภาพันธ์ 2026
-- วิเคราะห์จาก query patterns ใน action-quest.ts
-- ============================================================
-- รัน script นี้ใน Supabase SQL Editor
-- หมายเหตุ: ไม่ใช้ CONCURRENTLY เพราะ SQL Editor รันใน transaction block
-- ============================================================


-- ============================================================
-- 1. action_codes
-- ============================================================
-- getActionCodes: WHERE archived IS NULL OR archived = false, ORDER BY created_at DESC
-- generateActionCode: WHERE code = ?  (unique constraint มีอยู่แล้ว แต่เพิ่ม partial index)
-- submitAction: WHERE code = ?

-- Partial index สำหรับ active codes (archived = false / null) — ใช้ใน list + count
CREATE INDEX IF NOT EXISTS idx_action_codes_active_created
  ON public.action_codes (created_at DESC)
  WHERE archived IS NULL OR archived = false;

-- Index สำหรับ lookup by code (submitAction, generateActionCode collision check)
-- หมายเหตุ: UNIQUE constraint บน code สร้าง index อยู่แล้ว แต่ถ้าไม่มีให้เพิ่ม:
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_action_codes_code
--   ON public.action_codes (code);


-- ============================================================
-- 2. quest_codes
-- ============================================================
-- getQuestCodes: WHERE archived IS NULL OR archived = false, ORDER BY created_at DESC
-- submitQuest: WHERE code = ?
-- generateQuestCode: WHERE code = ? (collision check)

CREATE INDEX IF NOT EXISTS idx_quest_codes_active_created
  ON public.quest_codes (created_at DESC)
  WHERE archived IS NULL OR archived = false;

-- quest_codes.map_id — ใช้ใน getQuestCodes (join maps)
CREATE INDEX IF NOT EXISTS idx_quest_codes_map_id
  ON public.quest_codes (map_id)
  WHERE map_id IS NOT NULL;

-- quest_codes.npc_token_id — ใช้ใน getQuestCodes (join map_tokens)
CREATE INDEX IF NOT EXISTS idx_quest_codes_npc_token_id
  ON public.quest_codes (npc_token_id)
  WHERE npc_token_id IS NOT NULL;


-- ============================================================
-- 3. action_submissions
-- ============================================================
-- getActionSubmissions (admin): ORDER BY created_at DESC, paginate
-- getActionSubmissions (player): WHERE player_id = ?, ORDER BY created_at DESC
-- approveActionSubmission: WHERE id = ? AND status = 'pending'
-- rejectActionSubmission: WHERE id = ? AND status = 'pending'
-- submitAction (repeat check): WHERE player_id = ? AND action_code_id = ?

-- Player submissions — ใช้บ่อยมาก (player view)
CREATE INDEX IF NOT EXISTS idx_action_submissions_player_created
  ON public.action_submissions (player_id, created_at DESC);

-- Admin view — sort ทั้งหมดตาม created_at
CREATE INDEX IF NOT EXISTS idx_action_submissions_created
  ON public.action_submissions (created_at DESC);

-- Repeat limit check: WHERE player_id = ? AND action_code_id = ?
CREATE INDEX IF NOT EXISTS idx_action_submissions_player_code
  ON public.action_submissions (player_id, action_code_id);

-- Pending filter — ใช้ใน approve/reject และ admin pending list
CREATE INDEX IF NOT EXISTS idx_action_submissions_status
  ON public.action_submissions (status)
  WHERE status = 'pending';

-- action_code_id — ใช้ใน getActionSubmissions (join action_codes)
CREATE INDEX IF NOT EXISTS idx_action_submissions_action_code_id
  ON public.action_submissions (action_code_id);


-- ============================================================
-- 4. quest_submissions
-- ============================================================
-- getQuestSubmissions (player): WHERE player_id = ?, ORDER BY created_at DESC
-- getQuestSubmissions (admin): ORDER BY created_at DESC
-- submitQuest (repeat check): WHERE player_id = ? AND quest_code_id = ?

CREATE INDEX IF NOT EXISTS idx_quest_submissions_player_created
  ON public.quest_submissions (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quest_submissions_created
  ON public.quest_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quest_submissions_player_code
  ON public.quest_submissions (player_id, quest_code_id);

CREATE INDEX IF NOT EXISTS idx_quest_submissions_status
  ON public.quest_submissions (status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_quest_submissions_quest_code_id
  ON public.quest_submissions (quest_code_id);


-- ============================================================
-- 5. sleep_requests
-- ============================================================
-- getSleepLogs (admin): ORDER BY created_at DESC
-- getSleepLogs (player): WHERE player_id = ?, ORDER BY created_at DESC
-- submitSleepRequest (today check): WHERE player_id = ? AND created_at >= today
-- getTodaySleepStatus: WHERE player_id = ? AND created_at >= today
-- autoApproveExpiredRequests: WHERE status = 'pending' AND created_at < today

CREATE INDEX IF NOT EXISTS idx_sleep_requests_player_created
  ON public.sleep_requests (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sleep_requests_created
  ON public.sleep_requests (created_at DESC);

-- Pending + date range — ใช้ใน autoApprove และ today check
CREATE INDEX IF NOT EXISTS idx_sleep_requests_status_created
  ON public.sleep_requests (status, created_at DESC)
  WHERE status = 'pending';


-- ============================================================
-- 6. prayer_logs
-- ============================================================
-- getPrayerLogs (admin): ORDER BY created_at DESC
-- getPrayerLogs (player): WHERE player_id = ?, ORDER BY created_at DESC
-- prayer_logs join map_churches (church_id)

CREATE INDEX IF NOT EXISTS idx_prayer_logs_player_created
  ON public.prayer_logs (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prayer_logs_created
  ON public.prayer_logs (created_at DESC);

-- church_id — ใช้ join กับ map_churches
CREATE INDEX IF NOT EXISTS idx_prayer_logs_church_id
  ON public.prayer_logs (church_id);


-- ============================================================
-- 7. punishments
-- ============================================================
-- getPunishments: WHERE archived = false AND is_active = true, ORDER BY created_at DESC

CREATE INDEX IF NOT EXISTS idx_punishments_active_created
  ON public.punishments (created_at DESC)
  WHERE archived = false AND is_active = true;


-- ============================================================
-- 8. punishment_players
-- ============================================================
-- getPunishments: WHERE punishment_id IN (...)
-- punishment_players join profiles (player_id)

CREATE INDEX IF NOT EXISTS idx_punishment_players_punishment_id
  ON public.punishment_players (punishment_id);

CREATE INDEX IF NOT EXISTS idx_punishment_players_player_id
  ON public.punishment_players (player_id);


-- ============================================================
-- 9. punishment_required_tasks
-- ============================================================
-- getPunishments: WHERE punishment_id IN (...)

CREATE INDEX IF NOT EXISTS idx_punishment_required_tasks_punishment_id
  ON public.punishment_required_tasks (punishment_id);


-- ============================================================
-- 10. punishment_logs
-- ============================================================
-- Real-time subscription triggers on this table

CREATE INDEX IF NOT EXISTS idx_punishment_logs_punishment_id
  ON public.punishment_logs (punishment_id);

CREATE INDEX IF NOT EXISTS idx_punishment_logs_player_id
  ON public.punishment_logs (player_id);


-- ============================================================
-- 11. roleplay_submissions
-- ============================================================
-- getRoleplaySubmissions (player): WHERE player_id = ?, ORDER BY created_at DESC
-- getRoleplaySubmissions (admin): ORDER BY created_at DESC

CREATE INDEX IF NOT EXISTS idx_roleplay_submissions_player_created
  ON public.roleplay_submissions (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_roleplay_submissions_created
  ON public.roleplay_submissions (created_at DESC);


-- ============================================================
-- 12. roleplay_links
-- ============================================================
-- getRoleplaySubmissions: WHERE submission_id IN (...)

CREATE INDEX IF NOT EXISTS idx_roleplay_links_submission_id
  ON public.roleplay_links (submission_id);


-- ============================================================
-- 13. map_tokens
-- ============================================================
-- submitSleepRequest: WHERE user_id = ? AND token_type = 'player'
-- submitQuest: WHERE user_id = ?
-- getNpcsForQuestDropdown: WHERE token_type = 'npc'
-- map_tokens join maps (map_id)

CREATE INDEX IF NOT EXISTS idx_map_tokens_user_id_type
  ON public.map_tokens (user_id, token_type)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_map_tokens_token_type
  ON public.map_tokens (token_type);

CREATE INDEX IF NOT EXISTS idx_map_tokens_map_id
  ON public.map_tokens (map_id);


-- ============================================================
-- 14. map_rest_points
-- ============================================================
-- submitSleepRequest: WHERE map_id = ?

CREATE INDEX IF NOT EXISTS idx_map_rest_points_map_id
  ON public.map_rest_points (map_id);


-- ============================================================
-- 15. map_churches
-- ============================================================
-- prayer_logs join map_churches — church_id FK index
-- map_churches join maps (map_id) และ religions (religion_id)

CREATE INDEX IF NOT EXISTS idx_map_churches_map_id
  ON public.map_churches (map_id);

CREATE INDEX IF NOT EXISTS idx_map_churches_religion_id
  ON public.map_churches (religion_id);


-- ============================================================
-- 16. profiles
-- ============================================================
-- requireAdmin: WHERE id = ? (PK อยู่แล้ว)
-- getActionSubmissions: WHERE id IN (...) (PK อยู่แล้ว)
-- role lookup — ใช้บ่อยมากใน requireAdmin

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role)
  WHERE role IN ('admin', 'dm');


-- ============================================================
-- ตรวจสอบ indexes ที่สร้างแล้ว
-- ============================================================
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
