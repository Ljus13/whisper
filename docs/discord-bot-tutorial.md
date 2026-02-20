# 🤖 Discord Bot Tutorial — Quest & Punishment Notifications

สำหรับ Whisper TTRPG System

---

## ✅ แนวทางที่แนะนำ: Discord Webhook (ง่ายที่สุด)

**ไม่จำเป็นต้องรันเซิร์ฟเวอร์แยก** — ส่ง HTTP POST จาก Next.js Server Action ได้เลย
ไม่มีค่าใช้จ่าย, ไม่ต้องมีการ host bot แยกต่างหาก

---

## STEP 1 — สร้าง Webhook ใน Discord Server

1. เปิด **Discord Server** ของคุณ
2. คลิกที่ **ช่องที่ต้องการให้แจ้งเตือน** (เช่น `#ภารกิจใหม่` หรือ `#การลงโทษ`)
3. คลิก ⚙️ **Edit Channel** (ไอคอนฟันเฟือง)
4. เลือก **Integrations** → **Webhooks**
5. คลิก **New Webhook**
6. ตั้งชื่อ เช่น `🗺️ Quest Notifier` หรือ `⚖️ Punishment Notifier`
7. คลิก **Copy Webhook URL** — เก็บ URL นี้ไว้

> 💡 แนะนำให้สร้าง **2 webhook** แยกกัน:
> - อันหนึ่งสำหรับ **ภารกิจ** (`#ควสต์และภารกิจ`)
> - อันหนึ่งสำหรับ **การลงโทษ** (`#บันทึกการลงโทษ`)

---

## STEP 2 — เพิ่ม Environment Variables

เปิดไฟล์ `.env.local` ในโปรเจกต์ แล้วเพิ่ม:

```env
# Discord Webhooks
DISCORD_WEBHOOK_QUEST=https://discord.com/api/webhooks/xxxxxxx/xxxxxxxxxxxxxxxx
DISCORD_WEBHOOK_PUNISHMENT=https://discord.com/api/webhooks/yyyyyyy/yyyyyyyyyy
```

> ⚠️ **อย่า commit** ไฟล์ `.env.local` ขึ้น Git เด็ดขาด
> ถ้า deploy บน Vercel → เพิ่มใน **Settings → Environment Variables** แทน

---

## STEP 3 — สร้าง Discord Utility ใน Next.js

สร้างไฟล์ใหม่ `src/lib/discord-notify.ts`:

