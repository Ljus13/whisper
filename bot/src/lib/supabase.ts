import { createClient } from '@supabase/supabase-js'
import { ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import { config } from '../config'

// Bot ใช้ service_role key — trusted server process, bypass RLS
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: 'player' | 'admin' | 'dm'
  discord_user_id: string | null
  hp: number
  sanity: number
  max_sanity: number
  travel_points: number
  max_travel_points: number
  spirituality: number
  max_spirituality: number
  potion_digest_progress: number
  religion: { name_th: string } | null
}

export type PlayerPathway = {
  pathway: { name: string } | null
  sequence: { name: string; seq_number: number } | null
}

/**
 * Lookup Supabase profile โดยใช้ Discord user ID
 * คืน null ถ้ายังไม่ได้กรอก discord_user_id บนเว็บ
 */
export async function getProfileByDiscordId(discordUserId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role, discord_user_id, hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality, potion_digest_progress, religion:religions!religion_id(name_th)')
    .eq('discord_user_id', discordUserId)
    .single()

  if (error || !data) return null
  return data as unknown as Profile
}

export async function getPlayerPathway(profileId: string): Promise<PlayerPathway | null> {
  const { data } = await supabase
    .from('player_pathways')
    .select('pathway:skill_pathways(name), sequence:skill_sequences(name, seq_number)')
    .eq('player_id', profileId)
    .maybeSingle()
  if (!data) return null
  return data as unknown as PlayerPathway
}

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction

/**
 * Guard helper — ใช้ใน command ทุกตัว
 * ถ้าไม่ได้ link → reply แล้ว return null ให้ caller หยุดทำงาน
 */
export async function requireLinkedProfile(interaction: AnyInteraction): Promise<Profile | null> {
  const profile = await getProfileByDiscordId(interaction.user.id)
  if (!profile) {
    const msg = [
      '❌ **ไม่พบบัญชีของคุณในระบบ**',
      '',
      'กรุณาเข้าเว็บและกรอก Discord User ID ของคุณในหน้า Profile',
      `🔗 ${config.webUrl}/dashboard`,
      '',
      '> Discord User ID ของคุณคือ: `' + interaction.user.id + '`',
    ].join('\n')
    await interaction.editReply({ content: msg })
    return null
  }
  return profile
}

/**
 * Guard helper สำหรับ Admin / DM
 */
export async function requireStaffProfile(interaction: AnyInteraction): Promise<Profile | null> {
  const profile = await requireLinkedProfile(interaction)
  if (!profile) return null
  if (profile.role !== 'admin' && profile.role !== 'dm') {
    await interaction.editReply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะ Admin / DM เท่านั้น' })
    return null
  }
  return profile
}

/**
 * Guard helper สำหรับ DM เท่านั้น
 */
export async function requireDMProfile(interaction: AnyInteraction): Promise<Profile | null> {
  const profile = await requireLinkedProfile(interaction)
  if (!profile) return null
  if (profile.role !== 'dm') {
    await interaction.editReply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะ Dungeon Master เท่านั้น' })
    return null
  }
  return profile
}

export function isStaff(role: string): boolean {
  return role === 'admin' || role === 'dm'
}

export function isDM(role: string): boolean {
  return role === 'dm'
}
