# 🤖 Discord Bot — Master Plan
## Whisper of the Shadow — TTRPG Management System

> **วัตถุประสงค์:** เพิ่ม Discord Bot เป็น Front-End อิสระ ทำงานคู่กับ Next.js Web App  
> **แชทอ้างอิง:** ใช้ไฟล์นี้เป็น briefing สำหรับแต่ละ Phase ในแชทใหม่  
> **อัปเดตล่าสุด:** 20 กุมภาพันธ์ 2569

---

## 📌 Context โปรเจค

- **ชื่อโปรเจค:** Whisper of the Shadow
- **Path:** `c:\Users\chain\Documents\Thai Witchcraft\My Art Work\whisper`
- **Stack เดิม:** Next.js 15 + React 19 + Supabase + TypeScript + Tailwind
- **Discord integration เดิม:** Webhook ทางเดียวเท่านั้น (`src/lib/discord-notify.ts`)
  - `DISCORD_WEBHOOK_QUEST` — แจ้งเตือน quest ใหม่ไป channel
  - `DISCORD_WEBHOOK_PUNISHMENT` — แจ้งเตือนบทลงโทษไป channel
- **Roles ในระบบ:** `player`, `admin`, `dm` (DM มีสิทธิ์สูงสุด)

### Files สำคัญที่ Bot จะต้องใช้ logic ร่วม

| File | ความสำคัญ |
|------|-----------|
| `src/app/actions/action-quest.ts` | Logic หลัก — submit/approve/reject action & quest, sleep, prayer, punishment (2661 lines) |
| `src/app/actions/players.ts` | Admin update player stats |
| `src/app/actions/skills.ts` | Skill logs, skill management |
| `src/app/actions/pathway-grants.ts` | Grant pathway, accept pathway |
| `src/app/actions/notifications.ts` | Create & broadcast notification |
| `src/app/actions/religions.ts` | Religion system |
| `src/app/actions/rest-points.ts` | Map rest points |
| `src/lib/discord-notify.ts` | Existing webhook utilities (reuse) |
| `src/lib/travel-rules.ts` | Travel cost rules per pathway |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Discord Bot                       │
│              (Node.js + discord.js v14)              │
│   bot/                                               │
│   ├── src/index.ts          (entry — login + events) │
│   ├── src/deploy-commands.ts (register slash cmds)   │
│   ├── src/commands/player/   (player slash commands) │
│   ├── src/commands/admin/    (admin slash commands)  │
│   ├── src/handlers/          (button/modal/select)   │
│   └── src/lib/supabase.ts    (shared DB client)      │
└──────────────────────┬──────────────────────────────┘
                       │ reads/writes directly
                       ▼
              ┌──────────────────┐
              │   Supabase DB    │  ← shared กับ Next.js
              │   (same DB)      │
              └──────────────────┘
                       │ realtime broadcast
                       ▼
              ┌──────────────────┐
              │  Next.js Web App │  ← ยังใช้ควบคู่กันไป
              │  (ยังคงทำงาน)    │
              └──────────────────┘
