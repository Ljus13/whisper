-- ══════════════════════════════════════════════════════════════════════════════
-- เพิ่ม DELETE policies + grants สำหรับ combat_sessions และ combat_logs
-- (ขาดหายจาก add_combat_system.sql ทำให้ลบห้องต่อสู้ไม่ได้)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── combat_sessions: เพิ่ม DELETE policy ──
DROP POLICY IF EXISTS "combat_sessions_delete" ON public.combat_sessions;
CREATE POLICY "combat_sessions_delete" ON public.combat_sessions
  FOR DELETE USING (public.get_my_role() IN ('admin', 'dm'));

-- ── combat_logs: เพิ่ม DELETE policy ──
DROP POLICY IF EXISTS "combat_logs_delete" ON public.combat_logs;
CREATE POLICY "combat_logs_delete" ON public.combat_logs
  FOR DELETE USING (public.get_my_role() IN ('admin', 'dm'));

-- ── Grants: เพิ่มสิทธิ์ DELETE ──
GRANT DELETE ON public.combat_sessions TO authenticated;
GRANT DELETE ON public.combat_logs TO authenticated;
