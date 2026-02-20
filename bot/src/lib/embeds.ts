import { EmbedBuilder, ColorResolvable } from 'discord.js'

// สีหลักของ Whisper of the Shadow
export const COLORS = {
  primary: 0x8B4513 as ColorResolvable,    // น้ำตาลเข้ม
  success: 0x2ECC71 as ColorResolvable,    // เขียว
  danger: 0xE74C3C as ColorResolvable,     // แดง
  warning: 0xF39C12 as ColorResolvable,    // ส้ม
  info: 0x3498DB as ColorResolvable,       // น้ำเงิน
  dark: 0x2C3E50 as ColorResolvable,       // ดำเทา
  pending: 0xF1C40F as ColorResolvable,    // เหลือง (รอดำเนินการ)
}

/**
 * Text-art progress bar
 * ████████░░  8/10
 */
export function progressBar(current: number, max: number, length = 10): string {
  if (max <= 0) return '░'.repeat(length)
  const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)))
  return '█'.repeat(filled) + '░'.repeat(length - filled)
}

/**
 * Embed สถานะตัวละคร (ใช้ใน /status)
 */
export function buildStatusEmbed(profile: {
  display_name: string | null
  avatar_url: string | null
  role: string
  hp: number
  max_hp: number
  sanity: number
  max_sanity: number
  travel_points: number
  max_travel_points: number
  spirituality: number
  max_spirituality: number
}): EmbedBuilder {
  const name = profile.display_name || 'ผู้เล่น'

  const bar = (val: number, max: number) =>
    `${progressBar(val, max)}  **${val}/${max}**`

  const roleLabel: Record<string, string> = {
    player: '🎭 ผู้เล่น',
    admin: '⚙️ Admin',
    dm: '👑 Dungeon Master',
  }

  return new EmbedBuilder()
    .setTitle(`🎭 ${name}`)
    .setThumbnail(profile.avatar_url || null)
    .setColor(COLORS.primary)
    .addFields(
      { name: '❤️ HP', value: bar(profile.hp, profile.max_hp), inline: false },
      { name: '🧠 Sanity', value: bar(profile.sanity, profile.max_sanity), inline: false },
      { name: '👟 Travel Points', value: bar(profile.travel_points, profile.max_travel_points), inline: false },
      { name: '✨ Spirituality', value: bar(profile.spirituality, profile.max_spirituality), inline: false },
    )
    .setFooter({ text: roleLabel[profile.role] || profile.role })
    .setTimestamp()
}

/**
 * Embed submission รอ Admin อนุมัติ (ใช้ post ไปที่ #approvals)
 */
export function buildApprovalEmbed(opts: {
  type: 'action' | 'quest' | 'sleep'
  playerName: string
  playerAvatar?: string | null
  codeName?: string
  codeStr?: string
  evidenceUrls?: string[]
  mealUrl?: string
  sleepUrl?: string
  submissionId: string
  createdAt?: Date
}): EmbedBuilder {
  const typeLabel = opts.type === 'action' ? '⚔️ Action' : opts.type === 'quest' ? '📜 Quest' : '🌙 Sleep'
  const typeColor = opts.type === 'sleep' ? COLORS.info : COLORS.pending

  const embed = new EmbedBuilder()
    .setTitle(`${typeLabel} Submission — รอการอนุมัติ`)
    .setColor(typeColor)
    .setTimestamp(opts.createdAt ?? new Date())
    .setFooter({ text: `ID: ${opts.submissionId}` })

  if (opts.playerAvatar) {
    embed.setAuthor({ name: opts.playerName, iconURL: opts.playerAvatar })
  } else {
    embed.setAuthor({ name: opts.playerName })
  }

  if (opts.type !== 'sleep') {
    embed.addFields(
      { name: '🔑 Code', value: opts.codeStr ? `\`${opts.codeStr}\`` : '—', inline: true },
      { name: '📋 ชื่อ', value: opts.codeName || '—', inline: true },
    )
    if (opts.evidenceUrls && opts.evidenceUrls.length > 0) {
      embed.addFields({
        name: '🖼️ หลักฐาน',
        value: opts.evidenceUrls.slice(0, 3).map((u, i) => `[ลิงก์ ${i + 1}](${u})`).join('  ·  '),
        inline: false,
      })
    }
  } else {
    if (opts.mealUrl) {
      embed.addFields({ name: '🍽️ อาหาร', value: `[ดูรูป](${opts.mealUrl})`, inline: true })
    }
    if (opts.sleepUrl) {
      embed.addFields({ name: '😴 นอน', value: `[ดูรูป](${opts.sleepUrl})`, inline: true })
    }
  }

  return embed
}

/**
 * Embed error ทั่วไป
 */
export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.danger)
    .setDescription(`❌ ${message}`)
}

/**
 * Embed success ทั่วไป
 */
export function buildSuccessEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`✅ ${title}`)
    .setDescription(description || null)
    .setTimestamp()
}