```

**หลักการสำคัญ:**
- Bot เป็น **standalone Node.js process** รันแยกจาก Next.js
- ใช้ **Supabase DB เดิมทั้งหมด** — ไม่สร้าง API ใหม่
- Web App ยังใช้งานได้ปกติ — Discord เป็น "อีก front-end หนึ่ง"
- Bot ต้อง verify ว่า Discord User link กับ Supabase user (ผ่าน `discord_user_id` column)

---

## 📦 Tech Stack ของ Bot

```json
{
  "dependencies": {
    "discord.js": "^14.x",
    "@discordjs/builders": "^1.x",
    "@discordjs/rest": "^2.x",
    "discord-api-types": "^0.37.x",
    "@supabase/supabase-js": "^2.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "ts-node": "^10.x",
    "@types/node": "^20.x"
  }
}
```

---

## 🗂️ โครงสร้างไฟล์ทั้งหมด

```
whisper/
├── src/                          ← Next.js (ไม่แตะ)
├── bot/                          ← Discord Bot (สร้างใหม่ทั้งหมด)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              (entry: login, event listeners)
│       ├── deploy-commands.ts    (register commands to Discord API)
│       ├── config.ts             (env vars, constants)
│       ├── commands/
│       │   ├── player/
│       │   │   ├── status.ts         (/status)
│       │   │   ├── submit-action.ts  (/submit-action)
│       │   │   ├── submit-quest.ts   (/submit-quest)
│       │   │   ├── sleep.ts          (/sleep)
│       │   │   ├── prayer.ts         (/prayer)
│       │   │   ├── my-skills.ts      (/my-skills)
│       │   │   └── notifications.ts  (/notifications)
│       │   └── admin/
│       │       ├── pending.ts        (/pending)
│       │       ├── approve.ts        (/approve)
│       │       ├── reject.ts         (/reject)
│       │       ├── punish.ts         (/punish)
│       │       ├── grant-pathway.ts  (/grant-pathway)
│       │       ├── update-stats.ts   (/update-stats)
│       │       ├── approve-sleep.ts  (/approve-sleep)
│       │       └── maintenance.ts    (/maintenance)
│       ├── handlers/
│       │   ├── button-handler.ts     (Approve/Reject buttons)
│       │   ├── modal-handler.ts      (Form submissions)
│       │   └── select-handler.ts     (Dropdown selections)
│       └── lib/
│           ├── supabase.ts           (Supabase client — service role)
│           ├── auth.ts               (link Discord ID → Supabase user)
│           └── embeds.ts             (Shared embed builders)
```

---

## 🔑 Environment Variables เพิ่มเติม

เพิ่มใน `.env.local` (และใน Vercel/hosting ของ bot):

```env
# ── Discord Bot ────────────────────────────────────────
DISCORD_BOT_TOKEN=              # Bot token จาก Discord Developer Portal
DISCORD_CLIENT_ID=              # Application ID
DISCORD_GUILD_ID=               # Server ID (dev mode — guild command, ไม่ต้องรอ 1 ชั่วโมง)

# ── Channel IDs (สำหรับ auto-post) ────────────────────
DISCORD_CHANNEL_APPROVALS=      # channel ที่ bot post pending submissions ให้ admin เห็น
DISCORD_CHANNEL_QUESTS=         # channel ประกาศ quest ใหม่ (เพิ่ม button)
DISCORD_CHANNEL_PUNISHMENTS=    # channel ประกาศบทลงโทษ
DISCORD_CHANNEL_ROLEPLAY=       # channel auto-post roleplay logs (Phase 4)

