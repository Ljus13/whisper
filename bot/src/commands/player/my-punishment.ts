import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS, progressBar } from '../../lib/embeds'
import { config } from '../../config'

export const data = new SlashCommandBuilder()
  .setName('my-punishment')
  .setDescription('ดูบทลงโทษและเหตุการณ์ที่ยังค้างอยู่ของคุณ ⚖️')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  // ── ดึง punishments ที่ active สำหรับผู้เล่นคนนี้ ──
  const { data: playerPunishments, error } = await supabase
    .from('punishment_players')
    .select(`
      id,
      is_completed,
      penalty_applied,
      mercy_requested,
      mercy_requested_at,
      completed_at,
      created_at,
      punishment:punishments!punishment_id (
        id,
        name,
        description,
        event_mode,
        group_mode,
        deadline,
        is_active,
        created_at,
        penalty_hp,
        penalty_sanity,
        penalty_travel,
        penalty_spirituality,
        penalty_max_sanity,
        penalty_max_travel,
        penalty_max_spirituality
      )
    `)
    .eq('player_id', profile.id)
    .eq('penalty_applied', false)
    .order('created_at', { ascending: false })

  if (error) {
    await interaction.editReply({ content: `❌ เกิดข้อผิดพลาด: ${error.message}` })
    return
  }

  // กรอง punishment ที่ยัง active
  const active = (playerPunishments ?? []).filter(pp => {
    const pun = pp.punishment as any
    return pun?.is_active === true
  })

  if (active.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle('✅ ไม่มีบทลงโทษที่ค้างอยู่')
      .setDescription('คุณผ่านพ้นวิกฤตแล้ว !')
      .setTimestamp()
    await interaction.editReply({ embeds: [embed] })
    return
  }

  // ── สร้าง embed สำหรับแต่ละ punishment ──
  const embeds: EmbedBuilder[] = []

  for (const pp of active) {
    const pun = pp.punishment as any
    if (!pun) continue

    const embed = await buildPunishmentEmbed(pun, pp, profile.id)
    embeds.push(embed)
  }

  // Discord รับ embed สูงสุด 10 อัน — แสดงสูงสุด 5 อัน (เพราะแต่ละอันอาจมี field เยอะ)
  const limitedEmbeds = embeds.slice(0, 5)

  const headerEmbed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle(`⚖️ บทลงโทษที่ค้างอยู่ — ${active.length} รายการ`)
    .setDescription(
      active.length > 5
        ? `แสดง 5 จาก ${active.length} รายการ — ดูทั้งหมดได้ที่เว็บ 🔗 ${config.webUrl}/dashboard`
        : 'กรุณาดำเนินการให้ครบก่อนเส้นตาย',
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [headerEmbed, ...limitedEmbeds] })
}

// ─── Build embed สำหรับ 1 punishment ───────────────────────────────────────

