import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import { requireStaffProfile, supabase } from '../../lib/supabase'
import { COLORS, buildSuccessEmbed, buildErrorEmbed } from '../../lib/embeds'
import { notifyRejection } from '../../lib/dm-notify'
import { config } from '../../config'

export const data = new SlashCommandBuilder()
  .setName('reject')
  .setDescription('ปฏิเสธ Submission (Action / Quest / Sleep) ❌')
  .addStringOption(opt =>
    opt
      .setName('id')
      .setDescription('ID ของ submission (หรือ 8 ตัวแรก)')
      .setRequired(true),
  )
  .addStringOption(opt =>
    opt
      .setName('reason')
      .setDescription('เหตุผลที่ปฏิเสธ (จำเป็นสำหรับ Action/Quest)')
      .setRequired(false),
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireStaffProfile(interaction)
  if (!profile) return

  const idInput = interaction.options.getString('id', true).trim()
  const reason = interaction.options.getString('reason') ?? undefined

  // ── ค้นหา submission ──
  const result = await findPendingSubmission(idInput)
  if (!result) {
    await interaction.editReply({ embeds: [buildErrorEmbed('ไม่พบ submission ที่รออนุมัติด้วย ID นี้')] })
    return
  }

  // Action/Quest ต้องมี reason
  if ((result.type === 'action' || result.type === 'quest') && !reason?.trim()) {
    await interaction.editReply({ embeds: [buildErrorEmbed('กรุณาระบุเหตุผลในตัวเลือก `reason` สำหรับการปฏิเสธ Action/Quest')] })
    return
  }

  let replyEmbed: EmbedBuilder

  if (result.type === 'action') {
    const res = await rejectAction(result.id, profile.id, reason!.trim())
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    replyEmbed = buildSuccessEmbed(
      `ปฏิเสธ Action "${res.codeName}"`,
      `👤 ผู้เล่น: ${res.playerName}\n📝 เหตุผล: ${reason}`,
    )
    await notifyRejection(interaction.client, {
      type: 'action',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: profile.display_name || 'Admin',
      reason: reason!.trim(),
    })
  } else if (result.type === 'quest') {
    const res = await rejectQuest(result.id, profile.id, reason!.trim())
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    replyEmbed = buildSuccessEmbed(
      `ปฏิเสธ Quest "${res.codeName}"`,
      `👤 ผู้เล่น: ${res.playerName}\n📝 เหตุผล: ${reason}`,
    )
    await notifyRejection(interaction.client, {
      type: 'quest',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: profile.display_name || 'Admin',
      reason: reason!.trim(),
    })
  } else {
    // Sleep — ไม่ต้องมี reason
    const res = await rejectSleep(result.id, profile.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    replyEmbed = buildSuccessEmbed(
      'ปฏิเสธ Sleep Request',
      `👤 ผู้เล่น: ${res.playerName}`,
    )
    await notifyRejection(interaction.client, {
      type: 'sleep',
      playerProfileId: res.playerId,
      adminName: profile.display_name || 'Admin',
    })
  }

  await interaction.editReply({ embeds: [replyEmbed] })

  // ── อัปเดต embed เดิมใน #approvals ──
  await updateApprovalMessage(interaction, result.id, profile.display_name || 'Admin', 'rejected', reason)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SubmissionLookup = { id: string; type: 'action' | 'quest' | 'sleep' }

async function findPendingSubmission(idInput: string): Promise<SubmissionLookup | null> {
  for (const table of ['action_submissions', 'quest_submissions', 'sleep_requests'] as const) {
    const typeMap = {
      action_submissions: 'action' as const,
      quest_submissions: 'quest' as const,
      sleep_requests: 'sleep' as const,
    }

    const { data: exact } = await supabase
      .from(table)
      .select('id')
      .eq('id', idInput)
      .eq('status', 'pending')
      .maybeSingle()

    if (exact) return { id: exact.id, type: typeMap[table] }

    if (idInput.length >= 4) {
      const { data: partial } = await supabase
        .from(table)
        .select('id')
        .eq('status', 'pending')
        .ilike('id', `${idInput}%`)
        .limit(1)
        .maybeSingle()

      if (partial) return { id: partial.id, type: typeMap[table] }
    }
  }
  return null
}

// ── Reject Action ──

type RejectResult = { error: string } | { playerId: string; playerName: string; codeName: string }

async function rejectAction(id: string, adminId: string, reason: string): Promise<RejectResult> {
  const { data: submission } = await supabase
    .from('action_submissions')
    .select('id, player_id, action_code_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบ submission ที่รออนุมัติ' }

  const { data: actionCode } = await supabase
    .from('action_codes')
    .select('name')
    .eq('id', submission.action_code_id)
    .single()

  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', submission.player_id)
    .single()

  const { error } = await supabase
    .from('action_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  // Notification
  await supabase.from('notifications').insert({
    target_user_id: submission.player_id,
    actor_id: adminId,
    type: 'action_rejected',
    title: 'แอคชั่นถูกปฏิเสธ',
    message: `เหตุผล: ${reason}`,
    link: '/dashboard/action-quest/actions',
  })

  return {
    playerId: submission.player_id,
    playerName: playerProfile?.display_name ?? 'ผู้เล่น',
    codeName: actionCode?.name ?? 'แอคชั่น',
  }
}

// ── Reject Quest ──

async function rejectQuest(id: string, adminId: string, reason: string): Promise<RejectResult> {
  const { data: submission } = await supabase
    .from('quest_submissions')
    .select('id, player_id, quest_code_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบ submission ที่รออนุมัติ' }

  const { data: questCode } = await supabase
    .from('quest_codes')
    .select('name')
    .eq('id', submission.quest_code_id)
    .single()

  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', submission.player_id)
    .single()

  const { error } = await supabase
    .from('quest_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  await supabase.from('notifications').insert({
    target_user_id: submission.player_id,
    actor_id: adminId,
    type: 'quest_rejected',
    title: 'ภารกิจถูกปฏิเสธ',
    message: `เหตุผล: ${reason}`,
    link: '/dashboard/action-quest/quests',
  })

  return {
    playerId: submission.player_id,
    playerName: playerProfile?.display_name ?? 'ผู้เล่น',
    codeName: questCode?.name ?? 'ภารกิจ',
  }
}

// ── Reject Sleep ──

type RejectSleepResult = { error: string } | { playerId: string; playerName: string }

async function rejectSleep(id: string, adminId: string): Promise<RejectSleepResult> {
  const { data: request } = await supabase
    .from('sleep_requests')
    .select('id, player_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!request) return { error: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' }

  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', request.player_id)
    .single()

  const { error } = await supabase
    .from('sleep_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('notifications').insert({
    target_user_id: request.player_id,
    actor_id: adminId,
    type: 'sleep_rejected',
    title: 'การนอนหลับถูกปฏิเสธ',
    link: '/dashboard/action-quest/sleep',
  })

  return { playerId: request.player_id, playerName: playerProfile?.display_name ?? 'ผู้เล่น' }
}

// ── อัปเดต embed เดิมใน #approvals ──

async function updateApprovalMessage(
  interaction: ChatInputCommandInteraction,
  submissionId: string,
  adminName: string,
  action: 'approved' | 'rejected',
  reason?: string,
) {
  try {
    if (!config.channelApprovals) return

    const channel = interaction.client.channels.cache.get(config.channelApprovals) as TextChannel | null
      ?? await interaction.client.channels.fetch(config.channelApprovals).catch(() => null) as TextChannel | null

    if (!channel?.isTextBased()) return

    const messages = await channel.messages.fetch({ limit: 100 })
    const targetMsg = messages.find(m =>
      m.embeds.some(e => e.footer?.text?.includes(submissionId)),
    )

    if (!targetMsg) return

    const statusEmoji = action === 'approved' ? '✅' : '❌'
    const statusText = action === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'

    const updatedEmbed = EmbedBuilder.from(targetMsg.embeds[0])
      .setColor(action === 'approved' ? COLORS.success : COLORS.danger)
      .setTitle(`${statusEmoji} ${statusText}`)
      .addFields({ name: '👤 ผู้ดำเนินการ', value: adminName, inline: true })

    if (reason) {
      updatedEmbed.addFields({ name: '📝 เหตุผล', value: reason, inline: false })
    }

    await targetMsg.edit({ embeds: [updatedEmbed], components: [] })
  } catch (err) {
    console.error('[reject] Failed to update approval message:', err)
  }
}
