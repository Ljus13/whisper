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
      description: '> มีภารกิจใหม่ปรากฏแล้ว! ใช้รหัสด้านล่างเพื่อส่งหลักฐาน',
      color: 0xFFD700,
      fields,
      footer: { text: 'Whisper of the Shadow • ระบบภารกิจ' },
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
  /** Discord User IDs สำหรับ @mention — ดึงจาก profiles.discord_user_id */
  discordUserIds?: (string | null | undefined)[]
}

export async function notifyNewPunishment(params: PunishmentNotifyParams): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_PUNISHMENT
  if (!webhookUrl) return

  const fields: NonNullable<DiscordEmbed['fields']> = []

  fields.push({ name: '👤 ผู้ร่วมอีเวนท์', value: params.targetPlayerName, inline: true })
  fields.push({ name: '⚖️ ผู้กำหนดอีเวนท์', value: params.creatorName, inline: true })
  fields.push({ name: '📋 เหตุผล', value: params.reason, inline: false })

  const penalties: string[] = []
  if (params.penaltyHp)     penalties.push(`❤️ HP **-${Math.abs(params.penaltyHp)}**`)
  if (params.penaltySanity) penalties.push(`🧠 Sanity **-${Math.abs(params.penaltySanity)}**`)
  if (penalties.length > 0) {
    fields.push({ name: '💢 อีเวนท์', value: penalties.join('  ·  '), inline: false })
  }

  if (params.taskDescription) {
    fields.push({ name: '📝 งานที่ต้องทำ', value: params.taskDescription, inline: false })
  }

  if (params.expiresAt) {
    const d = new Date(params.expiresAt)
    fields.push({
      name: '⏰ กำหนด',
      value: d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      inline: true,
    })
  }

  // สร้าง @mention string — mention ใน content เท่านั้นที่ Discord จะ ping จริง
  const mentionContent = params.discordUserIds
    ?.filter((id): id is string => !!id)
    .map(id => `<@${id}>`)
    .join(' ') || undefined

  await sendDiscordNotification(webhookUrl, {
    username: 'ระบบอีเวนท์',
    content: mentionContent,
    embeds: [{
      title: `⚖️ อีเวนท์ — ${params.targetPlayerName}`,
      description: '> มีอีเวนท์ โปรดเคลียร์ภารกิจให้ครบทุกรายการ',
      color: 0xDC143C,
      fields,
      footer: { text: 'Whisper of the Shadow • ระบบการลงโทษ' },
      timestamp: new Date().toISOString(),
    }],
  })
}

// ─── Pathway Notification ─────────────────────────────────────────────────────

export interface PathwayNotifyParams {
  playerName: string
  pathwayName: string
}

export async function notifyPathwayAccepted(params: PathwayNotifyParams): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_PATHWAY
  if (!webhookUrl) return

  await sendDiscordNotification(webhookUrl, {
    username: 'เส้นทางโอสถ',
    embeds: [{
      title: `🌿 เลือกเส้นทางแล้ว`,
      description: `> **${params.playerName}** ได้เลือกเส้นทาง **${params.pathwayName}** แล้ว!`,
      color: 0x7C3AED,
      fields: [
        { name: '🧭 ผู้เล่น', value: params.playerName, inline: true },
        { name: '🌟 เส้นทางที่เลือก', value: params.pathwayName, inline: true },
      ],
      footer: { text: 'Whisper of the Shadow • ระบบเส้นทาง' },
      timestamp: new Date().toISOString(),
    }],
  })
}

// ─── Quest Updated Notification ───────────────────────────────────────────────

export async function notifyQuestUpdated(params: QuestNotifyParams): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_QUEST
  if (!webhookUrl) return

  const fields: NonNullable<DiscordEmbed['fields']> = []

  fields.push({ name: '🔑 รหัสภารกิจ', value: `\`${params.questCode}\``, inline: true })
  fields.push({ name: '✏️ แก้ไขโดย', value: params.creatorName, inline: true })

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
      fields.push({ name: '🎁 รางวัล (ใหม่)', value: parts.join('  ·  '), inline: false })
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
      title: `✏️ แก้ไขภารกิจ: ${params.questName}`,
      description: '> รายละเอียดภารกิจนี้ถูกอัปเดตแล้ว ตรวจสอบรายละเอียดใหม่',
      color: 0x4169E1,
      fields,
      footer: { text: 'Whisper of the Shadow • ระบบภารกิจ' },
      timestamp: new Date().toISOString(),
    }],
  })
}

// ─── Punishment Updated Notification ─────────────────────────────────────────

export async function notifyPunishmentUpdated(params: PunishmentNotifyParams): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_PUNISHMENT
  if (!webhookUrl) return

  const mentionContent = params.discordUserIds
    ?.filter((id): id is string => !!id)
    .map(id => `<@${id}>`)
    .join(' ') || undefined

  const fields: NonNullable<DiscordEmbed['fields']> = []

  fields.push({ name: '👤 ผู้ร่วมอีเวนท์', value: params.targetPlayerName, inline: true })
  fields.push({ name: '✏️ แก้ไขโดย', value: params.creatorName, inline: true })
  fields.push({ name: '📋 รายละเอียด', value: params.reason, inline: false })

  const penalties: string[] = []
  if (params.penaltyHp)     penalties.push(`❤️ HP **-${Math.abs(params.penaltyHp)}**`)
  if (params.penaltySanity) penalties.push(`🧠 Sanity **-${Math.abs(params.penaltySanity)}**`)
  if (penalties.length > 0) {
    fields.push({ name: '💢 อีเวนท์', value: penalties.join('  ·  '), inline: false })
  }

  if (params.taskDescription) {
    fields.push({ name: '📝 งานที่ต้องทำ', value: params.taskDescription, inline: false })
  }

  if (params.expiresAt) {
    const d = new Date(params.expiresAt)
    fields.push({
      name: '⏰ กำหนด',
      value: d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      inline: true,
    })
  }

  await sendDiscordNotification(webhookUrl, {
    username: 'ระบบอีเวนท์',
    content: mentionContent,
    embeds: [{
      title: `📝 แก้ไขอีเวนท์ — ${params.targetPlayerName}`,
      description: '> อีเวนท์ถูกแก้ไขแล้ว โปรดตรวจสอบรายละเอียดใหม่',
      color: 0xFF8C00,
      fields,
      footer: { text: 'Whisper of the Shadow • ระบบการลงโทษ' },
      timestamp: new Date().toISOString(),
    }],
  })
}