# ── Supabase (ใช้ service_role key เพื่อ bypass RLS) ──
# ตัวแปรเหล่านี้มีอยู่แล้ว
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=      # ใช้ service_role (ไม่ใช่ anon) เพราะ bot เป็น server-side trusted
```

### ⚠️ หมายเหตุสำคัญเรื่อง Supabase Key

Bot ใช้ **`SUPABASE_SERVICE_ROLE_KEY`** (ไม่ใช่ anon key) เพราะ:
- Bot เป็น trusted server process
- ต้อง bypass RLS สำหรับ admin operations
- การ verify user ทำในโค้ด bot เอง (ไม่ใช่ผ่าน Supabase RLS)

---

## 🔗 Discord ↔ Supabase User Linking

### ✅ ไม่ต้องทำอะไรเพิ่มในฝั่ง User

ทุกคนในระบบ **Login ผ่าน Discord OAuth แล้ว** — Discord User ID อยู่ใน Supabase แล้ว:
- `auth.users.raw_user_meta_data ->> 'provider_id'` = Discord User ID
- `auth.identities` table: `provider = 'discord'`, `provider_id` = Discord User ID

**สิ่งที่ต้องทำแค่ครั้งเดียว (migration):**
1. เพิ่ม column `discord_user_id` ใน `profiles`
2. **Backfill** ข้อมูลที่มีอยู่แล้วจาก `auth.identities`
3. **Update trigger** `handle_new_user()` ให้ดึง Discord ID มาเก็บอัตโนมัติเมื่อมี user ใหม่

หลังจากนั้น Bot lookup ผ่าน `profiles.discord_user_id` ได้ทันทีโดยไม่ต้องให้ user ทำอะไร

### ถ้า Bot พบว่า discord_user_id เป็น null (user เก่าก่อน migration / edge case):
```
❌ ไม่พบข้อมูลบัญชีในระบบ
กรุณา Login ใหม่ผ่านเว็บ เพื่ออัปเดตข้อมูลบัญชี
🔗 https://your-domain.com
```

---

## ✅ Phase 1 — Player Quick Commands

**เป้าหมาย:** ผู้เล่นทำ action ที่ใช้บ่อยที่สุดได้จาก Discord โดยไม่ต้องเปิดเว็บ

### Commands

#### `/status`
- **ใคร:** ผู้เล่นทุกคน
- **ทำอะไร:** แสดง embed สถานะตัวละครตัวเอง
- **ข้อมูลที่ดึง:** `profiles` table — `display_name`, `hp`, `max_hp`, `sanity`, `max_sanity`, `travel_points`, `max_travel_points`, `spirituality`, `max_spirituality`, `role`, `avatar_url`
- **Output:** Discord Embed พร้อม progress bar (text art)

```
❤️ HP        ████████░░  8/10
🧠 Sanity    ██████░░░░  6/10
👟 Travel    ████░░░░░░  4/10
✨ Spirit    ██████████  10/10
```

#### `/submit-action [code]`
- **ใคร:** ผู้เล่นทุกคน
- **ทำอะไร:** เปิด Modal ให้ใส่ Action Code + URL หลักฐาน (หรือแนบรูปโดยตรง)
- **Logic:** เรียก `submitActionCode()` logic เดียวกับเว็บ
- **หลังสำเร็จ:** Ephemeral reply "ส่งสำเร็จ" + bot post embed ไป `DISCORD_CHANNEL_APPROVALS` พร้อม Approve/Reject buttons

#### `/submit-quest [code]`
- **ใคร:** ผู้เล่นทุกคน
- **ทำอะไร:** เหมือน submit-action แต่เป็น Quest Code
- **Logic:** เรียก `submitQuestCode()` logic

#### `/sleep`
- **ใคร:** ผู้เล่นทุกคน
- **ทำอะไร:** เปิด Modal 2 field — Meal Image URL + Sleep Image URL
- **Logic:** เรียก `submitSleepRequest()` logic
- **Validation:** ตรวจ cooldown เหมือนเว็บ

#### `/prayer [message]`
- **ใคร:** ผู้เล่นทุกคน
- **ทำอะไร:** ส่ง prayer log ข้อความ
- **Logic:** insert ลงตาราง prayer logs

#### `/my-skills`
- **ใคร:** ผู้เล่นทุกคน
- **ทำอะไร:** แสดง skills ที่ unlock แล้วเป็น embed list
- **ข้อมูล:** join `player_skills` + `skills` + `skill_pathways`

#### `/notifications`
- **ใคร:** ผู้เล่นทุกคน
- **ทำอะไร:** แสดง 5 notifications ล่าสุดของตัวเอง (Ephemeral)
- **Logic:** `getNotifications()` จากตาราง `notifications`

#### `/link-account` (ไม่ต้องสร้างใน Bot)
- **แทนด้วย:** หน้าเว็บ Profile/Settings มี input field ให้ผู้เล่นกรอก Discord User ID เอง
- Bot แค่เช็คว่า `discord_user_id` ใน profiles ตรงกับ interaction user หรือไม่
- ถ้าไม่ตรง → reply ให้ไปกรอกบนเว็บ (จัดการโดย `requireLinkedProfile()` helper)

---

## ✅ Phase 2 — Admin Approval Flow with Buttons

**เป้าหมาย:** Admin/DM Approve/Reject submission ได้โดยตรงจาก Discord โดยไม่ต้องเปิดเว็บ

### Approval Flow

1. ผู้เล่นรัน `/submit-action` หรือ `/submit-quest`
2. Bot post embed ไปที่ `DISCORD_CHANNEL_APPROVALS` พร้อมปุ่ม:

```
┌──────────────────────────────────────────────────┐
│  📜 Action Submission — รอการอนุมัติ              │
│  👤 ผู้ส่ง: Kendrick Mervin                        │
│  🔑 Code: AC-20-02-26-abcd                        │
│  🖼️ หลักฐาน: [image URL / attached image]        │
│  ⏰ ส่งเมื่อ: 20 ก.พ. 2569 15:30                 │
├──────────────────────────────────────────────────┤
│  [✅ Approve]    [❌ Reject]    [🔗 View on Web]  │
└──────────────────────────────────────────────────┘
```

3. Admin/DM กด **Approve** → Modal popup ให้ใส่ Note (optional) → confirm → bot call approve logic
4. Admin/DM กด **Reject** → Modal popup ให้ใส่ Reason (required) → confirm → bot call reject logic
5. หลัง approve/reject → Bot **DM** ผู้เล่นแจ้งผลพร้อมรายละเอียด rewards

### Commands

#### `/pending`
- **ใคร:** Admin, DM เท่านั้น
- **ทำอะไร:** แสดง embed list ของ pending submissions ทั้งหมด (paginated)
- **Options:** `--type actions|quests|sleep|all` `--page 1`

#### `/approve [submission_id] [note]`
- **ใคร:** Admin, DM
- **ทำอะไร:** Approve submission โดยใส่ id (หรือ reference code) + note optional

#### `/reject [submission_id] [reason]`
- **ใคร:** Admin, DM
- **ทำอะไร:** Reject พร้อม reason (required)

#### `/approve-sleep [@player]`
- **ใคร:** Admin, DM
- **ทำอะไร:** Approve sleep request ของผู้เล่นที่ระบุ

### Upgrade Notification System (Phase 2)

| Event | เดิม | ใหม่ |
|-------|------|------|
| Quest ใหม่ (public) | Post embed ไป channel | + **ปุ่ม "ดูรายละเอียด"** inline |
| บทลงโทษ | Post embed ไป channel | + **DM ส่วนตัว** ไปหาผู้ถูกลงโทษ |
| Pathway granted | ❌ แค่ in-app notif | **DM** "คุณได้รับ Pathway ใหม่!" + link |
| Quest approved | ❌ แค่ in-app notif | **DM** สรุป rewards ที่ได้ |
| Action approved | ❌ แค่ in-app notif | **DM** สรุป rewards ที่ได้ |
| Sleep approved | ❌ แค่ in-app notif | **DM** + **Mention** ใน channel |

---

## ✅ Phase 3 — Admin Management Commands

**เป้าหมาย:** Admin/DM จัดการผู้เล่นและระบบได้ทั้งหมดจาก Discord

### Commands

#### `/punish [@player] [reason]`
- **ใคร:** Admin, DM
- **ทำอะไร:** เปิด Modal ให้กรอก:
  - Reason (required)
  - Quest ที่ต้องทำเพื่อล้างโทษ (optional select menu)
  - Duration (วัน/ชั่วโมง)
- **Logic:** insert ลงตาราง `punishments` + broadcast + DM ผู้ถูกลงโทษ

#### `/grant-pathway [@player]`
- **ใคร:** Admin, DM
- **ทำอะไร:** แสดง Select Menu ให้เลือก pathway หลายรายการ → grant
- **Logic:** `grantPathwayChoices()` + notify ผู้เล่น

#### `/update-stats [@player]`
- **ใคร:** Admin, DM
- **ทำอะไร:** เปิด Modal ให้แก้ไข:
  - HP delta (+/-)
  - Sanity delta (+/-)
  - Travel points delta
  - Max values
- **Logic:** `adminUpdatePlayer()` + notify ผู้เล่น

#### `/maintenance [on|off]`
- **ใคร:** DM เท่านั้น
- **ทำอะไร:** Toggle maintenance mode
- **Logic:** `toggleMaintenance()` จาก `src/app/actions/maintenance.ts`

#### `/player-info [@player]`
- **ใคร:** Admin, DM
- **ทำอะไร:** ดูข้อมูล full ของผู้เล่น (embed) รวม skills, pathway, punishments

---

## ✅ Phase 4 — Advanced Features (Optional)

### `/create-quest`
- DM สร้าง Quest ใหม่ผ่าน Discord Multi-Step Modal
- Step 1: ชื่อ Quest, Description, Code
- Step 2: Rewards (HP/Sanity/Travel/Spirit)
- Step 3: Location (map, NPC), Expiry, is_public

### `/create-action`
- Admin/DM สร้าง Action Code ใหม่

### `/map [map_name]`
- Render แผนที่เป็น image แล้วส่ง
- ใช้ `@napi-rs/canvas` หรือ `Puppeteer` screenshot จาก web component

### Auto-post Roleplay Logs
- เมื่อผู้เล่น submit roleplay log → bot auto-post ไป `DISCORD_CHANNEL_ROLEPLAY`

### `/my-map`
- แสดงตำแหน่งปัจจุบันของผู้เล่นในแผนที่ (embed text version)

---

## 🚦 ลำดับการทำงาน (Phased Roadmap)

```
Phase 0 — Setup (เริ่มก่อนทุก Phase)
  ├── รัน SQL migration เพิ่ม discord_user_id ใน profiles
  ├── สร้าง Discord Application + Bot ใน Dev Portal
  ├── สร้าง bot/ directory + package.json + tsconfig.json
  ├── สร้าง bot/src/index.ts (entry point)
  ├── สร้าง bot/src/lib/supabase.ts (service role client)
  └── สร้าง bot/src/deploy-commands.ts

