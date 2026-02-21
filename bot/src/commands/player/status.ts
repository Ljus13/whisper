import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { requireLinkedProfile, getPlayerPathway } from '../../lib/supabase'
import { buildStatusEmbed } from '../../lib/embeds'

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('ดูสถานะตัวละครของคุณ')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  const pathway = await getPlayerPathway(profile.id)
  const embed = buildStatusEmbed(profile, pathway)
  await interaction.editReply({ embeds: [embed] })
}
