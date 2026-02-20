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
} from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS, buildApprovalEmbed } from '../../lib/embeds'
import { config } from '../../config'

export const data = new SlashCommandBuilder()
  .setName('submit-quest')
  .setDescription('ส่ง Quest Code พร้อมหลักฐาน')

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_submit_quest')
    .setTitle('ส่ง Quest 📜')

  const codeInput = new TextInputBuilder()
    .setCustomId('quest_code')
    .setLabel('รหัส Quest Code')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('เช่น DD-MM-YY-abcd')
    .setRequired(true)
    .setMaxLength(50)

  const evidenceInput = new TextInputBuilder()
    .setCustomId('evidence_urls')
    .setLabel('URL หลักฐาน (1 ลิงก์ต่อบรรทัด, สูงสุด 3 ลิงก์)')
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
 * จัดการเมื่อผู้เล่น submit Modal
 * เรียกจาก modal-handler.ts
 */
export async function handleSubmitQuestModal(interaction: import('discord.js').ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  const codeStr = interaction.fields.getTextInputValue('quest_code').trim()
  const evidenceRaw = interaction.fields.getTextInputValue('evidence_urls')
  const evidenceUrls = evidenceRaw
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0)
    .slice(0, 3)

  if (!codeStr) {
    await interaction.editReply({ content: '❌ กรุณากรอกรหัส Quest Code' })
    return
  }
  if (evidenceUrls.length === 0) {
    await interaction.editReply({ content: '❌ กรุณากรอก URL หลักฐานอย่างน้อย 1 ลิงก์' })
    return
  }

  // ── ตรวจสอบ code ──
  const { data: codeRow } = await supabase
    .from('quest_codes')
    .select('id, name, code, map_id, npc_token_id, expires_at, max_repeats')
    .eq('code', codeStr)
    .maybeSingle()

  if (!codeRow) {
    await interaction.editReply({ content: '❌ ไม่พบรหัส Quest นี้ กรุณาตรวจสอบรหัสอีกครั้ง' })
    return
  }
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    await interaction.editReply({ content: '❌ Quest นี้หมดอายุแล้ว' })
    return
  }
  if (codeRow.max_repeats !== null && codeRow.max_repeats !== undefined) {
    const { count } = await supabase
      .from('quest_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', profile.id)
      .eq('quest_code_id', codeRow.id)
    if ((count || 0) >= codeRow.max_repeats) {
      await interaction.editReply({
        content: `❌ คุณส่ง Quest นี้ครบ ${codeRow.max_repeats} ครั้งแล้ว ไม่สามารถส่งซ้ำได้อีก`,
      })
      return
    }
  }

  // ── ตรวจสอบ Map / NPC requirement (เหมือนใน web app) ──
  if (codeRow.map_id || codeRow.npc_token_id) {
    const { data: playerToken } = await supabase
      .from('map_tokens')
      .select('map_id, position_x, position_y')
      .eq('user_id', profile.id)
      .single()

    if (codeRow.map_id) {
      if (!playerToken) {
        const { data: reqMap } = await supabase.from('maps').select('name').eq('id', codeRow.map_id).single()
        await interaction.editReply({
          content: `❌ คุณต้องเดินทางไปยัง "${reqMap?.name ?? 'สถานที่ที่กำหนด'}" ก่อนจึงจะส่ง Quest นี้ได้`,
        })
        return
      }
      if (playerToken.map_id !== codeRow.map_id) {
        const { data: reqMap } = await supabase.from('maps').select('name').eq('id', codeRow.map_id).single()
        await interaction.editReply({
          content: `❌ คุณต้องอยู่ที่ "${reqMap?.name ?? 'สถานที่ที่กำหนด'}" ก่อนจึงจะส่ง Quest นี้ได้`,
        })
        return
      }
    }

    if (codeRow.npc_token_id) {
      const { data: npcToken } = await supabase
        .from('map_tokens')
        .select('map_id, position_x, position_y, interaction_radius, npc_name')
        .eq('id', codeRow.npc_token_id)
        .single()

      if (npcToken && npcToken.interaction_radius > 0) {
        if (!playerToken || playerToken.map_id !== npcToken.map_id) {
          await interaction.editReply({
            content: `❌ คุณต้องอยู่บนแมพเดียวกับ NPC "${npcToken.npc_name}" ก่อน`,
          })
          return
        }
        const dx = playerToken.position_x - npcToken.position_x
        const dy = playerToken.position_y - npcToken.position_y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > npcToken.interaction_radius) {
          await interaction.editReply({
            content: `❌ คุณอยู่ไกลจาก NPC "${npcToken.npc_name}" เกินไป กรุณาเดินเข้าใกล้ก่อน`,
          })
          return
        }
      }
    }
  }

  // ── insert submission ──
  const { data: inserted, error } = await supabase
    .from('quest_submissions')
    .insert({
      player_id: profile.id,
      quest_code_id: codeRow.id,
      evidence_urls: evidenceUrls,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    await interaction.editReply({ content: `❌ เกิดข้อผิดพลาด: ${error?.message ?? 'unknown'}` })
    return
  }

  // ── สร้าง in-app notification ให้ admin ──
  await supabase.from('notifications').insert({
    target_user_id: null,
    actor_id: profile.id,
    actor_name: profile.display_name,
    type: 'quest_submitted',
    title: `${profile.display_name} ส่ง Quest "${codeRow.name}"`,
    message: 'มีภารกิจใหม่รอตรวจสอบ',
    link: '/dashboard/action-quest/quests',
    is_read: false,
  })

  // ── reply ผู้ส่ง ──
  const successEmbed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ ส่ง Quest สำเร็จ!')
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
          type: 'quest',
          playerName: profile.display_name || interaction.user.username,
          playerAvatar: profile.avatar_url || interaction.user.displayAvatarURL(),
          codeName: codeRow.name,
          codeStr: codeRow.code,
          evidenceUrls,
          submissionId: inserted.id,
          createdAt: new Date(),
        })

        const approveBtn = new ButtonBuilder()
          .setCustomId(`approve_quest_${inserted.id}`)
          .setLabel('✅ Approve')
          .setStyle(ButtonStyle.Success)

        const rejectBtn = new ButtonBuilder()
          .setCustomId(`reject_quest_${inserted.id}`)
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Danger)

        const webBtn = new ButtonBuilder()
          .setLabel('🔗 ดูบนเว็บ')
          .setURL(`${config.webUrl}/dashboard/action-quest/quests`)
          .setStyle(ButtonStyle.Link)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn, webBtn)

        await (channel as TextChannel).send({ embeds: [approvalEmbed], components: [row] })
      }
    } catch (e) {
      console.error('[submit-quest] Failed to post to approvals channel:', e)
    }
  }
}
