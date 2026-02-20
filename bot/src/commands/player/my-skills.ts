import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS } from '../../lib/embeds'

export const data = new SlashCommandBuilder()
  .setName('my-skills')
  .setDescription('ดู skills ที่คุณ unlock แล้ว')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  // ดึง granted_skills พร้อม skill pathway info
  const { data: grantedSkills, error } = await supabase
    .from('granted_skills')
    .select(`
      id,
      player_id,
      skill_pathway_id,
      accepted_at,
      created_at,
      skill_pathways (
        id,
        name,
        description
      )
    `)
    .eq('player_id', profile.id)
    .not('accepted_at', 'is', null)
    .order('accepted_at', { ascending: false })

  if (error) {
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการดึงข้อมูล Skills' })
    return
  }

  if (!grantedSkills || grantedSkills.length === 0) {
    await interaction.editReply({ content: '📭 คุณยังไม่มี Skill Pathway ที่ได้รับ' })
    return
  }

  // ดึง skills ภายใต้ pathway ที่ผู้เล่นมี
  const pathwayIds = grantedSkills.map(g => g.skill_pathway_id).filter(Boolean)
  const { data: skills } = await supabase
    .from('skills')
    .select('id, name, description, skill_pathway_id, sort_order')
    .in('skill_pathway_id', pathwayIds)
    .order('skill_pathway_id')
    .order('sort_order')

  const skillsByPathway = new Map<string, typeof skills>()
  for (const skill of (skills || [])) {
    if (!skill.skill_pathway_id) continue
    if (!skillsByPathway.has(skill.skill_pathway_id)) {
      skillsByPathway.set(skill.skill_pathway_id, [])
    }
    skillsByPathway.get(skill.skill_pathway_id)!.push(skill)
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Skills ของ ${profile.display_name}`)
    .setColor(COLORS.primary)
    .setTimestamp()

  let fieldCount = 0
  for (const granted of grantedSkills) {
    if (fieldCount >= 24) break // Discord limit = 25 fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pathway = (granted.skill_pathways as any)
    if (!pathway) continue

    const pathwaySkills = skillsByPathway.get(granted.skill_pathway_id!) || []
    const skillList = pathwaySkills.length > 0
      ? pathwaySkills.map(s => `• **${s.name}**`).join('\n')
      : '_ยังไม่มี skill ในสาย_'

    embed.addFields({
      name: `🌟 ${pathway.name}`,
      value: skillList.slice(0, 1024),
      inline: false,
    })
    fieldCount++
  }

  if (embed.data.fields?.length === 0) {
    embed.setDescription('ยังไม่มี Skill Pathway ที่ยืนยันแล้ว')
  }

  await interaction.editReply({ embeds: [embed] })
}