async function buildPunishmentEmbed(pun: any, pp: any, playerId: string): Promise<EmbedBuilder> {
  // ── ดึง required tasks ──
  const { data: tasks } = await supabase
    .from('punishment_required_tasks')
    .select(`
      id,
      action_code_id,
      quest_code_id,
      action_code:action_codes!action_code_id(id, name, code),
      quest_code:quest_codes!quest_code_id(id, name, code)
    `)
    .eq('punishment_id', pun.id)

  // ── ดึง co-participants (group mode) ──
  let coParticipantNames: string[] = []
  let allGroupPlayerIds: string[] = [playerId]

  if (pun.event_mode === 'group') {
    const { data: groupPlayers } = await supabase
      .from('punishment_players')
      .select('player_id, profiles!player_id(display_name)')
      .eq('punishment_id', pun.id)

    if (groupPlayers) {
      allGroupPlayerIds = groupPlayers.map((gp: any) => gp.player_id)
      coParticipantNames = groupPlayers
        .filter((gp: any) => gp.player_id !== playerId)
        .map((gp: any) => (gp as any).profiles?.display_name ?? 'ผู้เล่น')
    }
  }

  // ── ตรวจสอบ completion ของแต่ละ task ──
  const taskStatuses: { name: string; code: string; type: 'action' | 'quest'; done: boolean }[] = []

  const isShared = pun.event_mode === 'group' && pun.group_mode === 'shared'
  const checkPlayerIds = isShared ? allGroupPlayerIds : [playerId]

  for (const task of (tasks ?? [])) {
    const ac = (task as any).action_code
    const qc = (task as any).quest_code

    if (ac) {
      // ตรวจสอบว่ามี approved action_submission สำหรับ code นี้หลัง punishment สร้าง
      const { count } = await supabase
        .from('action_submissions')
        .select('id', { count: 'exact', head: true })
        .in('player_id', checkPlayerIds)
        .eq('action_code_id', ac.id)
        .eq('status', 'approved')
        .gte('created_at', pun.created_at)

      taskStatuses.push({
        name: ac.name,
        code: ac.code,
        type: 'action',
        done: (count ?? 0) > 0,
      })
    } else if (qc) {
      const { count } = await supabase
        .from('quest_submissions')
        .select('id', { count: 'exact', head: true })
        .in('player_id', checkPlayerIds)
        .eq('quest_code_id', qc.id)
        .eq('status', 'approved')
        .gte('created_at', pun.created_at)

      taskStatuses.push({
        name: qc.name,
        code: qc.code,
        type: 'quest',
        done: (count ?? 0) > 0,
      })
    }
  }

  const doneCount = taskStatuses.filter(t => t.done).length
  const totalCount = taskStatuses.length

  // ── คำนวณสถานะ deadline ──
  const now = new Date()
  let deadlineText = 'ไม่มีเส้นตาย'
  let isOverdue = false

  if (pun.deadline) {
    const dl = new Date(pun.deadline)
    const ts = Math.floor(dl.getTime() / 1000)
    isOverdue = dl < now
    deadlineText = isOverdue
      ? `❌ เลยเส้นตาย <t:${ts}:R> (<t:${ts}:f>)`
      : `⏰ <t:${ts}:R> (<t:${ts}:f>)`
  }

  // ── สร้าง embed ──
  const statusColor = pp.mercy_requested
    ? COLORS.info
    : isOverdue
    ? COLORS.danger
    : totalCount > 0 && doneCount === totalCount
    ? COLORS.warning  // ครบแล้วแต่ยังไม่ส่ง
    : COLORS.pending

  const embed = new EmbedBuilder()
    .setColor(statusColor)
    .setTitle(`⚖️ ${pun.name}`)

  if (pun.description) {
    embed.setDescription(pun.description)
  }

  // ── Event Mode badge ──
  const modeText =
    pun.event_mode === 'group'
      ? pun.group_mode === 'shared'
        ? '👥 เหตุการณ์ร่วม (ใครส่งก็ผ่านทุกคน)'
        : '👥 เหตุการณ์กลุ่ม (ทุกคนต้องส่งเอง)'
      : '🧍 เหตุการณ์เดี่ยว'

  embed.addFields({ name: '🎭 ประเภท', value: modeText, inline: false })

  // ── Deadline ──
  embed.addFields({ name: '📅 เส้นตาย', value: deadlineText, inline: false })

  // ── Progress bar ──
  if (totalCount > 0) {
    const bar = progressBar(doneCount, totalCount, 10)
    embed.addFields({
      name: `📊 ความคืบหน้า  ${doneCount}/${totalCount}`,
      value: bar,
      inline: false,
    })
  }

  // ── Task checklist ──
  if (taskStatuses.length > 0) {
    const taskLines = taskStatuses.map(t => {
      const icon = t.done ? '✅' : '⏳'
      const typeIcon = t.type === 'quest' ? '📜' : '⚔️'
      return `${icon} ${typeIcon} **${t.name}**\n└ Code: \`${t.code}\``
    })
    embed.addFields({
      name: '📋 ภารกิจที่ต้องทำ',
      value: taskLines.join('\n'),
      inline: false,
    })
  } else {
    embed.addFields({
      name: '📋 ภารกิจที่ต้องทำ',
      value: 'ไม่มีภารกิจที่กำหนด (ติดต่อ Admin)',
      inline: false,
    })
  }

  // ── Co-participants (group mode) ──
  if (pun.event_mode === 'group' && coParticipantNames.length > 0) {
    embed.addFields({
      name: '👥 ผู้ร่วมเหตุการณ์',
      value: coParticipantNames.map(n => `• ${n}`).join('\n'),
      inline: false,
    })
  }

  // ── Status ──
  let statusNote: string
  if (pp.mercy_requested) {
    statusNote = '✅ คุณส่งคำขอเสร็จสิ้นแล้ว — รอ Admin ตรวจสอบ'
  } else if (totalCount > 0 && doneCount === totalCount) {
    statusNote = '🎯 ครบทุกภารกิจแล้ว! ใช้ `/complete-punishment` เพื่อส่งคำขอเสร็จสิ้น'
  } else {
    const remaining = totalCount - doneCount
    statusNote = `📌 ยังเหลืออีก **${remaining}** ภารกิจ — ส่งผ่าน \`/submit-quest\` หรือ \`/submit-action\``
  }

  embed.addFields({ name: '🔔 สถานะ', value: statusNote, inline: false })

  // ── Penalties at stake ──
  const penaltyLines: string[] = []
  if (pun.penalty_hp) penaltyLines.push(`❤️ HP ${pun.penalty_hp}`)
  if (pun.penalty_sanity) penaltyLines.push(`🧠 Sanity ${pun.penalty_sanity}`)
  if (pun.penalty_travel) penaltyLines.push(`👟 Travel ${pun.penalty_travel}`)
  if (pun.penalty_spirituality) penaltyLines.push(`✨ Spirit ${pun.penalty_spirituality}`)
  if (pun.penalty_max_sanity) penaltyLines.push(`🧠 Max Sanity ${pun.penalty_max_sanity}`)
  if (pun.penalty_max_travel) penaltyLines.push(`👟 Max Travel ${pun.penalty_max_travel}`)
  if (pun.penalty_max_spirituality) penaltyLines.push(`✨ Max Spirit ${pun.penalty_max_spirituality}`)

  if (penaltyLines.length > 0) {
    embed.addFields({
      name: '⚠️ บทลงโทษถ้าไม่ทำครบ',
      value: penaltyLines.join('  ·  '),
      inline: false,
    })
  }

  embed.setFooter({ text: `ID: ${pun.id.slice(0, 8)}...` })

  return embed
}
