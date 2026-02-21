import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js'
import { requireStaffProfile, supabase } from '../../lib/supabase'
import { COLORS, buildSuccessEmbed, buildErrorEmbed } from '../../lib/embeds'
import { notifyApproval } from '../../lib/dm-notify'

export const data = new SlashCommandBuilder()
  .setName('approve')
  .setDescription('อนุมัติ Submission (Action / Quest / Sleep) ✅')
  .addStringOption(opt =>
    opt
      .setName('id')
      .setDescription('ID ของ submission (หรือ 8 ตัวแรก)')
      .setRequired(true),
  )
  .addStringOption(opt =>
    opt
      .setName('note')
      .setDescription('หมายเหตุ (optional)')
      .setRequired(false),
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireStaffProfile(interaction)
  if (!profile) return

  const idInput = interaction.options.getString('id', true).trim()
  const note = interaction.options.getString('note') ?? undefined

  // ── ค้นหา submission จากทุกตาราง (ใช้ partial ID match) ──
  const result = await findPendingSubmission(idInput)
  if (!result) {
    await interaction.editReply({ embeds: [buildErrorEmbed('ไม่พบ submission ที่รออนุมัติด้วย ID นี้')] })
    return
  }

  let replyEmbed: EmbedBuilder

  if (result.type === 'action') {
    const res = await approveAction(result.id, profile.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    replyEmbed = buildSuccessEmbed(
      `อนุมัติ Action "${res.codeName}" สำเร็จ`,
      `👤 ผู้เล่น: ${res.playerName}`,
    )
    // DM ผู้เล่น
    await notifyApproval(interaction.client, {
      type: 'action',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: profile.display_name || 'Admin',
      rewards: res.rewards,
    })
  } else if (result.type === 'quest') {
    const res = await approveQuest(result.id, profile.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    replyEmbed = buildSuccessEmbed(
      `อนุมัติ Quest "${res.codeName}" สำเร็จ`,
      `👤 ผู้เล่น: ${res.playerName}`,
    )
    await notifyApproval(interaction.client, {
      type: 'quest',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: profile.display_name || 'Admin',
      rewards: res.rewards,
    })
  } else {
    const res = await approveSleep(result.id, profile.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    replyEmbed = buildSuccessEmbed(
      'อนุมัติ Sleep Request สำเร็จ',
      `👤 ผู้เล่น: ${res.playerName}\n✨ พลังวิญญาณฟื้นฟูเต็ม`,
    )
    await notifyApproval(interaction.client, {
      type: 'sleep',
      playerProfileId: res.playerId,
      adminName: profile.display_name || 'Admin',
    })
  }

  await interaction.editReply({ embeds: [replyEmbed] })

  // ── อัปเดต embed เดิมใน #approvals (ถ้ามี) ── ทำ best-effort
  await updateApprovalMessage(interaction, result.id, profile.display_name || 'Admin', 'approved')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SubmissionLookup = { id: string; type: 'action' | 'quest' | 'sleep' }

async function findPendingSubmission(idInput: string): Promise<SubmissionLookup | null> {
  // ลองค้นหาแบบ exact match ก่อน แล้ว partial match (8 ตัวแรก)
  for (const table of ['action_submissions', 'quest_submissions', 'sleep_requests'] as const) {
    const typeMap = {
      action_submissions: 'action' as const,
      quest_submissions: 'quest' as const,
      sleep_requests: 'sleep' as const,
    }

    // Exact match
    const { data: exact } = await supabase
      .from(table)
      .select('id')
      .eq('id', idInput)
      .eq('status', 'pending')
      .maybeSingle()

    if (exact) return { id: exact.id, type: typeMap[table] }

    // Partial match (starts with)
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

// ── Approve Action ──

type ApproveResult =
  | { error: string }
  | { playerId: string; playerName: string; codeName: string; rewards?: Record<string, number> }

async function approveAction(id: string, adminId: string): Promise<ApproveResult> {
  const { data: submission } = await supabase
    .from('action_submissions')
    .select('id, player_id, action_code_id, status')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบ submission ที่รออนุมัติ' }

  const { data: actionCode } = await supabase
    .from('action_codes')
    .select('name, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality')
    .eq('id', submission.action_code_id)
    .single()

  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('display_name, hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality')
    .eq('id', submission.player_id)
    .single()

  // Update status
  const { error: updateErr } = await supabase
    .from('action_submissions')
    .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return { error: updateErr.message }

  // Apply rewards
  let rewards: Record<string, number> | undefined
  if (actionCode && playerProfile) {
    rewards = {}
    const updates: Record<string, number> = {}

    let newMaxSanity = playerProfile.max_sanity ?? 10
    let newMaxTravel = playerProfile.max_travel_points ?? 10
    let newMaxSpirit = playerProfile.max_spirituality ?? 10

    if ((actionCode.reward_max_sanity ?? 0) > 0) {
      newMaxSanity += actionCode.reward_max_sanity
      updates.max_sanity = newMaxSanity
      rewards.maxSanity = actionCode.reward_max_sanity
    }
    if ((actionCode.reward_max_travel ?? 0) > 0) {
      newMaxTravel += actionCode.reward_max_travel
      updates.max_travel_points = newMaxTravel
      rewards.maxTravel = actionCode.reward_max_travel
    }
    if ((actionCode.reward_max_spirituality ?? 0) > 0) {
      newMaxSpirit += actionCode.reward_max_spirituality
      updates.max_spirituality = newMaxSpirit
      rewards.maxSpirituality = actionCode.reward_max_spirituality
    }

    if ((actionCode.reward_hp ?? 0) > 0) {
      updates.hp = (playerProfile.hp ?? 0) + actionCode.reward_hp
      rewards.hp = actionCode.reward_hp
    }
    if ((actionCode.reward_sanity ?? 0) > 0) {
      updates.sanity = Math.min(newMaxSanity, (playerProfile.sanity ?? 0) + actionCode.reward_sanity)
      rewards.sanity = actionCode.reward_sanity
    }
    if ((actionCode.reward_travel ?? 0) > 0) {
      updates.travel_points = Math.min(newMaxTravel, (playerProfile.travel_points ?? 0) + actionCode.reward_travel)
      rewards.travel = actionCode.reward_travel
    }
    if ((actionCode.reward_spirituality ?? 0) > 0) {
      updates.spirituality = Math.min(newMaxSpirit, (playerProfile.spirituality ?? 0) + actionCode.reward_spirituality)
      rewards.spirituality = actionCode.reward_spirituality
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', submission.player_id)
    }
  }

  // Notification
  await supabase.from('notifications').insert({
    target_user_id: submission.player_id,
    actor_id: adminId,
    actor_name: playerProfile?.display_name ?? 'Admin',
    type: 'action_approved',
    title: `แอคชั่น "${actionCode?.name ?? 'แอคชั่น'}" ได้รับการอนุมัติแล้ว!`,
    message: 'ได้รับรางวัลจากแอคชั่นที่ส่ง',
    link: '/dashboard/action-quest/actions',
  })

  return {
    playerId: submission.player_id,
    playerName: playerProfile?.display_name ?? 'ผู้เล่น',
    codeName: actionCode?.name ?? 'แอคชั่น',
    rewards,
  }
}

// ── Approve Quest ──

async function approveQuest(id: string, adminId: string): Promise<ApproveResult> {
  const { data: submission } = await supabase
    .from('quest_submissions')
    .select('id, player_id, quest_code_id, status')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบ submission ที่รออนุมัติ' }

  const { data: questCode } = await supabase
    .from('quest_codes')
    .select('name, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality')
    .eq('id', submission.quest_code_id)
    .single()

  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('display_name, hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality')
    .eq('id', submission.player_id)
    .single()

  const { error: updateErr } = await supabase
    .from('quest_submissions')
    .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')

  if (updateErr) return { error: updateErr.message }

  // Apply quest rewards (supports negative/penalty — like web app)
  let rewards: Record<string, number> | undefined
  if (questCode && playerProfile) {
    rewards = {}
    const updates: Record<string, number> = {}

    let newMaxSanity = playerProfile.max_sanity ?? 10
    let newMaxTravel = playerProfile.max_travel_points ?? 10
    let newMaxSpirit = playerProfile.max_spirituality ?? 10

    if ((questCode.reward_max_sanity || 0) !== 0) {
      newMaxSanity = Math.max(1, newMaxSanity + questCode.reward_max_sanity)
      updates.max_sanity = newMaxSanity
      rewards.maxSanity = questCode.reward_max_sanity
    }
    if ((questCode.reward_max_travel || 0) !== 0) {
      newMaxTravel = Math.max(1, newMaxTravel + questCode.reward_max_travel)
      updates.max_travel_points = newMaxTravel
      rewards.maxTravel = questCode.reward_max_travel
    }
    if ((questCode.reward_max_spirituality || 0) !== 0) {
      newMaxSpirit = Math.max(1, newMaxSpirit + questCode.reward_max_spirituality)
      updates.max_spirituality = newMaxSpirit
      rewards.maxSpirituality = questCode.reward_max_spirituality
    }

    if ((questCode.reward_hp || 0) !== 0) {
      updates.hp = Math.max(0, (playerProfile.hp ?? 0) + questCode.reward_hp)
      rewards.hp = questCode.reward_hp
    }
    if ((questCode.reward_sanity || 0) !== 0) {
      updates.sanity = Math.min(newMaxSanity, Math.max(0, (playerProfile.sanity ?? 0) + questCode.reward_sanity))
      rewards.sanity = questCode.reward_sanity
    }
    if ((questCode.reward_travel || 0) !== 0) {
      updates.travel_points = Math.min(newMaxTravel, Math.max(0, (playerProfile.travel_points ?? 0) + questCode.reward_travel))
      rewards.travel = questCode.reward_travel
    }
    if ((questCode.reward_spirituality || 0) !== 0) {
      updates.spirituality = Math.min(newMaxSpirit, Math.max(0, (playerProfile.spirituality ?? 0) + questCode.reward_spirituality))
      rewards.spirituality = questCode.reward_spirituality
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', submission.player_id)
    }
  }

  // Notification
  await supabase.from('notifications').insert({
    target_user_id: submission.player_id,
    actor_id: adminId,
    actor_name: playerProfile?.display_name ?? 'Admin',
    type: 'quest_approved',
    title: `ภารกิจ "${questCode?.name ?? 'ภารกิจ'}" ได้รับการอนุมัติแล้ว!`,
    link: '/dashboard/action-quest/quests',
  })

  return {
    playerId: submission.player_id,
    playerName: playerProfile?.display_name ?? 'ผู้เล่น',
    codeName: questCode?.name ?? 'ภารกิจ',
    rewards,
  }
}

// ── Approve Sleep ──

type ApproveSleepResult = { error: string } | { playerId: string; playerName: string }

async function approveSleep(id: string, adminId: string): Promise<ApproveSleepResult> {
  const { data: request } = await supabase
    .from('sleep_requests')
    .select('id, player_id, status')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!request) return { error: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' }

  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('display_name, max_spirituality')
    .eq('id', request.player_id)
    .single()

  if (!playerProfile) return { error: 'ไม่พบโปรไฟล์ผู้เล่น' }

  const { error: updateErr } = await supabase
    .from('sleep_requests')
    .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return { error: updateErr.message }

  // Restore full spirituality
  await supabase
    .from('profiles')
    .update({ spirituality: playerProfile.max_spirituality })
    .eq('id', request.player_id)

  // Notification
  await supabase.from('notifications').insert({
    target_user_id: request.player_id,
    actor_id: adminId,
    type: 'sleep_approved',
    title: 'การนอนหลับได้รับการอนุมัติ',
    message: 'พลังวิญญาณถูกฟื้นฟูเต็มแล้ว',
    link: '/dashboard/action-quest/sleep',
  })

  return { playerId: request.player_id, playerName: playerProfile.display_name ?? 'ผู้เล่น' }
}

// ── อัปเดต embed เดิมใน #approvals channel ──

async function updateApprovalMessage(
  interaction: ChatInputCommandInteraction,
  submissionId: string,
  adminName: string,
  action: 'approved' | 'rejected',
) {
  try {
    const { config: cfg } = await import('../../config')
    if (!cfg.channelApprovals) return

    const channel = interaction.client.channels.cache.get(cfg.channelApprovals) as import('discord.js').TextChannel | null
      ?? await interaction.client.channels.fetch(cfg.channelApprovals).catch(() => null) as import('discord.js').TextChannel | null

    if (!channel?.isTextBased()) return

    // ค้นหา message ที่มี submission ID ในช่วง 100 ข้อความล่าสุด
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

    // ลบ buttons (ไม่ให้กดซ้ำ)
    await targetMsg.edit({ embeds: [updatedEmbed], components: [] })
  } catch (err) {
    console.error('[approve] Failed to update approval message:', err)
  }
}
