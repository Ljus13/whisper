import {
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js'

export async function handleButton(interaction: ButtonInteraction) {
  const { customId } = interaction

  try {
    // ── Approve buttons → แสดง Modal ให้ใส่ Note (optional) ──
    if (
      customId.startsWith('approve_action_') ||
      customId.startsWith('approve_quest_') ||
      customId.startsWith('approve_sleep_')
    ) {
      return await showApproveModal(interaction)
    }

    // ── Reject buttons → แสดง Modal ให้ใส่ Reason ──
    if (
      customId.startsWith('reject_action_') ||
      customId.startsWith('reject_quest_') ||
      customId.startsWith('reject_sleep_')
    ) {
      return await showRejectModal(interaction)
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

/**
 * แสดง Modal สำหรับ Approve — ให้ admin ใส่ note (optional)
 * customId format: modal_approve_{type}_{submissionId}
 */
async function showApproveModal(interaction: ButtonInteraction) {
  // extract type & id จาก button customId เช่น "approve_action_xxxx-xxxx"
  const parts = interaction.customId.split('_')
  // parts[0] = 'approve', parts[1] = type, parts[2..] = submissionId
  const type = parts[1] // action | quest | sleep
  const submissionId = parts.slice(2).join('_')

  const modal = new ModalBuilder()
    .setCustomId(`modal_approve_${type}_${submissionId}`)
    .setTitle('✅ อนุมัติ Submission')

  const noteInput = new TextInputBuilder()
    .setCustomId('approve_note')
    .setLabel('หมายเหตุ (ไม่ต้องกรอกก็ได้)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200)
    .setPlaceholder('เช่น ดีมาก, หลักฐานครบ')

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput),
  )

  await interaction.showModal(modal)
}

/**
 * แสดง Modal สำหรับ Reject — ให้ admin ใส่เหตุผล
 * customId format: modal_reject_{type}_{submissionId}
 */
async function showRejectModal(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_')
  const type = parts[1]
  const submissionId = parts.slice(2).join('_')

  const isSleep = type === 'sleep'

  const modal = new ModalBuilder()
    .setCustomId(`modal_reject_${type}_${submissionId}`)
    .setTitle('❌ ปฏิเสธ Submission')

  const reasonInput = new TextInputBuilder()
    .setCustomId('reject_reason')
    .setLabel(isSleep ? 'เหตุผล (ไม่ต้องกรอกก็ได้)' : 'เหตุผลที่ปฏิเสธ')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(!isSleep) // Sleep ไม่บังคับ reason
    .setMaxLength(500)
    .setPlaceholder(isSleep ? 'กรอกเหตุผลถ้าต้องการ' : 'กรุณาระบุเหตุผลที่ปฏิเสธ')

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
  )

  await interaction.showModal(modal)
}