```typescript
// src/lib/discord-notify.ts
// Helper สำหรับส่ง embed notification ไปยัง Discord Webhook

interface DiscordEmbed {
  title?: string
  description?: string
  color?: number        // hex color เป็นตัวเลข เช่น 0xFFD700 = ทอง
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string    // ISO 8601
  thumbnail?: { url: string }
}

interface DiscordWebhookPayload {
  username?: string
  avatar_url?: string
  content?: string
  embeds?: DiscordEmbed[]
}

/**
 * ส่ง Discord Webhook notification
 * Fire-and-forget — ไม่ block server action
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<void> {
  if (!webhookUrl) return   // ถ้า env ว่าง ข้ามได้เลย

  try {
    await Promise.race([
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ])
  } catch {
    // Fire-and-forget: ไม่ให้ notification ล้มเหลวแล้วทำให้ action พังทั้งหมด
    console.error('[Discord] Failed to send notification')
  }
}

// ─── ฟังก์ชันสำเร็จรูปสำหรับ Quest ───────────────────────────────────────────

export async function notifyNewPublicQuest(params: {
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
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_QUEST
  if (!webhookUrl) return

  const fields: DiscordEmbed['fields'] = []

  // โค้ดภารกิจ
  fields.push({ name: '🔑 รหัสภารกิจ', value: `\`${params.questCode}\``, inline: true })

  // ผู้สร้าง
  fields.push({ name: '👤 ผู้มอบภารกิจ', value: params.creatorName, inline: true })

  // สถานที่ (ถ้ามี)
  if (params.npcName || params.mapName) {
    const location = params.npcName
      ? `${params.npcName}${params.mapName ? ` *(${params.mapName})*` : ''}`
      : params.mapName || ''
    fields.push({ name: '📍 สถานที่', value: location, inline: false })
  }

  // รางวัล
  const rewards = params.rewards
  if (rewards) {
    const rewardParts: string[] = []
    if (rewards.hp)           rewardParts.push(`❤️ HP ${rewards.hp > 0 ? '+' : ''}${rewards.hp}`)
    if (rewards.sanity)       rewardParts.push(`🧠 Sanity ${rewards.sanity > 0 ? '+' : ''}${rewards.sanity}`)
    if (rewards.travel)       rewardParts.push(`👟 Travel ${rewards.travel > 0 ? '+' : ''}${rewards.travel}`)
    if (rewards.spirituality) rewardParts.push(`✨ Spirit ${rewards.spirituality > 0 ? '+' : ''}${rewards.spirituality}`)
    if (rewards.maxSanity)    rewardParts.push(`🧠⬆️ Max Sanity ${rewards.maxSanity > 0 ? '+' : ''}${rewards.maxSanity}`)
    if (rewards.maxTravel)    rewardParts.push(`👟⬆️ Max Travel ${rewards.maxTravel > 0 ? '+' : ''}${rewards.maxTravel}`)
    if (rewards.maxSpirituality) rewardParts.push(`✨⬆️ Max Spirit ${rewards.maxSpirituality > 0 ? '+' : ''}${rewards.maxSpirituality}`)
    if (rewardParts.length > 0) {
      fields.push({ name: '🎁 รางวัล', value: rewardParts.join('  |  '), inline: false })
    }
  }

  // วันหมดอายุ
  if (params.expiresAt) {
    const expiryDate = new Date(params.expiresAt)
    fields.push({
      name: '⏰ หมดอายุ',
      value: expiryDate.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      inline: true
    })
  } else {
    fields.push({ name: '⏰ อายุ', value: 'ตลอดไป', inline: true })
  }

  await sendDiscordNotification(webhookUrl, {
    username: 'ระบบภารกิจ',
    avatar_url: 'https://cdn.discordapp.com/emojis/your-quest-emoji.png', // ใส่ URL รูปได้
    embeds: [{
      title: `📜 ภารกิจใหม่: ${params.questName}`,
      description: '> มีภารกิจใหม่เปิดรับผู้กล้าแล้ว! ใช้รหัสด้านล่างเพื่อส่งหลักฐาน',
      color: 0xFFD700,   // ทอง
      fields,
      footer: { text: 'Whisper TTRPG • ระบบจัดการภารกิจ' },
      timestamp: new Date().toISOString(),
    }]
  })
}

// ─── ฟังก์ชันสำเร็จรูปสำหรับ Punishment ──────────────────────────────────────

