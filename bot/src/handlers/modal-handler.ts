import { ModalSubmitInteraction } from 'discord.js'
import { handleSubmitActionModal } from '../commands/player/submit-action'
import { handleSubmitQuestModal } from '../commands/player/submit-quest'
import { handleSleepModal } from '../commands/player/sleep'

export async function handleModal(interaction: ModalSubmitInteraction) {
  const { customId } = interaction

  try {
    if (customId === 'modal_submit_action') {
      return await handleSubmitActionModal(interaction)
    }

    if (customId === 'modal_submit_quest') {
      return await handleSubmitQuestModal(interaction)
    }

    if (customId === 'modal_sleep') {
      return await handleSleepModal(interaction)
    }

    // Phase 2: Approve/Reject note modal
    if (customId.startsWith('modal_approve_')) {
      // TODO: Phase 2 — handleApproveNoteModal(interaction)
      await interaction.reply({ content: '⏳ (Phase 2) Approve modal ยังไม่ได้ implement', ephemeral: true })
      return
    }

    if (customId.startsWith('modal_reject_')) {
      // TODO: Phase 2 — handleRejectReasonModal(interaction)
      await interaction.reply({ content: '⏳ (Phase 2) Reject modal ยังไม่ได้ implement', ephemeral: true })
      return
    }

    // Unknown modal
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ ไม่รู้จัก modal นี้', ephemeral: true })
    }
  } catch (error) {
    console.error('[modal-handler] Error:', error)
    try {
      const msg = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', ephemeral: true }
      if (interaction.deferred) await interaction.editReply(msg)
      else if (!interaction.replied) await interaction.reply(msg)
    } catch {}
  }
}
