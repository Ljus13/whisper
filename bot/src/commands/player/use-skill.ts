import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
} from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS } from '../../lib/embeds'
import { config } from '../../config'
import { client } from '../../lib/client'

export const data = new SlashCommandBuilder()
  .setName('use-skill')
  .setDescription('ใช้สกิลของคุณ')

// ─────────────────────────────────────────────────────────────
//  /use-skill  → แสดง select menu ให้เลือกสกิล
// ─────────────────────────────────────────────────────────────
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  // ── Fetch pathway skills ──────────────────────────────────────
  const ppRes = await supabase
    .from('player_pathways')
    .select('pathway_id, sequence_id')
    .eq('player_id', profile.id)
    .not('pathway_id', 'is', null)

  // ── Fetch granted skills ──────────────────────────────────────
  const gsRes = await supabase
    .from('granted_skills')
    .select('id, title, reuse_policy, cooldown_minutes, last_used_at, times_used, expires_at, skill:skills(id, name, spirit_cost)')
    .eq('player_id', profile.id)
    .eq('is_active', true)

  const playerPathways = ppRes.data ?? []

  // ── กรอง pathway skills ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pathwaySkillOptions: any[] = []

  if (playerPathways.length > 0) {
    const pathwayIds = playerPathways.map(pp => pp.pathway_id).filter(Boolean)
    const [skillsRes, seqRes] = await Promise.all([
      supabase
        .from('skills')
        .select('id, name, spirit_cost, pathway_id, sequence_id, sequence:skill_sequences(id, seq_number)')
        .in('pathway_id', pathwayIds),
      supabase
        .from('skill_sequences')
        .select('id, seq_number')
        .in('id', playerPathways.map(pp => pp.sequence_id).filter(Boolean)),
    ])

    if (!skillsRes.error && skillsRes.data) {
      const playerSeqMap = new Map<string, number>(
        (seqRes.data ?? []).map(s => [s.id, s.seq_number])
      )
      pathwaySkillOptions = skillsRes.data.filter(skill => {
        const pp = playerPathways.find(p => p.pathway_id === skill.pathway_id)
        if (!pp?.sequence_id) return false
        const playerSeqNum = playerSeqMap.get(pp.sequence_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skillSeqNum = (skill.sequence as any)?.seq_number
        if (playerSeqNum === undefined || skillSeqNum === undefined) return false
        return skillSeqNum >= playerSeqNum
      })
    }
  }

  // ── กรอง granted skills ที่ยังใช้ได้ ─────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grantedUsable = (gsRes.data ?? []).filter((g: any) => {
    if (g.reuse_policy === 'once' && g.times_used > 0) return false
    if (g.expires_at && new Date(g.expires_at) < new Date()) return false
    if (g.reuse_policy === 'cooldown' && g.last_used_at && g.cooldown_minutes) {
      const end = new Date(g.last_used_at)
      end.setMinutes(end.getMinutes() + g.cooldown_minutes)
      if (new Date() < end) return false
    }
    return true
  })

  if (pathwaySkillOptions.length === 0 && grantedUsable.length === 0) {
    await interaction.editReply({ content: '📭 ไม่มีสกิลที่พร้อมใช้งานในขณะนี้' })
    return
  }

  // ── รวมรายการ, limit 25 (Discord max) ────────────────────────
  const options: StringSelectMenuOptionBuilder[] = []

  for (const skill of pathwaySkillOptions.slice(0, 13)) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${skill.name}`.slice(0, 100))
        .setDescription(`✨ Spirit: ${skill.spirit_cost}`)
        .setValue(`pathway:${skill.id}`)
        .setEmoji('⚔️')
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const g of grantedUsable.slice(0, 12)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spiritCost = (g.skill as any)?.spirit_cost ?? 0
    const icon = g.reuse_policy === 'unlimited' ? '♾️' : g.reuse_policy === 'cooldown' ? '⏳' : '1️⃣'
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${g.title}`.slice(0, 100))
        .setDescription(`${icon} Spirit: ${spiritCost}`)
        .setValue(`granted:${g.id}`)
        .setEmoji('🎁')
    )
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('select_use_skill')
    .setPlaceholder('เลือกสกิลที่ต้องการใช้')
    .addOptions(options)

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)

  await interaction.editReply({
    content: `⚔️ **เลือกสกิลที่ต้องการใช้**\n✨ Spirit ปัจจุบัน: **${profile.spirituality}/${profile.max_spirituality}**`,
    components: [row],
  })
}

