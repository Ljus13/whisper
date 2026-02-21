import * as dotenv from 'dotenv'
import * as path from 'path'

// โหลด .env.local ก่อน ถ้าไม่มีให้ fallback ไป .env
const envLocalPath = path.resolve(__dirname, '../../.env.local')
const envPath = path.resolve(__dirname, '../../.env')
dotenv.config({ path: envLocalPath })
dotenv.config({ path: envPath })

export const config = {
  // ── Discord ──────────────────────────────────────────────────────
  botToken: process.env.DISCORD_BOT_TOKEN ?? '',
  clientId: process.env.DISCORD_CLIENT_ID ?? '',
  guildId: process.env.DISCORD_GUILD_ID ?? '',

  // ── Channel IDs ──────────────────────────────────────────────────
  channelApprovals: process.env.DISCORD_CHANNEL_APPROVALS ?? '',
  channelQuests: process.env.DISCORD_CHANNEL_QUESTS ?? '',
  channelPunishments: process.env.DISCORD_CHANNEL_PUNISHMENTS ?? '',
  channelRoleplay: process.env.DISCORD_CHANNEL_ROLEPLAY ?? '',
  channelSkillLogs: process.env.DISCORD_CHANNEL_SKILL_LOGS ?? '',

  // ── Supabase ─────────────────────────────────────────────────────
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',

  // ── Web App ──────────────────────────────────────────────────────
  webUrl: process.env.WEB_URL ?? 'https://whisper-one-ochre.vercel.app',
}

// Validate required env vars
const required = ['botToken', 'clientId', 'supabaseUrl', 'supabaseServiceKey'] as const
for (const key of required) {
  if (!config[key]) {
    console.error(`❌ Missing required env var: ${key}`)
    process.exit(1)
  }
}
