import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js'
import { requireStaffProfile, supabase } from '../../lib/supabase'
import { COLORS } from '../../lib/embeds'
import { config } from '../../config'

export const data = new SlashCommandBuilder()
  .setName('pending')
  .setDescription('ดูรายการ Submission ที่รออนุมัติ 📋')
  .addStringOption(opt =>
    opt
      .setName('type')
      .setDescription('ประเภทที่ต้องการดู')
      .setRequired(false)
      .addChoices(
        { name: 'ทั้งหมด', value: 'all' },
        { name: '⚔️ Actions', value: 'actions' },
        { name: '📜 Quests', value: 'quests' },
        { name: '🌙 Sleep', value: 'sleep' },
      ),
  )
  .addIntegerOption(opt =>
    opt
      .setName('page')
      .setDescription('หน้าที่ต้องการดู (เริ่มจาก 1)')
      .setRequired(false)
      .setMinValue(1),
  )

const PAGE_SIZE = 5

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireStaffProfile(interaction)
  if (!profile) return

  const type = interaction.options.getString('type') ?? 'all'
  const page = interaction.options.getInteger('page') ?? 1
  const offset = (page - 1) * PAGE_SIZE

  const items: {
    id: string
    type: 'action' | 'quest' | 'sleep'
    playerName: string
    codeName: string
    createdAt: string
  }[] = []

  // ── Fetch pending submissions ──
  if (type === 'all' || type === 'actions') {
    const { data: actions } = await supabase
      .from('action_submissions')
      .select('id, created_at, profiles!player_id(display_name), action_codes!action_code_id(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (actions) {
      for (const a of actions) {
        items.push({
          id: a.id,
          type: 'action',
          playerName: (a as any).profiles?.display_name ?? 'ไม่ทราบ',
          codeName: (a as any).action_codes?.name ?? '—',
          createdAt: a.created_at,
        })
      }
    }
  }

  if (type === 'all' || type === 'quests') {
    const { data: quests } = await supabase
      .from('quest_submissions')
      .select('id, created_at, profiles!player_id(display_name), quest_codes!quest_code_id(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (quests) {
      for (const q of quests) {
        items.push({
          id: q.id,
          type: 'quest',
          playerName: (q as any).profiles?.display_name ?? 'ไม่ทราบ',
          codeName: (q as any).quest_codes?.name ?? '—',
          createdAt: q.created_at,
        })
      }
    }
  }

  if (type === 'all' || type === 'sleep') {
    const { data: sleeps } = await supabase
      .from('sleep_requests')
      .select('id, created_at, profiles!player_id(display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (sleeps) {
      for (const s of sleeps) {
        items.push({
          id: s.id,
          type: 'sleep',
          playerName: (s as any).profiles?.display_name ?? 'ไม่ทราบ',
          codeName: '🌙 Sleep Request',
          createdAt: s.created_at,
        })
      }
    }
  }

  // ── Sort by createdAt and limit ──
  items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const displayed = items.slice(0, PAGE_SIZE)

  if (displayed.length === 0) {
    await interaction.editReply({ content: '✅ ไม่มีรายการที่รออนุมัติ' })
    return
  }

  // ── Count totals ──
  const countResults = await Promise.all([
    supabase.from('action_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('quest_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('sleep_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const totalActions = countResults[0].count ?? 0
  const totalQuests = countResults[1].count ?? 0
  const totalSleep = countResults[2].count ?? 0
  const totalAll = totalActions + totalQuests + totalSleep

  const typeEmoji: Record<string, string> = { action: '⚔️', quest: '📜', sleep: '🌙' }

  const embed = new EmbedBuilder()
    .setTitle('📋 รายการรออนุมัติ')
    .setColor(COLORS.pending)
    .setDescription(
      `**ทั้งหมด:** ${totalAll} รายการ` +
      `\n⚔️ Actions: ${totalActions}  ·  📜 Quests: ${totalQuests}  ·  🌙 Sleep: ${totalSleep}` +
      `\n\n**หน้า ${page}:**`,
    )
    .setTimestamp()

  for (const item of displayed) {
    const ts = Math.floor(new Date(item.createdAt).getTime() / 1000)
    embed.addFields({
      name: `${typeEmoji[item.type]} ${item.codeName}`,
      value: `👤 ${item.playerName}\n🕐 <t:${ts}:R>\n\`ID: ${item.id.slice(0, 8)}...\``,
      inline: true,
    })
  }

  embed.setFooter({ text: `ใช้ /approve [id] หรือ /reject [id] เพื่อดำเนินการ` })

  await interaction.editReply({ embeds: [embed] })
}