// ─────────────────────────────────────────────────────────────
//  select_use_skill  → แสดง Modal ให้ใส่ success rate
// ─────────────────────────────────────────────────────────────
export async function handleUseSkillSelect(interaction: StringSelectMenuInteraction) {
  const selected = interaction.values[0] // e.g. "pathway:uuid" or "granted:uuid"

  const modal = new ModalBuilder()
    .setCustomId(`modal_use_skill_${selected}`)
    .setTitle('ใช้สกิล 🎲')

  const rateInput = new TextInputBuilder()
    .setCustomId('success_rate')
    .setLabel('Success Rate (1-20)')
    .setPlaceholder('ใส่ตัวเลข 1-20 ตามที่ DM กำหนด')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2)

  const noteInput = new TextInputBuilder()
    .setCustomId('note')
    .setLabel('หมายเหตุ (ไม่บังคับ)')
    .setPlaceholder('บริบท roleplay หรือรายละเอียดเพิ่มเติม')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(rateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput),
  )

  await interaction.showModal(modal)
}

// ─────────────────────────────────────────────────────────────
//  modal_use_skill_*  → ประมวลผลการใช้สกิล
// ─────────────────────────────────────────────────────────────
export async function handleUseSkillModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  // Parse customId: modal_use_skill_pathway:uuid หรือ modal_use_skill_granted:uuid
  const suffix = interaction.customId.replace('modal_use_skill_', '')
  const [type, id] = suffix.split(':')

  const rawRate = interaction.fields.getTextInputValue('success_rate')
  const note = interaction.fields.getTextInputValue('note') || null
  const successRate = parseInt(rawRate, 10)

  if (!Number.isFinite(successRate) || successRate < 1 || successRate > 20) {
    await interaction.editReply({ content: '❌ Success Rate ต้องเป็นตัวเลข 1-20' })
    return
  }

  // ── Roll dice ────────────────────────────────────────────────
  const roll = Math.floor(Math.random() * 20) + 1
  const isSuccess = roll >= successRate

  if (type === 'pathway') {
    await castPathwaySkill(interaction, profile, id, successRate, roll, isSuccess, note)
  } else if (type === 'granted') {
    await castGrantedSkillBot(interaction, profile, id, successRate, roll, isSuccess, note)
  } else {
    await interaction.editReply({ content: '❌ ไม่รู้จักประเภทสกิลนี้' })
  }
}

// ─────────────────────────────────────────────────────────────
//  Pathway Skill Logic (port จาก castSkill)
// ─────────────────────────────────────────────────────────────
async function castPathwaySkill(
  interaction: ModalSubmitInteraction,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any,
  skillId: string,
  successRate: number,
  roll: number,
  isSuccess: boolean,
  note: string | null
) {
  // 1) Fetch skill
  const { data: skill } = await supabase
    .from('skills')
    .select('id, name, description, spirit_cost, pathway_id, sequence_id')
    .eq('id', skillId)
    .single()

  if (!skill) { await interaction.editReply({ content: '❌ ไม่พบสกิล' }); return }

  // 2) Check spirit
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('spirituality, max_spirituality')
    .eq('id', profile.id)
    .single()

  if (!currentProfile) { await interaction.editReply({ content: '❌ ไม่พบโปรไฟล์' }); return }

  if (currentProfile.spirituality < skill.spirit_cost) {
    await interaction.editReply({
      content: `❌ พลังวิญญาณไม่เพียงพอ (ต้องการ **${skill.spirit_cost}** แต่มี **${currentProfile.spirituality}**)`,
    })
    return
  }

  // 3) Check pathway access
  const { data: pp } = await supabase
    .from('player_pathways')
    .select('id, sequence_id')
    .eq('player_id', profile.id)
    .eq('pathway_id', skill.pathway_id)
    .single()

  if (!pp?.sequence_id) { await interaction.editReply({ content: '❌ คุณไม่มีสิทธิ์ใช้สกิลในเส้นทางนี้' }); return }

  const [playerSeqRes, skillSeqRes] = await Promise.all([
    supabase.from('skill_sequences').select('seq_number').eq('id', pp.sequence_id).single(),
    supabase.from('skill_sequences').select('seq_number').eq('id', skill.sequence_id).single(),
  ])

  if (!playerSeqRes.data || !skillSeqRes.data) { await interaction.editReply({ content: '❌ ข้อมูลลำดับผิดพลาด' }); return }

  if (skillSeqRes.data.seq_number < playerSeqRes.data.seq_number) {
    await interaction.editReply({ content: `❌ ลำดับของคุณยังไม่ถึง (ต้องการลำดับ ${skillSeqRes.data.seq_number} หรือต่ำกว่า)` })
    return
  }

  // 4) Deduct spirit
  const newSpirit = currentProfile.spirituality - skill.spirit_cost
  await supabase.from('profiles').update({ spirituality: newSpirit }).eq('id', profile.id)

  // 5) Reference code
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const uidSuffix = profile.id.replace(/-/g, '').slice(-4).toUpperCase()
  const outcomeCode = isSuccess ? 'S' : 'F'
  const referenceCode = `SKL-${uidSuffix}${dd}${mm}${yyyy}-T${successRate}-R${roll}-${outcomeCode}`

  // 6) Log
  await supabase.from('skill_usage_logs').insert({
    player_id: profile.id,
    skill_id: skillId,
    spirit_cost: skill.spirit_cost,
    reference_code: referenceCode,
    note: note,
    success_rate: successRate,
    roll: roll,
    outcome: isSuccess ? 'success' : 'fail',
  })

  await replySkillResult(interaction, {
    skillName: skill.name,
    description: skill.description,
    spiritBefore: currentProfile.spirituality,
    spiritAfter: newSpirit,
    maxSpirit: currentProfile.max_spirituality,
    spiritCost: skill.spirit_cost,
    successRate,
    roll,
    isSuccess,
    referenceCode,
    effects: null,
    playerName: profile.display_name ?? interaction.user.username,
    playerAvatar: profile.avatar_url ?? interaction.user.displayAvatarURL(),
    note: note,
  })
}

