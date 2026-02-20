/**
 * Discord Webhook Notification Utilities
 * ส่ง notification ไปยัง Discord ผ่าน Webhook
 * Fire-and-forget — ไม่บล็อก server actions
 */

interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

interface DiscordWebhookPayload {
  username?: string
  avatar_url?: string
  content?: string
  embeds?: DiscordEmbed[]
}

/**
 * Core: send a Discord Webhook payload
 * ไม่ throw error ให้ผู้เรียก — fail silently
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<void> {
  if (!webhookUrl) return

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
  } catch {
    console.error('[Discord] Failed to send notification — continuing')
  }
}

// ─── Quest Notification ────────────────────────────────────────────────────────

export interface QuestNotifyParams {
  questName: string
  questCode: string
  creatorName: string
  mapName?: string | null
  npcName?: string | null
  expiresAt?: string | null
  rewards?: {
    hp?: number; sanity?: number; travel?: number; spirituality?: number
    maxSanity?: number; maxTravel?: number; maxSpirituality?: number
  }
}

export async function notifyNewPublicQuest(params: QuestNotifyParams): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_QUEST
  if (!webhookUrl) return

  const fields: NonNullable<DiscordEmbed['fields']> = []

  fields.push({ name: '🔑 รหัสภารกิจ', value: `\`${params.questCode}\``, inline: true })
  fields.push({ name: '👤 ผู้มอบภารกิจ', value: params.creatorName, inline: true })

  if (params.npcName || params.mapName) {
    const location = params.npcName
      ? `${params.npcName}${params.mapName ? ` *(${params.mapName})*` : ''}`
      : (params.mapName ?? '')
    fields.push({ name: '📍 สถานที่', value: location, inline: false })
  }

  const r = params.rewards
  if (r) {
    const parts: string[] = []
    if (r.hp)               parts.push(`❤️ HP ${r.hp > 0 ? '+' : ''}${r.hp}`)
    if (r.sanity)           parts.push(`🧠 Sanity ${r.sanity > 0 ? '+' : ''}${r.sanity}`)
    if (r.travel)           parts.push(`👟 Travel ${r.travel > 0 ? '+' : ''}${r.travel}`)
    if (r.spirituality)     parts.push(`✨ Spirit ${r.spirituality > 0 ? '+' : ''}${r.spirituality}`)
    if (r.maxSanity)        parts.push(`🧠↑ MaxSanity ${r.maxSanity > 0 ? '+' : ''}${r.maxSanity}`)
    if (r.maxTravel)        parts.push(`👟↑ MaxTravel ${r.maxTravel > 0 ? '+' : ''}${r.maxTravel}`)
    if (r.maxSpirituality)  parts.push(`✨↑ MaxSpirit ${r.maxSpirituality > 0 ? '+' : ''}${r.maxSpirituality}`)
    if (parts.length > 0) {
      fields.push({ name: '🎁 รางวัล', value: parts.join('  ·  '), inline: false })
    }
  }

  if (params.expiresAt) {
    const d = new Date(params.expiresAt)
    fields.push({
      name: '⏰ หมดอายุ',
      value: d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      inline: true,
    })
  } else {
    fields.push({ name: '⏰ อายุ', value: 'ตลอดไป', inline: true })
  }

  await sendDiscordNotification(webhookUrl, {
    username: 'ระบบภารกิจ',
    embeds: [{
      title: `📜 ภารกิจใหม่: ${params.questName}`,
      description: '> มีภารกิจใหม่เปิดรับผู้กล้าแล้ว! ใช้รหัสด้านล่างเพื่อส่งหลักฐาน',
      color: 0xFFD700,
      fields,
      footer: { text: 'Whisper TTRPG • ระบบภารกิจ' },
      timestamp: new Date().toISOString(),
    }],
  })
}

// ─── Punishment Notification ───────────────────────────────────────────────────

export interface PunishmentNotifyParams {
  targetPlayerName: string
  reason: string
  creatorName: string
  penaltyHp?: number | null
  penaltySanity?: number | null
  taskDescription?: string | null
  expiresAt?: string | null
}

export async function notifyNewPunishment(params: PunishmentNotifyParams): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_PUNISHMENT
  if (!webhookUrl) return

  const fields: NonNullable<DiscordEmbed['fields']> = []

  fields.push({ name: '👤 ผู้ถูกลงโทษ', value: params.targetPlayerName, inline: true })
  fields.push({ name: '⚖️ ผู้ออกคำตัดสิน', value: params.creatorName, inline: true })
  fields.push({ name: '📋 เหตุผล', value: params.reason, inline: false })

  const penalties: string[] = []
  if (params.penaltyHp)     penalties.push(`❤️ HP **-${Math.abs(params.penaltyHp)}**`)
  if (params.penaltySanity) penalties.push(`🧠 Sanity **-${Math.abs(params.penaltySanity)}**`)
  if (penalties.length > 0) {
    fields.push({ name: '💢 บทลงโทษ', value: penalties.join('  ·  '), inline: false })
  }

  if (params.taskDescription) {
    fields.push({ name: '📝 งานที่ต้องทำ', value: params.taskDescription, inline: false })
  }

  if (params.expiresAt) {
    const d = new Date(params.expiresAt)
    fields.push({
      name: '⏰ กำหนดชำระ',
      value: d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      inline: true,
    })
  }

  await sendDiscordNotification(webhookUrl, {
    username: 'ระบบการลงโทษ',
    embeds: [{
      title: `⚖️ คำตัดสิน — ${params.targetPlayerName}`,
      description: '> คำตัดสินได้ประกาศแล้ว จงชำระให้ครบก่อนกำหนด',
      color: 0xDC143C,
      fields,
      footer: { text: 'Whisper TTRPG • ระบบการลงโทษ' },
      timestamp: new Date().toISOString(),
    }],
  })
}
