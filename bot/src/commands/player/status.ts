import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { requireLinkedProfile } from '../../lib/supabase'
import { buildStatusEmbed } from '../../lib/embeds'

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('ดูสถานะตัวละครของคุณ')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  const embed = buildStatusEmbed(profile)
  await interaction.editReply({ embeds: [embed] })
}