Phase 1 — Player Commands (สัปดาห์ 1-2)
  ├── /link-account (ต้องทำก่อนที่ 1)
  ├── /status
  ├── /my-skills
  ├── /notifications
  ├── /submit-action (Modal)
  └── /submit-quest (Modal)

Phase 2 — Approval Flow + DM Notifications (สัปดาห์ 3-4)
  ├── Auto-post to #approvals channel เมื่อมี submission
  ├── Approve/Reject buttons + Modal
  ├── /pending command
  ├── /approve + /reject commands
  ├── DM notifications ทุก event
  └── /sleep command

Phase 3 — Admin Commands (สัปดาห์ 5)
  ├── /punish
  ├── /grant-pathway
  ├── /update-stats
  ├── /approve-sleep
  ├── /player-info
  └── /maintenance

Phase 4 — Advanced (Optional)
  ├── /create-quest
  ├── /create-action
  ├── /map rendering
  └── Auto-post roleplay logs
```

---

## 📋 SQL Migration ที่ต้องรันก่อน Phase 1

```sql
-- ไฟล์: supabase/add_discord_integration.sql

-- ── Step 1: เพิ่ม column ──────────────────────────────────────
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS discord_user_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_discord_user_id
ON profiles(discord_user_id);

-- ── Step 2: Backfill ผู้เล่นที่มีอยู่แล้ว ─────────────────────
-- ดึง Discord user ID จาก auth.identities (ทุกคน login ผ่าน Discord อยู่แล้ว)
UPDATE public.profiles p
SET discord_user_id = i.provider_id
FROM auth.identities i
WHERE i.user_id = p.id
  AND i.provider = 'discord'
  AND p.discord_user_id IS NULL;