export async function notifyNewPunishment(params: {
  targetPlayerName: string
  reason: string
  creatorName: string         // admin/dm ที่สร้าง
  penaltyType: 'hp' | 'sanity' | 'travel' | 'spirituality' | 'custom'
  penaltyAmount?: number
  taskDescription?: string    // งานที่ต้องทำ (ถ้ามี)
  expiresAt?: string | null
  isPublicPunishment?: boolean // บางครั้งอาจต้องการไม่ประกาศสาธารณะ
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_PUNISHMENT
  if (!webhookUrl) return
  if (!params.isPublicPunishment) return   // ข้ามถ้าไม่ต้องการประกาศ

  const penaltyLabels: Record<string, string> = {
    hp: '❤️ HP',
    sanity: '🧠 Sanity',
    travel: '👟 Travel',
    spirituality: '✨ Spirituality',
    custom: '⚖️ กำหนดเอง',
  }

  const fields: DiscordEmbed['fields'] = [
    { name: '👤 ผู้ถูกลงโทษ', value: params.targetPlayerName, inline: true },
    { name: '⚖️ ผู้ออกคำตัดสิน', value: params.creatorName, inline: true },
    { name: '📋 เหตุผล', value: params.reason, inline: false },
  ]

  if (params.penaltyAmount !== undefined) {
    fields.push({
      name: `${penaltyLabels[params.penaltyType]} บทลงโทษ`,
      value: `**-${params.penaltyAmount}** ${penaltyLabels[params.penaltyType]}`,
      inline: true
    })
  }

  if (params.taskDescription) {
    fields.push({ name: '📝 งานที่ต้องทำ', value: params.taskDescription, inline: false })
  }

  if (params.expiresAt) {
    const expiryDate = new Date(params.expiresAt)
    fields.push({
      name: '⏰ กำหนดชำระ',
      value: expiryDate.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      inline: true
    })
  }

  await sendDiscordNotification(webhookUrl, {
    username: 'ระบบการลงโทษ',
    embeds: [{
      title: `⚖️ คำตัดสิน — ${params.targetPlayerName}`,
      description: '> คำตัดสินได้ประกาศแล้ว จงชำระให้ครบก่อนกำหนด',
      color: 0xDC143C,   // แดง (Crimson)
      fields,
      footer: { text: 'Whisper TTRPG • ระบบการลงโทษ' },
      timestamp: new Date().toISOString(),
    }]
  })
}
```

---

## STEP 4 — เชื่อมต่อเข้ากับ Server Actions ที่มีอยู่

### 4A. แจ้งเตือนเมื่อสร้าง Quest ใหม่ (เฉพาะ `is_public = true`)

เปิด `src/app/actions/action-quest.ts` แล้วแก้ไข `generateQuestCode`:

```typescript
// เพิ่ม import ที่ด้านบนไฟล์
import { notifyNewPublicQuest } from '@/lib/discord-notify'

// ภายใน generateQuestCode — หลัง return success ให้เปลี่ยนเป็น:
  if (error) return { error: error.message }
  revalidateActionQuestPaths()

  // 🔔 Discord notification (เฉพาะ public quests)
  if (data.is_public) {
    const creatorName = await getDisplayName(supabase, user.id)
    // หา map/npc name ถ้ามี (optional enrichment)
    let mapName: string | null = null
    let npcName: string | null = null
    if (data.map_id) {
      const { data: map } = await supabase.from('maps').select('name').eq('id', data.map_id).single()
      mapName = map?.name || null
    }
    if (data.npc_token_id) {
      const { data: npc } = await supabase.from('map_tokens').select('label').eq('id', data.npc_token_id).single()
      npcName = npc?.label || null
    }
    // Fire-and-forget — ไม่ต้อง await ถ้าไม่ต้องการบล็อก
    notifyNewPublicQuest({
      questName: data.name,
      questCode: data.code,
      creatorName,
      mapName,
      npcName,
      expiresAt: data.expires_at,
      rewards: {
        hp: data.reward_hp,
        sanity: data.reward_sanity,
        travel: data.reward_travel,
        spirituality: data.reward_spirituality,
        maxSanity: data.reward_max_sanity,
        maxTravel: data.reward_max_travel,
        maxSpirituality: data.reward_max_spirituality,
      }
    }).catch(() => {})  // ไม่ให้ notification ล้มเหลวทำให้ action พัง
  }

  return { success: true, code: data.code, name: data.name, is_public: data.is_public as boolean }
```

### 4B. แจ้งเตือนเมื่อสร้าง Punishment

หา function `createPunishment` ใน `action-quest.ts` แล้วเพิ่ม:

```typescript
// เพิ่ม import ที่ด้านบน
import { notifyNewPunishment } from '@/lib/discord-notify'

// ใน createPunishment — หลัง insert สำเร็จ:
  if (punishmentError) return { error: punishmentError.message }

  // 🔔 Discord notification
  const creatorName = await getDisplayName(supabase, user.id)
  notifyNewPunishment({
    targetPlayerName: targetProfile.display_name || 'ผู้เล่น',
    reason: reason,
    creatorName,
    penaltyType: penaltyType || 'custom',
    penaltyAmount: penaltyAmount,
    taskDescription: taskDescription,
    expiresAt: expiresAt,
    isPublicPunishment: true,   // หรือเพิ่ม parameter ให้เลือกได้
  }).catch(() => {})
```

---

## STEP 5 — ทดสอบ

ทดสอบ webhook ผ่าน terminal (curl):

```bash
curl -X POST "YOUR_WEBHOOK_URL_HERE" \
  -H "Content-Type: application/json" \
  -d '{"content": "🧪 ทดสอบ webhook ใช้งานได้!"}'
```

หรือใช้ [Postman](https://www.postman.com/) / [Webhook.site](https://webhook.site) เพื่อ preview

---

## ตัวอย่าง Discord Message ที่จะได้รับ

### Quest Notification
```
🗺️ ระบบภารกิจ
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 ภารกิจใหม่: ส่งของลับไปยังหมู่บ้าน
  > มีภารกิจใหม่เปิดรับผู้กล้าแล้ว! ใช้รหัสด้านล่างเพื่อส่งหลักฐาน

  🔑 รหัสภารกิจ   │  👤 ผู้มอบภารกิจ
  `20-02-26-abcd`  │  GM สรวง

  📍 สถานที่
  ยายแก่ *(ตลาดมืดบางกอก)*

  🎁 รางวัล
  ❤️ HP +5  |  ✨ Spirit +10

  ⏰ หมดอายุ
  28 กุมภาพันธ์ 2569, 23:59

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Whisper TTRPG • ระบบจัดการภารกิจ
```

### Punishment Notification
```
⚖️ ระบบการลงโทษ
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ คำตัดสิน — สมชาย ขยันดี
  > คำตัดสินได้ประกาศแล้ว จงชำระให้ครบก่อนกำหนด

  👤 ผู้ถูกลงโทษ   │  ⚖️ ผู้ออกคำตัดสิน
  สมชาย ขยันดี     │  GM สรวง

  📋 เหตุผล
  ขาดนัดประชุมสภา 2 ครั้งติดต่อกัน

  ❤️ HP บทลงโทษ
  **-20** HP

  📝 งานที่ต้องทำ
  เขียนบันทึกการสำนึกผิด 300 คำ

  ⏰ กำหนดชำระ
  25 กุมภาพันธ์ 2569

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Whisper TTRPG • ระบบการลงโทษ
```

---

## (ขั้นสูง) ถ้าต้องการ Full Discord Bot

หากต้องการฟีเจอร์เพิ่ม เช่น `/quest` slash command, ให้ผู้เล่น query ภารกิจ, หรือ reaction roles:

### ติดตั้ง
```bash
npm install discord.js
```

### สร้าง Bot ที่ [Discord Developer Portal](https://discord.com/developers/applications)
1. **New Application** → ตั้งชื่อ
2. ไปที่ **Bot** → **Add Bot**
3. Copy **Token** → เก็บใน `.env.local` เป็น `DISCORD_BOT_TOKEN=xxx`
4. เปิด **Privileged Gateway Intents**: `Server Members Intent` + `Message Content Intent`
5. ไปที่ **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
6. Copy URL → เปิดใน browser → เชิญบอทเข้าเซิร์ฟเวอร์

### ตัวอย่าง Bot Server (`bot/index.ts`)

```typescript
// bot/index.ts — รัน separately จาก Next.js
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user?.tag}`)
})

// ฟังก์ชัน export สำหรับใช้จาก Next.js API Route
export async function sendQuestToChannel(channelId: string, questData: { name: string; code: string }) {
  const channel = await client.channels.fetch(channelId)
  if (!channel?.isTextBased()) return
  const embed = new EmbedBuilder()
    .setTitle(`📜 ภารกิจใหม่: ${questData.name}`)
    .setColor(0xFFD700)
    .addFields({ name: '🔑 รหัส', value: `\`${questData.code}\`` })
    .setTimestamp()
  await channel.send({ embeds: [embed] })
}

client.login(process.env.DISCORD_BOT_TOKEN)
```

> 💡 **แนะนำ**: สำหรับโปรเจกต์นี้ **ใช้ Webhook** (Step 1-5) ก็เพียงพอและง่ายกว่ามาก
> Full Bot เหมาะกว่าเมื่อต้องการให้ผู้เล่นส่งคำสั่งกลับมาหา System

---

## สรุปไฟล์ที่ต้องแก้ไข/สร้าง

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `.env.local` | เพิ่ม `DISCORD_WEBHOOK_QUEST` + `DISCORD_WEBHOOK_PUNISHMENT` |
| `src/lib/discord-notify.ts` | **สร้างใหม่** — utility functions |
| `src/app/actions/action-quest.ts` | เพิ่ม notify call ใน `generateQuestCode` + `createPunishment` |
| `supabase/add_quest_is_public.sql` | **รันใน Supabase** — เพิ่มคอลัมน์ `is_public` |
