import { EmbedBuilder, Client } from 'discord.js'
import { supabase } from './supabase'
import { COLORS, progressBar } from './embeds'

/**
 * ส่ง DM ไปหาผู้เล่นผ่าน Discord โดยใช้ profile ID (Supabase UUID)
 * จะ lookup discord_user_id จาก profiles แล้ว fetch Discord user
 */
export async function sendDMToPlayer(
  client: Client,
  playerProfileId: string,
  options: { embeds?: EmbedBuilder[]; content?: string },
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('discord_user_id')
      .eq('id', playerProfileId)
      .single()

    if (!profile?.discord_user_id) return false

    const user = await client.users.fetch(profile.discord_user_id).catch(() => null)
    if (!user) return false

    await user.send(options)
    return true
  } catch (err) {
    console.error('[dm-notify] Failed to send DM:', err)
    return false
  }
}

/**
 * ส่ง DM แจ้งผลการอนุมัติ Action/Quest พร้อมสรุปรางวัล
 */
export async function notifyApproval(
  client: Client,
  opts: {
    type: 'action' | 'quest' | 'sleep'
    playerProfileId: string
    codeName?: string
    adminName: string
    rewards?: {
      hp?: number
      sanity?: number
      travel?: number
      spirituality?: number
      maxSanity?: number
      maxTravel?: number
      maxSpirituality?: number
    }
  },
): Promise<void> {
  const { type, playerProfileId, codeName, adminName, rewards } = opts

  const typeLabel = type === 'action' ? '⚔️ แอคชั่น' : type === 'quest' ? '📜 ภารกิจ' : '🌙 การนอนหลับ'

  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`✅ ${typeLabel}ได้รับการอนุมัติแล้ว!`)
    .setTimestamp()

  if (codeName) {
    embed.setDescription(`**${codeName}** ได้รับการอนุมัติโดย ${adminName}`)
  } else {
    embed.setDescription(`ได้รับการอนุมัติโดย ${adminName}`)
  }

  if (type === 'sleep') {
    embed.addFields({ name: '✨ พลังวิญญาณ', value: 'ฟื้นฟูเต็มแล้ว!', inline: false })
  } else if (rewards) {
    const rewardLines: string[] = []
    if (rewards.hp && rewards.hp !== 0) rewardLines.push(`❤️ HP ${rewards.hp > 0 ? '+' : ''}${rewards.hp}`)
    if (rewards.sanity && rewards.sanity !== 0) rewardLines.push(`🧠 Sanity ${rewards.sanity > 0 ? '+' : ''}${rewards.sanity}`)
    if (rewards.travel && rewards.travel !== 0) rewardLines.push(`👟 Travel ${rewards.travel > 0 ? '+' : ''}${rewards.travel}`)
    if (rewards.spirituality && rewards.spirituality !== 0) rewardLines.push(`✨ Spirit ${rewards.spirituality > 0 ? '+' : ''}${rewards.spirituality}`)
    if (rewards.maxSanity && rewards.maxSanity !== 0) rewardLines.push(`🧠 Max Sanity ${rewards.maxSanity > 0 ? '+' : ''}${rewards.maxSanity}`)
    if (rewards.maxTravel && rewards.maxTravel !== 0) rewardLines.push(`👟 Max Travel ${rewards.maxTravel > 0 ? '+' : ''}${rewards.maxTravel}`)
    if (rewards.maxSpirituality && rewards.maxSpirituality !== 0) rewardLines.push(`✨ Max Spirit ${rewards.maxSpirituality > 0 ? '+' : ''}${rewards.maxSpirituality}`)

    if (rewardLines.length > 0) {
      embed.addFields({ name: '🎁 รางวัลที่ได้รับ', value: rewardLines.join('\n'), inline: false })
    }
  }

  await sendDMToPlayer(client, playerProfileId, { embeds: [embed] })
}

/**
 * ส่ง DM แจ้งผลการปฏิเสธ
 */
export async function notifyRejection(
  client: Client,
  opts: {
    type: 'action' | 'quest' | 'sleep'
    playerProfileId: string
    codeName?: string
    adminName: string
    reason?: string
  },
): Promise<void> {
  const { type, playerProfileId, codeName, adminName, reason } = opts

  const typeLabel = type === 'action' ? '⚔️ แอคชั่น' : type === 'quest' ? '📜 ภารกิจ' : '🌙 การนอนหลับ'

  const embed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle(`❌ ${typeLabel}ถูกปฏิเสธ`)
    .setTimestamp()

  if (codeName) {
    embed.setDescription(`**${codeName}** ถูกปฏิเสธโดย ${adminName}`)
  } else {
    embed.setDescription(`ถูกปฏิเสธโดย ${adminName}`)
  }

  if (reason) {
    embed.addFields({ name: '📝 เหตุผล', value: reason, inline: false })
  }

  await sendDMToPlayer(client, playerProfileId, { embeds: [embed] })
}