-- ── Step 3: Update trigger ให้ auto-populate ─────────────────
-- แทนที่ handle_new_user() เดิม ให้ดึง discord_user_id อัตโนมัติ
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role, discord_user_id)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'user_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    ),
    'player',
    -- ดึง Discord user ID โดย detect จาก field เฉพาะของ Discord
    -- 'discriminator' มีเฉพาะ Discord OAuth เท่านั้น (Google ไม่มี)
    CASE
      WHEN NEW.raw_user_meta_data ->> 'discriminator' IS NOT NULL
      THEN NEW.raw_user_meta_data ->> 'provider_id'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

> **หมายเหตุ:** Trigger นี้แทนที่ `handle_new_user()` เดิมใน `schema.sql` — ไม่ได้เพิ่มใหม่  
> Step 2 (backfill) รันครั้งเดียว ทุกคนที่ login ผ่าน Discord อยู่แล้วจะได้รับ `discord_user_id` ทันที

---

## 🔧 bot/src/lib/supabase.ts (Template)

```typescript
import { createClient } from '@supabase/supabase-js'
import { ChatInputCommandInteraction } from 'discord.js'

// Bot ใช้ service_role key — trusted server process, bypass RLS
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

/**
 * Lookup Supabase profile by Discord user ID
 * Returns null ถ้าไม่ได้ link account (ยังไม่ได้กรอก discord_user_id บนเว็บ)
 */
export async function getProfileByDiscordId(discordUserId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('discord_user_id', discordUserId)
    .single()

  if (error) return null
  return data
}

/**
 * Guard helper — ใช้ใน command ทุกตัว
 * ถ้าไม่ได้ link → reply แล้ว return null ให้ caller หยุดทำงาน
 */
export async function requireLinkedProfile(
  interaction: ChatInputCommandInteraction
) {
  const profile = await getProfileByDiscordId(interaction.user.id)
  if (!profile) {
    await interaction.editReply(
      '❌ คุณยังไม่ได้เชื่อมต่อบัญชี\n' +
      'กรุณาเข้าเว็บ → Profile → ใส่ Discord User ID ของคุณ\n' +
      `🔗 ${process.env.WEB_URL ?? 'https://your-domain.com/dashboard'}`
    )
    return null
  }
  return profile
}

export function isStaff(role: string) {
  return role === 'admin' || role === 'dm'
}

export function isDM(role: string) {
  return role === 'dm'
}
```

