import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS } from '../../lib/embeds'

export const data = new SlashCommandBuilder()
  .setName('my-skills')
  .setDescription('ดู skills ที่คุณ unlock แล้ว')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  // granted_skills → skills → skill_pathways / skill_sequences
  const { data: grantedSkills, error } = await supabase
    .from('granted_skills')
    .select(`
      id,
      title,
      detail,
      reuse_policy,
      skill:skills (
        name,
        pathway:skill_pathways ( name ),
        sequence:skill_sequences ( name, seq_number )
      )
    `)
    .eq('player_id', profile.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการดึงข้อมูล Skills' })
    return
  }

  if (!grantedSkills || grantedSkills.length === 0) {
    await interaction.editReply({ content: '📭 คุณยังไม่มี Skill ที่ได้รับ' })
    return
  }

  // จัดกลุ่มตาม pathway
  const byPathway = new Map<string, { title: string; reuse: string }[]>()
  for (const g of grantedSkills) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skill = g.skill as any
    const pathwayName = skill?.pathway?.name ?? 'ไม่มีสายวิชา'
    if (!byPathway.has(pathwayName)) byPathway.set(pathwayName, [])
    byPathway.get(pathwayName)!.push({ title: g.title, reuse: g.reuse_policy })
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Skills ของ ${profile.display_name}`)
    .setColor(COLORS.primary)
    .setTimestamp()

  let fieldCount = 0
  for (const [pathwayName, skills] of byPathway) {
    if (fieldCount >= 24) break
    const list = skills.map(s => {
      const icon = s.reuse === 'unlimited' ? '♾️' : s.reuse === 'cooldown' ? '⏳' : '1️⃣'
      return `${icon} **${s.title}**`
    }).join('\n')
    embed.addFields({ name: `🌟 ${pathwayName}`, value: list.slice(0, 1024), inline: false })
    fieldCount++
  }

  await interaction.editReply({ embeds: [embed] })
}
