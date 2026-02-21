import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { requireStaffProfile, supabase } from '../../lib/supabase'
import { buildSuccessEmbed, buildErrorEmbed } from '../../lib/embeds'
import { notifyApproval } from '../../lib/dm-notify'

export const data = new SlashCommandBuilder()
  .setName('approve-sleep')
  .setDescription('อนุมัติ Sleep Request ของผู้เล่นที่ระบุ 🌙')
  .addUserOption(opt =>
    opt
      .setName('player')
      .setDescription('ผู้เล่นที่ต้องการอนุมัติ sleep')
      .setRequired(true),
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const admin = await requireStaffProfile(interaction)
  if (!admin) return

  const targetUser = interaction.options.getUser('player', true)

  // ── หา profile ของผู้เล่นเป้าหมายจาก Discord ID ──
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, display_name, max_spirituality')
    .eq('discord_user_id', targetUser.id)
    .single()

  if (!targetProfile) {
    await interaction.editReply({
      embeds: [buildErrorEmbed(`ไม่พบบัญชีของ ${targetUser.username} ในระบบ`)],
    })
    return
  }

  // ── หา pending sleep request ล่าสุดของผู้เล่น ──
  const { data: request } = await supabase
    .from('sleep_requests')
    .select('id, player_id, status')
    .eq('player_id', targetProfile.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!request) {
    await interaction.editReply({
      embeds: [buildErrorEmbed(`${targetProfile.display_name} ไม่มี Sleep Request ที่รออนุมัติ`)],
    })
    return
  }

  // ── อนุมัติ ──
  const { error: updateErr } = await supabase
    .from('sleep_requests')
    .update({ status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq('id', request.id)

  if (updateErr) {
    await interaction.editReply({ embeds: [buildErrorEmbed(updateErr.message)] })
    return
  }

  // ฟื้นฟู spirituality
  await supabase
    .from('profiles')
    .update({ spirituality: targetProfile.max_spirituality })
    .eq('id', targetProfile.id)

  // Notification
  await supabase.from('notifications').insert({
    target_user_id: targetProfile.id,
    actor_id: admin.id,
    type: 'sleep_approved',
    title: 'การนอนหลับได้รับการอนุมัติ',
    message: 'พลังวิญญาณถูกฟื้นฟูเต็มแล้ว',
    link: '/dashboard/action-quest/sleep',
  })

  // DM ผู้เล่น
  await notifyApproval(interaction.client, {
    type: 'sleep',
    playerProfileId: targetProfile.id,
    adminName: admin.display_name || 'Admin',
  })

  await interaction.editReply({
    embeds: [buildSuccessEmbed(
      `อนุมัติ Sleep ของ ${targetProfile.display_name} สำเร็จ`,
      `✨ พลังวิญญาณฟื้นฟูเต็ม (${targetProfile.max_spirituality}/${targetProfile.max_spirituality})`,
    )],
  })
}
