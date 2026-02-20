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
  .setName('sleep')
  .setDescription('ส่งคำขอนอนหลับพักผ่อน (Sleep Request) 🌙')

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_sleep')
    .setTitle('ส่งคำขอนอนหลับ 🌙')

  const mealInput = new TextInputBuilder()
    .setCustomId('meal_url')
    .setLabel('URL รูปอาหาร 🍽️')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/meal.jpg')
    .setRequired(true)
    .setMaxLength(500)

  const sleepInput = new TextInputBuilder()
    .setCustomId('sleep_url')
    .setLabel('URL รูปที่นอน 😴')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/sleep.jpg')
    .setRequired(true)
    .setMaxLength(500)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(mealInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(sleepInput),
  )

  await interaction.showModal(modal)
}

/**
 * จัดการเมื่อผู้เล่น submit Modal sleep
 * เรียกจาก modal-handler.ts
 */
export async function handleSleepModal(interaction: import('discord.js').ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  const mealUrl = interaction.fields.getTextInputValue('meal_url').trim()
  const sleepUrl = interaction.fields.getTextInputValue('sleep_url').trim()

  if (!mealUrl || !sleepUrl) {
    await interaction.editReply({ content: '❌ กรุณากรอก URL ทั้ง 2 ลิงก์' })
    return
  }

  // ── ตรวจสอบว่าผู้เล่นอยู่ในเขตจุดพักหรือไม่ ──
  const { data: playerToken } = await supabase
    .from('map_tokens')
    .select('position_x, position_y, map_id')
    .eq('user_id', profile.id)
    .eq('token_type', 'player')
    .maybeSingle()

  if (!playerToken) {
    await interaction.editReply({
      content: '❌ ไม่พบตัวละครบนแผนที่ — ต้องอยู่ในเขตจุดพักเท่านั้นจึงจะนอนหลับได้',
    })
    return
  }

  const { data: restPoints } = await supabase
    .from('map_rest_points')
    .select('position_x, position_y, radius')
    .eq('map_id', playerToken.map_id)

  let inRestZone = false
  if (restPoints && restPoints.length > 0) {
    for (const rp of restPoints) {
      const dx = playerToken.position_x - rp.position_x
      const dy = playerToken.position_y - rp.position_y
      if (Math.sqrt(dx * dx + dy * dy) <= rp.radius) {
        inRestZone = true
        break
      }
    }
  }

  if (!inRestZone) {
    await interaction.editReply({
      content: '❌ ต้องอยู่ในเขตจุดพักเท่านั้นจึงจะนอนหลับได้',
    })
    return
  }

  // ── ตรวจสอบ cooldown (1 ครั้งต่อวัน) ──
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayRequests } = await supabase
    .from('sleep_requests')
    .select('id')
    .eq('player_id', profile.id)
    .gte('created_at', todayStart.toISOString())

  if (todayRequests && todayRequests.length > 0) {
    await interaction.editReply({
      content: '❌ คุณส่งคำขอนอนหลับได้เพียง 1 ครั้งต่อวันเท่านั้น',
    })
    return
  }

  // ── insert sleep request ──
  const { data: inserted, error } = await supabase
    .from('sleep_requests')
    .insert({ player_id: profile.id, meal_url: mealUrl, sleep_url: sleepUrl })
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
    type: 'sleep_submitted',
    title: `${profile.display_name} ส่งคำขอนอนหลับ`,
    message: 'มีคำขอนอนหลับใหม่รอตรวจสอบ',
    link: '/dashboard/action-quest/sleep',
    is_read: false,
  })

  // ── reply ผู้ส่ง ──
  const successEmbed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('✅ ส่งคำขอนอนหลับสำเร็จ! 🌙')
    .setDescription('รอ Admin / DM ตรวจสอบและอนุมัติ\nเมื่อได้รับการอนุมัติ คุณจะได้รับแจ้งทาง DM')
    .setTimestamp()

  await interaction.editReply({ embeds: [successEmbed] })

  // ── post embed ไปที่ #approvals channel ──
  if (config.channelApprovals) {
    try {
      const channel = interaction.client.channels.cache.get(config.channelApprovals) as TextChannel | null
        ?? await interaction.client.channels.fetch(config.channelApprovals).catch(() => null) as TextChannel | null

      if (channel?.isTextBased()) {
        const approvalEmbed = buildApprovalEmbed({
          type: 'sleep',
          playerName: profile.display_name || interaction.user.username,
          playerAvatar: profile.avatar_url || interaction.user.displayAvatarURL(),
          mealUrl,
          sleepUrl,
          submissionId: inserted.id,
          createdAt: new Date(),
        })

        const approveBtn = new ButtonBuilder()
          .setCustomId(`approve_sleep_${inserted.id}`)
          .setLabel('✅ Approve')
          .setStyle(ButtonStyle.Success)

        const rejectBtn = new ButtonBuilder()
          .setCustomId(`reject_sleep_${inserted.id}`)
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Danger)

        const webBtn = new ButtonBuilder()
          .setLabel('🔗 ดูบนเว็บ')
          .setURL(`${config.webUrl}/dashboard/action-quest/sleep`)
          .setStyle(ButtonStyle.Link)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn, webBtn)

        await (channel as TextChannel).send({ embeds: [approvalEmbed], components: [row] })
      }
    } catch (e) {
      console.error('[sleep] Failed to post to approvals channel:', e)
    }
  }
}
