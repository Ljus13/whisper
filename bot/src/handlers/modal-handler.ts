import {
  ModalSubmitInteraction,
  MessageFlags,
  EmbedBuilder,
  TextChannel,
} from 'discord.js'
import { handleSubmitQuestModal } from '../commands/player/submit-quest'
import { handleSleepModal } from '../commands/player/sleep'
import { handlePrayerModal } from '../commands/player/prayer'
import { handleUseSkillModal } from '../commands/player/use-skill'
import { handleSubmitActionModal } from '../commands/player/submit-action'
import { requireStaffProfile, supabase } from '../lib/supabase'
import { COLORS, buildErrorEmbed, buildSuccessEmbed } from '../lib/embeds'
import { notifyApproval, notifyRejection } from '../lib/dm-notify'
import { config } from '../config'

export async function handleModal(interaction: ModalSubmitInteraction) {
  const { customId } = interaction

  try {
    if (customId === 'modal_submit_quest') {
      return await handleSubmitQuestModal(interaction)
    }

    if (customId === 'modal_submit_action') {
      return await handleSubmitActionModal(interaction)
    }

    if (customId === 'modal_sleep') {
      return await handleSleepModal(interaction)
    }

    if (customId === 'modal_prayer') {
      return await handlePrayerModal(interaction)
    }

    if (customId.startsWith('modal_use_skill_')) {
      return await handleUseSkillModal(interaction)
    }

    // ── Approve modal (จาก button) ──
    if (customId.startsWith('modal_approve_')) {
      return await handleApproveModal(interaction)
    }

    // ── Reject modal (จาก button) ──
    if (customId.startsWith('modal_reject_')) {
      return await handleRejectModal(interaction)
    }

    // Unknown modal
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ ไม่รู้จัก modal นี้', flags: MessageFlags.Ephemeral })
    }
  } catch (error) {
    console.error('[modal-handler] Error:', error)
    try {
      const msg = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่' }
      if (interaction.deferred) await interaction.editReply(msg)
      else if (!interaction.replied) await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral })
    } catch {}
  }
}

// ─── Approve Modal Handler ───────────────────────────────────────────────────

async function handleApproveModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const admin = await requireStaffProfile(interaction)
  if (!admin) return

  // parse customId: modal_approve_{type}_{submissionId}
  const withoutPrefix = interaction.customId.replace('modal_approve_', '')
  const firstUnderscore = withoutPrefix.indexOf('_')
  const type = withoutPrefix.slice(0, firstUnderscore) as 'action' | 'quest' | 'sleep'
  const submissionId = withoutPrefix.slice(firstUnderscore + 1)

  if (type === 'action') {
    const res = await approveAction(submissionId, admin.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    await interaction.editReply({
      embeds: [buildSuccessEmbed(`อนุมัติ Action "${res.codeName}" สำเร็จ`, `👤 ${res.playerName}`)],
    })
    await notifyApproval(interaction.client, {
      type: 'action',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: admin.display_name || 'Admin',
      rewards: res.rewards,
    })
  } else if (type === 'quest') {
    const res = await approveQuest(submissionId, admin.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    await interaction.editReply({
      embeds: [buildSuccessEmbed(`อนุมัติ Quest "${res.codeName}" สำเร็จ`, `👤 ${res.playerName}`)],
    })
    await notifyApproval(interaction.client, {
      type: 'quest',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: admin.display_name || 'Admin',
      rewards: res.rewards,
    })
  } else {
    const res = await approveSleep(submissionId, admin.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    await interaction.editReply({
      embeds: [buildSuccessEmbed('อนุมัติ Sleep สำเร็จ', `👤 ${res.playerName}\n✨ พลังวิญญาณฟื้นฟูเต็ม`)],
    })
    await notifyApproval(interaction.client, {
      type: 'sleep',
      playerProfileId: res.playerId,
      adminName: admin.display_name || 'Admin',
    })
  }

  await updateApprovalMessage(interaction, submissionId, admin.display_name || 'Admin', 'approved')
}

// ─── Reject Modal Handler ────────────────────────────────────────────────────

async function handleRejectModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const admin = await requireStaffProfile(interaction)
  if (!admin) return

  const withoutPrefix = interaction.customId.replace('modal_reject_', '')
  const firstUnderscore = withoutPrefix.indexOf('_')
  const type = withoutPrefix.slice(0, firstUnderscore) as 'action' | 'quest' | 'sleep'
  const submissionId = withoutPrefix.slice(firstUnderscore + 1)

  const reason = interaction.fields.getTextInputValue('reject_reason')?.trim() || undefined

  if ((type === 'action' || type === 'quest') && !reason) {
    await interaction.editReply({ embeds: [buildErrorEmbed('กรุณาระบุเหตุผลที่ปฏิเสธ')] })
    return
  }

  if (type === 'action') {
    const res = await rejectAction(submissionId, admin.id, reason!)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    await interaction.editReply({
      embeds: [buildSuccessEmbed(`ปฏิเสธ Action "${res.codeName}"`, `👤 ${res.playerName}\n📝 ${reason}`)],
    })
    await notifyRejection(interaction.client, {
      type: 'action',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: admin.display_name || 'Admin',
      reason,
    })
  } else if (type === 'quest') {
    const res = await rejectQuest(submissionId, admin.id, reason!)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    await interaction.editReply({
      embeds: [buildSuccessEmbed(`ปฏิเสธ Quest "${res.codeName}"`, `👤 ${res.playerName}\n📝 ${reason}`)],
    })
    await notifyRejection(interaction.client, {
      type: 'quest',
      playerProfileId: res.playerId,
      codeName: res.codeName,
      adminName: admin.display_name || 'Admin',
      reason,
    })
  } else {
    const res = await rejectSleep(submissionId, admin.id)
    if ('error' in res) {
      await interaction.editReply({ embeds: [buildErrorEmbed(res.error)] })
      return
    }
    await interaction.editReply({
      embeds: [buildSuccessEmbed('ปฏิเสธ Sleep Request', `👤 ${res.playerName}`)],
    })
    await notifyRejection(interaction.client, {
      type: 'sleep',
      playerProfileId: res.playerId,
      adminName: admin.display_name || 'Admin',
      reason,
    })
  }

  await updateApprovalMessage(interaction, submissionId, admin.display_name || 'Admin', 'rejected', reason)
}

// ─── DB Logic Functions ──────────────────────────────────────────────────────

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

  if (!submission) return { error: 'ไม่พบ submission ที่รออนุมัติ หรือถูกดำเนินการแล้ว' }

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

  const { error: updateErr } = await supabase
    .from('action_submissions')
    .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return { error: updateErr.message }

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

  await supabase.from('notifications').insert({
    target_user_id: submission.player_id,
    actor_id: adminId,
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

async function approveQuest(id: string, adminId: string): Promise<ApproveResult> {
  const { data: submission } = await supabase
    .from('quest_submissions')
    .select('id, player_id, quest_code_id, status')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบ submission ที่รออนุมัติ หรือถูกดำเนินการแล้ว' }

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

  await supabase.from('notifications').insert({
    target_user_id: submission.player_id,
    actor_id: adminId,
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

  await supabase
    .from('profiles')
    .update({ spirituality: playerProfile.max_spirituality })
    .eq('id', request.player_id)

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

// ─── Update Approval Message ─────────────────────────────────────────────────

async function updateApprovalMessage(
  interaction: ModalSubmitInteraction,
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
    console.error('[modal-handler] Failed to update approval message:', err)
  }
}
