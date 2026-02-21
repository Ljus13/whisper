import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS, buildErrorEmbed, buildSuccessEmbed } from '../../lib/embeds'

export const data = new SlashCommandBuilder()
  .setName('prayer')
  .setDescription('สวดมนต์ที่โบสถ์เพื่อฟื้นฟูสติ 🙏')

export async function execute(interaction: ChatInputCommandInteraction) {
  // แสดง Modal ก่อน (ต้องทำก่อน defer)
  const modal = new ModalBuilder()
    .setCustomId('modal_prayer')
    .setTitle('สวดมนต์ 🙏')

  const evidenceInput = new TextInputBuilder()
    .setCustomId('evidence_urls')
    .setLabel('ลิงก์หลักฐาน (อย่างน้อย 2 ลิงก์, บรรทัดละลิงก์)')
    .setPlaceholder('https://example.com/prayer1\nhttps://example.com/prayer2')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput),
  )

  await interaction.showModal(modal)
}

/* ─────────────────────────────────────────
   Modal handler: modal_prayer
   ───────────────────────────────────────── */
export async function handlePrayerModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  // 1. ตรวจสอบโปรไฟล์
  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  // 2. Parse URLs
  const rawUrls = interaction.fields.getTextInputValue('evidence_urls')
  const urls = rawUrls
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0)

  if (urls.length < 2) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('ต้องแนบ URL อย่างน้อย 2 ลิงก์ (บรรทัดละลิงก์)')],
    })
    return
  }

  // 3. ตรวจสอบศาสนา
  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('id, religion_id, sanity, max_sanity')
    .eq('id', profile.id)
    .single()

  if (!playerProfile) {
    await interaction.editReply({ embeds: [buildErrorEmbed('ไม่พบโปรไฟล์')] })
    return
  }

  if (!playerProfile.religion_id) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('คุณยังไม่ได้เลือกศาสนา กรุณาตั้งค่าศาสนาก่อน')],
    })
    return
  }

  // 4. สติเต็มหรือยัง?
  if (playerProfile.sanity >= playerProfile.max_sanity) {
    await interaction.editReply({
      embeds: [buildErrorEmbed(`สติเต็มแล้ว (${playerProfile.sanity}/${playerProfile.max_sanity})`)],
    })
    return
  }

  // 5. ตรวจตำแหน่งบนแผนที่
  const { data: playerToken } = await supabase
    .from('map_tokens')
    .select('id, map_id, position_x, position_y')
    .eq('user_id', profile.id)
    .single()

  if (!playerToken) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('คุณยังไม่ได้อยู่บนแผนที่ใด ๆ')],
    })
    return
  }

  // 6. หาโบสถ์ของศาสนาเดียวกันบนแผนที่เดียวกัน
  const { data: churches } = await supabase
    .from('map_churches')
    .select('id, position_x, position_y, radius')
    .eq('map_id', playerToken.map_id)
    .eq('religion_id', playerProfile.religion_id)

  if (!churches || churches.length === 0) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('ไม่พบโบสถ์ของศาสนาคุณในแผนที่นี้')],
    })
    return
  }

  // 7. ตรวจว่าอยู่ในระยะโบสถ์ไหม
  const inRange = churches.find(c => {
    const dx = playerToken.position_x - c.position_x
    const dy = playerToken.position_y - c.position_y
    const dist = Math.sqrt(dx * dx + dy * dy)
    return dist <= c.radius
  })

  if (!inRange) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('คุณอยู่นอกระยะทำการของโบสถ์ กรุณาเดินเข้าไปให้ใกล้ขึ้น')],
    })
    return
  }

  // 8. คำนวณสติที่ได้ (+1 per URL, cap max)
  const gain = Math.min(urls.length, playerProfile.max_sanity - playerProfile.sanity)

  // 9. บันทึก prayer_logs
  const { error: logError } = await supabase.from('prayer_logs').insert({
    player_id: profile.id,
    church_id: inRange.id,
    evidence_urls: urls,
    sanity_gained: gain,
  })

  if (logError) {
    console.error('Prayer log insert error:', logError)
    await interaction.editReply({
      embeds: [buildErrorEmbed('บันทึก Prayer ผิดพลาด กรุณาลองใหม่')],
    })
    return
  }

  // 10. อัปเดตสติ
  const newSanity = Math.min(playerProfile.max_sanity, playerProfile.sanity + gain)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ sanity: newSanity })
    .eq('id', profile.id)

  if (updateError) {
    console.error('Sanity update error:', updateError)
    await interaction.editReply({
      embeds: [buildErrorEmbed('อัปเดตสติผิดพลาด กรุณาแจ้ง DM')],
    })
    return
  }

  // 11. สร้าง notification
  const actorName = profile.display_name || 'ผู้เล่น'
  await supabase.from('notifications').insert({
    target_user_id: null,
    actor_id: profile.id,
    actor_name: actorName,
    type: 'prayer_submitted',
    title: `${actorName} สวดมนต์ที่โบสถ์`,
    message: `สติเพิ่ม +${gain} (ลิงก์ ${urls.length} รายการ)`,
    link: '/dashboard/action-quest',
  })

  // 12. ตอบกลับ
  await interaction.editReply({
    embeds: [
      buildSuccessEmbed(
        `🙏 สวดมนต์สำเร็จ!\n\n` +
        `สติเพิ่ม **+${gain}**\n` +
        `สติปัจจุบัน: **${newSanity}/${playerProfile.max_sanity}**\n` +
        `หลักฐาน: ${urls.length} ลิงก์`,
      ),
    ],
  })
}