**Pattern การใช้งานใน command ทุกตัว:**
```typescript
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })
  const profile = await requireLinkedProfile(interaction)
  if (!profile) return  // หยุดทันที — requireLinkedProfile จัดการ reply แล้ว
  // ... logic ต่อ
}
```

---

## 🔧 bot/src/index.ts (Template)

```typescript
import { Client, GatewayIntentBits, Collection } from 'discord.js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '../../.env.local' }) // path จาก bot/ ไป root

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
})

// Command collection
const commands = new Collection<string, any>()

// Load commands
const commandFolders = ['player', 'admin']
for (const folder of commandFolders) {
  const commandPath = path.join(__dirname, 'commands', folder)
  const commandFiles = fs.readdirSync(commandPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'))
  for (const file of commandFiles) {
    const command = require(path.join(commandPath, file))
    if (command.data && command.execute) {
      commands.set(command.data.name, command)
    }
  }
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user?.tag}`)
})

// Slash command handler
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName)
    if (!command) return
    try {
      await command.execute(interaction)
    } catch (error) {
      console.error(error)
      await interaction.reply({ content: 'เกิดข้อผิดพลาด กรุณาลองใหม่', ephemeral: true })
    }
  }

  // Button handler
  if (interaction.isButton()) {
    const { handleButton } = require('./handlers/button-handler')
    await handleButton(interaction)
  }

  // Modal handler
  if (interaction.isModalSubmit()) {
    const { handleModal } = require('./handlers/modal-handler')
    await handleModal(interaction)
  }

  // Select menu handler
  if (interaction.isStringSelectMenu()) {
    const { handleSelect } = require('./handlers/select-handler')
    await handleSelect(interaction)
  }
})

