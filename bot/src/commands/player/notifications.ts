import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS } from '../../lib/embeds'

export const data = new SlashCommandBuilder()
  .setName('notifications')
  .setDescription('ดูการแจ้งเตือน 5 รายการล่าสุดของคุณ')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  const isAdmin = profile.role === 'admin' || profile.role === 'dm'

  // ดึง 5 notifications ล่าสุด (logic เดิมจาก getNotifications)
  let query = supabase
    .from('notifications')
    .select('id, target_user_id, actor_name, type, title, message, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (isAdmin) {
    query = query.or(`target_user_id.eq.${profile.id},target_user_id.is.null`)
  } else {
    query = query.eq('target_user_id', profile.id)
  }

  const { data: notifications, error } = await query

  if (error) {
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการดึงการแจ้งเตือน' })
    return
  }

  if (!notifications || notifications.length === 0) {
    await interaction.editReply({ content: '📭 ไม่มีการแจ้งเตือนในขณะนี้' })
    return
  }

  const typeEmoji: Record<string, string> = {
    action_submitted: '⚔️',
    action_approved: '✅',
    action_rejected: '❌',
    quest_submitted: '📜',
    quest_approved: '✅',
    quest_rejected: '❌',
    sleep_submitted: '🌙',
    sleep_approved: '✅',
    sleep_rejected: '❌',
    punishment: '⚠️',
    pathway_granted: '🌟',
    default: '🔔',
  }

  const embed = new EmbedBuilder()
    .setTitle('🔔 การแจ้งเตือนล่าสุด')
    .setColor(COLORS.info)
    .setTimestamp()

  for (const n of notifications) {
    const emoji = typeEmoji[n.type] ?? typeEmoji.default
    const readMark = n.is_read ? '' : ' 🆕'
    const time = n.created_at
      ? `<t:${Math.floor(new Date(n.created_at).getTime() / 1000)}:R>`
      : ''

    embed.addFields({
      name: `${emoji} ${n.title}${readMark}`,
      value: [n.message || '—', time].filter(Boolean).join(' · ').slice(0, 1024),
      inline: false,
    })
  }

  embed.setFooter({ text: 'แสดง 5 รายการล่าสุด · อ่านรายละเอียดเพิ่มเติมได้บนเว็บ' })

  await interaction.editReply({ embeds: [embed] })
}
