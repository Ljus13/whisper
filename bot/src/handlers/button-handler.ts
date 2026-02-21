import { ButtonInteraction, MessageFlags } from 'discord.js'
// Phase 2: import approve/reject handlers here

export async function handleButton(interaction: ButtonInteraction) {
  const { customId } = interaction

  try {
    // ── Phase 1: ไม่มี button ที่ต้องจัดการ ──
    // Phase 2 จะเพิ่ม approve_action_, reject_action_, approve_quest_, reject_quest_, approve_sleep_, reject_sleep_

    if (customId.startsWith('approve_quest_')) {
      // TODO: Phase 2
      await interaction.reply({ content: '⏳ (Phase 2) ระบบ Approve ยังไม่พร้อมใช้งาน', flags: MessageFlags.Ephemeral })
      return
    }

    if (customId.startsWith('reject_quest_')) {
      // TODO: Phase 2
      await interaction.reply({ content: '⏳ (Phase 2) ระบบ Reject ยังไม่พร้อมใช้งาน', flags: MessageFlags.Ephemeral })
      return
    }

    if (customId.startsWith('approve_sleep_')) {
      // TODO: Phase 2
      await interaction.reply({ content: '⏳ (Phase 2) ระบบ Approve ยังไม่พร้อมใช้งาน', flags: MessageFlags.Ephemeral })
      return
    }

    if (customId.startsWith('reject_sleep_')) {
      // TODO: Phase 2
      await interaction.reply({ content: '⏳ (Phase 2) ระบบ Reject ยังไม่พร้อมใช้งาน', flags: MessageFlags.Ephemeral })
      return
    }

    // Unknown button
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ ไม่รู้จัก button นี้', flags: MessageFlags.Ephemeral })
    }
  } catch (error) {
    console.error('[button-handler] Error:', error)
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ เกิดข้อผิดพลาด', flags: MessageFlags.Ephemeral })
      }
    } catch {}
  }
}
