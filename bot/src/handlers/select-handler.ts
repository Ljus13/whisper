import { StringSelectMenuInteraction } from 'discord.js'

export async function handleSelect(interaction: StringSelectMenuInteraction) {
  const { customId } = interaction

  try {
    // Phase 3: grant-pathway select menu จะ implement ที่นี่
    if (customId.startsWith('select_pathway_')) {
      await interaction.reply({ content: '⏳ (Phase 3) ระบบ Grant Pathway ยังไม่พร้อมใช้งาน', ephemeral: true })
      return
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ ไม่รู้จัก select menu นี้', ephemeral: true })
    }
  } catch (error) {
    console.error('[select-handler] Error:', error)
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true })
      }
    } catch {}
  }
}
