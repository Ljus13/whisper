import { ModalSubmitInteraction, MessageFlags } from 'discord.js'
import { handleSubmitQuestModal } from '../commands/player/submit-quest'
import { handleSleepModal } from '../commands/player/sleep'
import { handlePrayerModal } from '../commands/player/prayer'

export async function handleModal(interaction: ModalSubmitInteraction) {
  const { customId } = interaction

  try {
    if (customId === 'modal_submit_quest') {
      return await handleSubmitQuestModal(interaction)
    }

    if (customId === 'modal_sleep') {
      return await handleSleepModal(interaction)
    }

    if (customId === 'modal_prayer') {
      return await handlePrayerModal(interaction)
    }

    // Phase 2: Approve/Reject note modal
    if (customId.startsWith('modal_approve_')) {
      // TODO: Phase 2 — handleApproveNoteModal(interaction)
      await interaction.reply({ content: '⏳ (Phase 2) Approve modal ยังไม่ได้ implement', flags: MessageFlags.Ephemeral })
      return
    }

    if (customId.startsWith('modal_reject_')) {
      // TODO: Phase 2 — handleRejectReasonModal(interaction)
      await interaction.reply({ content: '⏳ (Phase 2) Reject modal ยังไม่ได้ implement', flags: MessageFlags.Ephemeral })
      return
    }

    // Unknown modal
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ ไม่รู้จัก modal นี้', flags: MessageFlags.Ephemeral })
    }
  } catch (error) {
    console.error('[modal-handler] Error:', error)
    try {
      const msg = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่' }
      if (interaction.deferred) await interaction.editReply(msg)
      else if (!interaction.replied) await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral })
    } catch {}
  }
}