client.login(process.env.DISCORD_BOT_TOKEN)
```

---

## 🔧 Command Template (ตัวอย่าง /status)

```typescript
// bot/src/commands/player/status.ts
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js'
import { getProfileByDiscordId } from '../../lib/supabase'

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('ดูสถานะตัวละครของคุณ')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const profile = await getProfileByDiscordId(interaction.user.id)

  if (!profile) {
    return interaction.editReply(
      '❌ คุณยังไม่ได้เชื่อมต่อ Discord กับบัญชีในระบบ\nใช้คำสั่ง `/link-account` ก่อน'
    )
  }

  // Text-art progress bar
  const bar = (val: number, max: number, len = 10) => {
    const filled = Math.round((val / max) * len)
    return '█'.repeat(filled) + '░'.repeat(len - filled)
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎭 ${profile.display_name}`)
    .setThumbnail(profile.avatar_url || '')
    .setColor(0x8B4513)
    .addFields(
      {
        name: '❤️ HP',
        value: `${bar(profile.hp, profile.max_hp)}  **${profile.hp}/${profile.max_hp}**`,
        inline: false,
      },
      {
        name: '🧠 Sanity',
        value: `${bar(profile.sanity, profile.max_sanity)}  **${profile.sanity}/${profile.max_sanity}**`,
        inline: false,
      },
      {
        name: '👟 Travel Points',
        value: `${bar(profile.travel_points, profile.max_travel_points)}  **${profile.travel_points}/${profile.max_travel_points}**`,
        inline: false,
      },
      {
        name: '✨ Spirituality',
        value: `${bar(profile.spirituality, profile.max_spirituality)}  **${profile.spirituality}/${profile.max_spirituality}**`,
        inline: false,
      },
    )
    .setFooter({ text: `Role: ${profile.role}` })
    .setTimestamp()

  return interaction.editReply({ embeds: [embed] })
}
```

---

## 📝 Briefing สำหรับแต่ละ Phase (คัดลอกไปใช้เริ่มแชทใหม่)

### 🔹 Phase 0 Briefing (Setup)

```
โปรเจค: Whisper of the Shadow TTRPG Management System
Path: c:\Users\chain\Documents\Thai Witchcraft\My Art Work\whisper
Stack เดิม: Next.js 15 + Supabase + TypeScript
หมายเหตุสำคัญ: ทุกคน Login ผ่าน Discord OAuth อยู่แล้ว
  → discord_user_id ดึงจาก auth.identities ได้อัตโนมัติ
  → ไม่ต้องให้ user กรอกอะไรเพิ่ม

งาน Phase 0:
1. สร้าง bot/ directory ใน root ของโปรเจค
2. สร้าง bot/package.json + bot/tsconfig.json
3. สร้าง bot/src/index.ts (entry point)
4. สร้าง bot/src/lib/supabase.ts (service role client + requireLinkedProfile helper)
5. สร้าง bot/src/deploy-commands.ts
6. รัน SQL: supabase/add_discord_integration.sql
   - เพิ่ม discord_user_id column
   - Backfill จาก auth.identities (ทุก user ที่มีอยู่ได้รับทันที)
   - Update trigger handle_new_user() ให้ auto-populate

ไม่ต้องสร้าง /link-account command และไม่ต้องแก้ web app
อ้างอิง template ทั้งหมดจากไฟล์: docs/discord-bot-plan.md
```

### 🔹 Phase 1 Briefing (Player Commands)

```
โปรเจค: Whisper of the Shadow
อ้างอิง: docs/discord-bot-plan.md

งาน Phase 1 (หลัง Phase 0 เสร็จ):
สร้าง slash commands สำหรับผู้เล่น:
- /status  
- /my-skills
- /notifications
- /submit-action (พร้อม Modal)
- /submit-quest (พร้อม Modal)
- /sleep (พร้อม Modal)

ทุก command เริ่มต้นด้วย:
  await interaction.deferReply({ ephemeral: true })
  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

DB: ใช้ Supabase service_role key (bot/src/lib/supabase.ts)
ผู้เล่นต้องเข้าเว็บและกรอก Discord User ID ในหน้า Profile ก่อน จึงจะใช้ bot ได้
รายละเอียดข้อมูลและ logic อยู่ใน docs/discord-bot-plan.md
```

### 🔹 Phase 2 Briefing (Approval Flow)

```
โปรเจค: Whisper of the Shadow
อ้างอิง: docs/discord-bot-plan.md

งาน Phase 2 (หลัง Phase 1 เสร็จ):
1. Auto-post embed ไปที่ DISCORD_CHANNEL_APPROVALS เมื่อมี submission
2. Approve/Reject buttons + Modal สำหรับ note/reason
3. bot/src/handlers/button-handler.ts
4. bot/src/handlers/modal-handler.ts
5. /pending command
6. /approve command
7. /reject command
8. DM notifications ไปหาผู้เล่นเมื่อ approved/rejected
```

### 🔹 Phase 3 Briefing (Admin Commands)

```
โปรเจค: Whisper of the Shadow
อ้างอิง: docs/discord-bot-plan.md

งาน Phase 3 (หลัง Phase 2 เสร็จ):
สร้าง admin/ commands:
- /punish [@player] — Modal form + DM ผู้ถูกลงโทษ
- /grant-pathway [@player] — Select menu เลือก pathway
- /update-stats [@player] — Modal แก้ HP/Sanity/Travel
- /approve-sleep [@player]
- /player-info [@player]
- /maintenance [on|off] (DM only)

ตรวจ role ก่อนทุกคำสั่ง: isStaff() หรือ isDM()
```

---

## ✅ Checklist รวม

### Phase 0
- [ ] สร้าง Discord Application ใน [Discord Developer Portal](https://discord.com/developers/applications)
- [ ] Enable bot, copy BOT TOKEN
- [ ] เพิ่ม bot เข้า server ด้วย scope: `bot`, `applications.commands`
- [ ] Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`, `Attach Files`, `Send Messages in Threads`
- [ ] รัน SQL migration `supabase/add_discord_integration.sql`
  - [ ] เพิ่ม `discord_user_id` column
  - [ ] Backfill ผู้เล่นที่มีอยู่แล้วจาก `auth.identities`
  - [ ] Update trigger `handle_new_user()`
  - [ ] ตรวจสอบว่า `profiles.discord_user_id` ไม่เป็น null สำหรับ user ทุกคนแล้ว
- [ ] สร้าง `bot/` directory structure
- [ ] เพิ่ม env vars ทั้งหมด

### Phase 1
- [ ] ทดสอบ `requireLinkedProfile()` — reply ถูกต้องเมื่อยังไม่ได้ link
- [ ] `/status` แสดงข้อมูลถูกต้อง
- [ ] `/my-skills` list skills ได้
- [ ] `/notifications` แสดง 5 รายการล่าสุด
- [ ] `/submit-action` Modal + insert ลง DB + post to #approvals
- [ ] `/submit-quest` Modal + insert ลง DB + post to #approvals
- [ ] `/sleep` Modal + validation cooldown

### Phase 2
- [ ] Auto-post embed พร้อม Approve/Reject buttons
- [ ] Approve button → Modal note → approve logic → DM ผู้เล่น
- [ ] Reject button → Modal reason → reject logic → DM ผู้เล่น
- [ ] `/pending` list submissions
- [ ] DM notifications ครบทุก event

### Phase 3
- [ ] `/punish` Modal + DM ผู้ถูกลงโทษ
- [ ] `/grant-pathway` Select menu
- [ ] `/update-stats` Modal
- [ ] `/approve-sleep`
- [ ] `/player-info`
- [ ] `/maintenance` (DM only)

---

*ไฟล์นี้เป็น Master Plan สำหรับ Discord Bot integration ของโปรเจค Whisper of the Shadow*  
*อัปเดตแต่ละ Phase ใน Checklist ด้านบนเมื่อเสร็จ*
