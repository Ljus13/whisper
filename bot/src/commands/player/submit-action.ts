import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  MessageFlags,
} from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS, buildApprovalEmbed } from '../../lib/embeds'
import { config } from '../../config'

export const data = new SlashCommandBuilder()
  .setName('submit-action')
  .setDescription('ส่ง Action Code พร้อมหลักฐาน ⚔️')

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_submit_action')
    .setTitle('ส่ง Action ⚔️')

  const codeInput = new TextInputBuilder()
    .setCustomId('action_code')
    .setLabel('รหัส Action Code')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('เช่น AC-DD-MM-YY-abcd')
    .setRequired(true)
    .setMaxLength(50)

  const evidenceInput = new TextInputBuilder()
    .setCustomId('evidence_urls')
    .setLabel('ลิงก์หลักฐาน (บรรทัดละ 1 ลิงก์)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('https://example.com/image1.jpg\nhttps://example.com/image2.jpg')
    .setRequired(true)
    .setMaxLength(1000)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput),
  )

  await interaction.showModal(modal)
}

/**
 * จัดการเมื่อผู้เล่น submit Modal action
 * เรียกจาก modal-handler.ts
 */
export async function handleSubmitActionModal(interaction: import('discord.js').ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  const codeStr = interaction.fields.getTextInputValue('action_code').trim()
  const evidenceRaw = interaction.fields.getTextInputValue('evidence_urls')
  const evidenceUrls = evidenceRaw
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0)
    .slice(0, 3)

  if (!codeStr) {
    await interaction.editReply({ content: '❌ กรุณากรอกรหัส Action Code' })
    return
  }
  if (evidenceUrls.length === 0) {
    await interaction.editReply({ content: '❌ กรุณากรอก URL หลักฐานอย่างน้อย 1 ลิงก์' })
    return
  }

  // ── ตรวจสอบ code ──
  const { data: codeRow } = await supabase
    .from('action_codes')
    .select('id, name, code, expires_at, max_repeats, archived')
    .eq('code', codeStr)
    .eq('archived', false)
    .maybeSingle()

  if (!codeRow) {
    await interaction.editReply({ content: '❌ ไม่พบรหัส Action นี้ หรือแอคชั่นนี้ถูกปิดไปแล้ว' })
    return
  }
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    await interaction.editReply({ content: '❌ Action นี้หมดอายุแล้ว' })
    return
  }
  if (codeRow.max_repeats !== null && codeRow.max_repeats !== undefined) {
    const { count } = await supabase
      .from('action_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', profile.id)
      .eq('action_code_id', codeRow.id)
      .neq('status', 'rejected')
    if ((count || 0) >= codeRow.max_repeats) {
      await interaction.editReply({
        content: `❌ คุณส่ง Action นี้ครบ ${codeRow.max_repeats} ครั้งแล้ว ไม่สามารถส่งซ้ำได้อีก`,
      })
      return
    }
  }

  // ── insert submission ──
  const { data: inserted, error } = await supabase
    .from('action_submissions')
    .insert({
      player_id: profile.id,
      action_code_id: codeRow.id,
      evidence_urls: evidenceUrls,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('[submit-action] Insert error:', error)
    await interaction.editReply({ content: `❌ เกิดข้อผิดพลาด: ${error?.message ?? 'unknown'}` })
    return
  }

  // ── สร้าง in-app notification ให้ admin ──
  try {
    await supabase.from('notifications').insert({
      target_user_id: null,
      actor_id: profile.id,
      actor_name: profile.display_name,
      type: 'action_submitted',
      title: `${profile.display_name} ส่ง Action "${codeRow.name}"`,
      message: 'มีแอคชั่นใหม่รอตรวจสอบ',
      link: '/dashboard/action-quest/actions',
    })
  } catch (notifErr) {
    console.error('[submit-action] Notification error (non-fatal):', notifErr)
  }

  // ── reply ผู้ส่ง ──
  const successEmbed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ ส่ง Action สำเร็จ!')
    .addFields(
      { name: '📋 ชื่อ', value: codeRow.name, inline: true },
      { name: '🔑 Code', value: `\`${codeRow.code}\``, inline: true },
    )
    .setDescription('รอ Admin / DM ตรวจสอบและอนุมัติ')
    .setTimestamp()

  await interaction.editReply({ embeds: [successEmbed] })

  // ── post embed ไปที่ #approvals channel ──
  if (config.channelApprovals) {
    try {
      const channel = interaction.client.channels.cache.get(config.channelApprovals) as TextChannel | null
        ?? await interaction.client.channels.fetch(config.channelApprovals).catch(() => null) as TextChannel | null

      if (channel?.isTextBased()) {
        const approvalEmbed = buildApprovalEmbed({
          type: 'action',
          playerName: profile.display_name || interaction.user.username,
          playerAvatar: profile.avatar_url || interaction.user.displayAvatarURL(),
          codeName: codeRow.name,
          codeStr: codeRow.code,
          evidenceUrls,
          submissionId: inserted.id,
          createdAt: new Date(),
        })

        const approveBtn = new ButtonBuilder()
          .setCustomId(`approve_action_${inserted.id}`)
          .setLabel('✅ Approve')
          .setStyle(ButtonStyle.Success)

        const rejectBtn = new ButtonBuilder()
          .setCustomId(`reject_action_${inserted.id}`)
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Danger)

        const webBtn = new ButtonBuilder()
          .setLabel('🔗 ดูบนเว็บ')
          .setURL(`${config.webUrl}/dashboard/action-quest/actions`)
          .setStyle(ButtonStyle.Link)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn, webBtn)

        await (channel as TextChannel).send({ embeds: [approvalEmbed], components: [row] })
      }
    } catch (e) {
      console.error('[submit-action] Failed to post to approvals channel:', e)
    }
  }
}