// ─────────────────────────────────────────────────────────────
//  Granted Skill Logic (port จาก useGrantedSkill)
// ─────────────────────────────────────────────────────────────
async function castGrantedSkillBot(
  interaction: ModalSubmitInteraction,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any,
  grantedSkillId: string,
  successRate: number,
  roll: number,
  isSuccess: boolean,
  note: string | null
) {
  // 1) Fetch granted skill
  const { data: gs } = await supabase
    .from('granted_skills')
    .select('*')
    .eq('id', grantedSkillId)
    .eq('player_id', profile.id)
    .single()

  if (!gs || !gs.is_active) { await interaction.editReply({ content: '❌ ไม่พบ Granted Skill หรือถูกปิดใช้งานแล้ว' }); return }

  // 2) Check expiration
  if (gs.expires_at && new Date(gs.expires_at) < new Date()) {
    await supabase.from('granted_skills').update({ is_active: false }).eq('id', gs.id)
    await interaction.editReply({ content: '❌ สกิลนี้หมดอายุแล้ว' })
    return
  }

  // 3) Check reuse policy
  if (gs.reuse_policy === 'once' && gs.times_used > 0) {
    await interaction.editReply({ content: '❌ สกิลนี้ใช้ได้ครั้งเดียวและถูกใช้แล้ว' })
    return
  }
  if (gs.reuse_policy === 'cooldown' && gs.last_used_at && gs.cooldown_minutes) {
    const cooldownEnd = new Date(gs.last_used_at)
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + gs.cooldown_minutes)
    if (new Date() < cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000)
      await interaction.editReply({ content: `❌ ติด Cooldown อีก ${remaining} นาที` })
      return
    }
  }

  // 4) Fetch skill info
  const { data: skill } = await supabase
    .from('skills')
    .select('id, name, description, spirit_cost')
    .eq('id', gs.skill_id)
    .single()

  if (!skill) { await interaction.editReply({ content: '❌ ไม่พบข้อมูลสกิล' }); return }

  // 5) Check spirit & fetch current stats
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality, potion_digest_progress')
    .eq('id', profile.id)
    .single()

  if (!currentProfile) { await interaction.editReply({ content: '❌ ไม่พบโปรไฟล์' }); return }

  if (currentProfile.spirituality < skill.spirit_cost) {
    await interaction.editReply({
      content: `❌ พลังวิญญาณไม่เพียงพอ (ต้องการ **${skill.spirit_cost}** แต่มี **${currentProfile.spirituality}**)`,
    })
    return
  }

  // 6) Apply effects
  const spiritAfterCost = currentProfile.spirituality - skill.spirit_cost
  const updates: Record<string, number> = { spirituality: spiritAfterCost }
  if (gs.effect_hp !== 0)               updates.hp = Math.max(0, currentProfile.hp + gs.effect_hp)
  if (gs.effect_sanity !== 0)           updates.sanity = Math.max(0, Math.min(currentProfile.max_sanity + (gs.effect_max_sanity || 0), currentProfile.sanity + gs.effect_sanity))
  if (gs.effect_max_sanity !== 0)       updates.max_sanity = Math.max(0, currentProfile.max_sanity + gs.effect_max_sanity)
  if (gs.effect_travel !== 0)           updates.travel_points = Math.max(0, currentProfile.travel_points + gs.effect_travel)
  if (gs.effect_max_travel !== 0)       updates.max_travel_points = Math.max(0, currentProfile.max_travel_points + gs.effect_max_travel)
  if (gs.effect_spirituality !== 0)     updates.spirituality = Math.max(0, spiritAfterCost + gs.effect_spirituality)
  if (gs.effect_max_spirituality !== 0) updates.max_spirituality = Math.max(0, currentProfile.max_spirituality + gs.effect_max_spirituality)
  if (gs.effect_potion_digest !== 0)    updates.potion_digest_progress = Math.max(0, Math.min(100, (currentProfile.potion_digest_progress ?? 0) + gs.effect_potion_digest))

  const { error: updateErr } = await supabase.from('profiles').update(updates).eq('id', profile.id)
  if (updateErr) { await interaction.editReply({ content: `❌ ${updateErr.message}` }); return }

  // 7) Update usage tracking
  await supabase.from('granted_skills').update({
    times_used: gs.times_used + 1,
    last_used_at: new Date().toISOString(),
    is_active: gs.reuse_policy === 'once' ? false : gs.is_active,
  }).eq('id', gs.id)

  // 8) Reference code
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const uidSuffix = profile.id.replace(/-/g, '').slice(-4).toUpperCase()
  const outcomeCode = isSuccess ? 'S' : 'F'
  const referenceCode = `GS-${uidSuffix}${dd}${mm}${yyyy}-T${successRate}-R${roll}-${outcomeCode}`

  // 9) Log
  await supabase.from('granted_skill_logs').insert({
    granted_skill_id: gs.id,
    player_id: profile.id,
    skill_id: gs.skill_id,
    granted_by: profile.id,
    action: 'use',
    title: gs.title,
    reference_code: referenceCode,
    note: [
      `Roll: ${roll} / ต้องการ: ${successRate} → ${isSuccess ? 'สำเร็จ' : 'พลาด'}`,
      note ? `หมายเหตุ: ${note}` : null,
    ].filter(Boolean).join(' | '),
    effects_json: {
      outcome: isSuccess ? 'success' : 'fail',
      success_rate: successRate,
      roll: roll,
      spirit_cost: skill.spirit_cost,
    },
  })

  // Collect effects summary
  const effectLines: string[] = []
  if (gs.effect_hp !== 0)               effectLines.push(`❤️ HP ${gs.effect_hp > 0 ? '+' : ''}${gs.effect_hp}`)
  if (gs.effect_sanity !== 0)           effectLines.push(`🧠 Sanity ${gs.effect_sanity > 0 ? '+' : ''}${gs.effect_sanity}`)
  if (gs.effect_travel !== 0)           effectLines.push(`👟 Travel ${gs.effect_travel > 0 ? '+' : ''}${gs.effect_travel}`)
  if (gs.effect_spirituality !== 0)     effectLines.push(`✨ Spirit ${gs.effect_spirituality > 0 ? '+' : ''}${gs.effect_spirituality}`)
  if (gs.effect_max_sanity !== 0)       effectLines.push(`🧠 Max Sanity ${gs.effect_max_sanity > 0 ? '+' : ''}${gs.effect_max_sanity}`)
  if (gs.effect_max_travel !== 0)       effectLines.push(`👟 Max Travel ${gs.effect_max_travel > 0 ? '+' : ''}${gs.effect_max_travel}`)
  if (gs.effect_max_spirituality !== 0) effectLines.push(`✨ Max Spirit ${gs.effect_max_spirituality > 0 ? '+' : ''}${gs.effect_max_spirituality}`)

  await replySkillResult(interaction, {
    skillName: gs.title,
    description: gs.detail ?? skill.description,
    spiritBefore: currentProfile.spirituality,
    spiritAfter: updates.spirituality ?? spiritAfterCost,
    maxSpirit: currentProfile.max_spirituality,
    spiritCost: skill.spirit_cost,
    successRate,
    roll,
    isSuccess,
    referenceCode,
    effects: effectLines.length > 0 ? effectLines : null,
    playerName: profile.display_name ?? interaction.user.username,
    playerAvatar: profile.avatar_url ?? interaction.user.displayAvatarURL(),
    note: note,
  })
}

// ─────────────────────────────────────────────────────────────
//  Helper: สร้าง embed ผลการใช้สกิล
// ─────────────────────────────────────────────────────────────
async function replySkillResult(
  interaction: ModalSubmitInteraction,
  opts: {
    skillName: string
    description: string | null
    spiritBefore: number
    spiritAfter: number
    maxSpirit: number
    spiritCost: number
    successRate: number
    roll: number
    isSuccess: boolean
    referenceCode: string
    effects: string[] | null
    playerName: string
    playerAvatar: string | null
    note: string | null
  }
) {
  const bar = (val: number, max: number, len = 10) => {
    if (max <= 0) return '░'.repeat(len)
    const filled = Math.round((val / max) * len)
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, len - filled))
  }

  const embed = new EmbedBuilder()
    .setTitle(`${opts.isSuccess ? '✅' : '❌'} ${opts.skillName}`)
    .setColor(opts.isSuccess ? COLORS.success : COLORS.danger)

  if (opts.description) {
    embed.setDescription(`> ${opts.description.slice(0, 300)}`)
  }

  embed.addFields(
    {
      name: '🎲 ผลการ Roll',
      value: `Roll: **${opts.roll}** / ต้องการ: **${opts.successRate}** → ${opts.isSuccess ? '**สำเร็จ!** 🎉' : '**พลาด**'}`,
      inline: false,
    },
    {
      name: '✨ Spirit',
      value: `${bar(opts.spiritAfter, opts.maxSpirit)}  **${opts.spiritAfter}/${opts.maxSpirit}** *(เสียไป ${opts.spiritCost})*`,
      inline: false,
    },
  )

  if (opts.effects && opts.effects.length > 0) {
    embed.addFields({
      name: '⚡ Effects ที่เกิดขึ้น',
      value: opts.effects.join('\n'),
      inline: false,
    })
  }

  embed.addFields({
    name: '📋 Reference Code',
    value: `\`${opts.referenceCode}\``,
    inline: false,
  })

  embed.setTimestamp()

  await interaction.editReply({ embeds: [embed] })

  // ── โพสต์ไปยัง skill log channel (ถ้าตั้ง config ไว้) ──────────
  if (config.channelSkillLogs) {
    try {
      const channel = await client.channels.fetch(config.channelSkillLogs)
      if (channel && channel instanceof TextChannel) {
        const bar = (val: number, max: number, len = 8) => {
          if (max <= 0) return '░'.repeat(len)
          const filled = Math.max(0, Math.min(len, Math.round((val / max) * len)))
          return '█'.repeat(filled) + '░'.repeat(len - filled)
        }
        const logEmbed = new EmbedBuilder()
          .setAuthor({
            name: opts.playerName,
            iconURL: opts.playerAvatar ?? undefined,
          })
          .setTitle(`${opts.isSuccess ? '✅' : '❌'} ${opts.skillName}`)
          .setColor(opts.isSuccess ? COLORS.success : COLORS.danger)

        if (opts.description) {
          logEmbed.setDescription(`> ${opts.description.slice(0, 300)}`)
        }

        logEmbed.addFields(
          {
            name: '🎲 Roll',
            value: `**${opts.roll}** / ต้องการ **${opts.successRate}** → ${opts.isSuccess ? 'สำเร็จ 🎉' : 'พลาด'}`,
            inline: true,
          },
          {
            name: '✨ Spirit',
            value: `${bar(opts.spiritAfter, opts.maxSpirit)} **${opts.spiritAfter}/${opts.maxSpirit}** *(-${opts.spiritCost})*`,
            inline: true,
          },
        )
        if (opts.effects && opts.effects.length > 0) {
          logEmbed.addFields({ name: '⚡ Effects', value: opts.effects.join('  '), inline: false })
        }
        if (opts.note) {
          logEmbed.addFields({ name: '📝 หมายเหตุ', value: opts.note, inline: false })
        }
        logEmbed.addFields({ name: '📋 Ref', value: `\`${opts.referenceCode}\``, inline: false })
        logEmbed.setTimestamp()
        await channel.send({ embeds: [logEmbed] })
      }
    } catch (err) {
      console.error('[use-skill] Failed to post to skill log channel:', err)
    }
  }
}
