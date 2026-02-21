import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { requireLinkedProfile, supabase } from '../../lib/supabase'
import { COLORS } from '../../lib/embeds'
import { config } from '../../config'

export const data = new SlashCommandBuilder()
  .setName('my-skills')
  .setDescription('ดู skills ที่คุณ unlock แล้ว (พร้อมรายละเอียดเต็ม)')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const profile = await requireLinkedProfile(interaction)
  if (!profile) return

  // ── 1. Fetch ทุกอย่างพร้อมกัน ─────────────────────────────────
  const [ppRes, gsRes] = await Promise.all([
    supabase
      .from('player_pathways')
      .select('pathway_id, sequence_id')
      .eq('player_id', profile.id)
      .not('pathway_id', 'is', null),

    supabase
      .from('granted_skills')
      .select(`
        id, title, detail, reuse_policy, cooldown_minutes, expires_at,
        times_used, last_used_at, is_active,
        effect_hp, effect_sanity, effect_travel, effect_spirituality,
        effect_max_sanity, effect_max_travel, effect_max_spirituality,
        skill:skills(id, name, description, spirit_cost)
      `)
      .eq('player_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  if (ppRes.error || gsRes.error) {
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการดึงข้อมูล Skills' })
    return
  }

  const playerPathways = ppRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grantedSkills: any[] = gsRes.data ?? []

  // ── 2. ดึง pathway skills ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pathwaySkills: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pathwayMap: Map<string, any[]> = new Map()

  if (playerPathways.length > 0) {
    const pathwayIds = playerPathways.map(pp => pp.pathway_id).filter(Boolean)

    const [skillsRes, seqRes] = await Promise.all([
      supabase
        .from('skills')
        .select('id, name, description, spirit_cost, pathway_id, sequence_id, pathway:skill_pathways(name), sequence:skill_sequences(id, seq_number, name)')
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

      pathwaySkills = skillsRes.data.filter(skill => {
        const pp = playerPathways.find(p => p.pathway_id === skill.pathway_id)
        if (!pp?.sequence_id) return false
        const playerSeqNum = playerSeqMap.get(pp.sequence_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skillSeqNum = (skill.sequence as any)?.seq_number
        if (playerSeqNum === undefined || skillSeqNum === undefined) return false
        return skillSeqNum >= playerSeqNum
      })

      // จัดกลุ่มตาม pathway
      for (const skill of pathwaySkills) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pathwayName: string = (skill.pathway as any)?.name ?? 'ไม่มีเส้นทาง'
        if (!pathwayMap.has(pathwayName)) pathwayMap.set(pathwayName, [])
        pathwayMap.get(pathwayName)!.push(skill)
      }
    }
  }

  if (pathwaySkills.length === 0 && grantedSkills.length === 0) {
    await interaction.editReply({ content: '📭 คุณยังไม่มี Skill ที่ได้รับ' })
    return
  }

  // ── 3. สร้าง Embeds ───────────────────────────────────────────
  const embeds: EmbedBuilder[] = []

  // Helper: ตัดข้อความยาว
  const trunc = (text: string | null | undefined, max: number) =>
    text ? (text.length > max ? text.slice(0, max) + '…' : text) : ''

  // Helper: แสดง effects ของ granted skill
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function formatEffects(g: any): string {
    const fx: string[] = []
    if (g.effect_hp)               fx.push(`❤️ HP ${g.effect_hp > 0 ? '+' : ''}${g.effect_hp}`)
    if (g.effect_sanity)           fx.push(`🧠 Sanity ${g.effect_sanity > 0 ? '+' : ''}${g.effect_sanity}`)
    if (g.effect_travel)           fx.push(`👟 Travel ${g.effect_travel > 0 ? '+' : ''}${g.effect_travel}`)
    if (g.effect_spirituality)     fx.push(`✨ Spirit ${g.effect_spirituality > 0 ? '+' : ''}${g.effect_spirituality}`)
    if (g.effect_max_sanity)       fx.push(`🧠 Max Sanity ${g.effect_max_sanity > 0 ? '+' : ''}${g.effect_max_sanity}`)
    if (g.effect_max_travel)       fx.push(`👟 Max Travel ${g.effect_max_travel > 0 ? '+' : ''}${g.effect_max_travel}`)
    if (g.effect_max_spirituality) fx.push(`✨ Max Spirit ${g.effect_max_spirituality > 0 ? '+' : ''}${g.effect_max_spirituality}`)
    return fx.length > 0 ? fx.join('  ') : 'ไม่มี effect'
  }

  // Helper: cooldown status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function formatAvailability(g: any): string {
    if (g.reuse_policy === 'once') {
      return g.times_used > 0 ? '🔒 ใช้แล้ว (1 ครั้ง)' : '1️⃣ ใช้ได้ 1 ครั้ง'
    }
    if (g.reuse_policy === 'cooldown' && g.last_used_at && g.cooldown_minutes) {
      const cooldownEnd = new Date(g.last_used_at)
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + g.cooldown_minutes)
      if (new Date() < cooldownEnd) {
        const remainMin = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000)
        const h = Math.floor(remainMin / 60)
        const m = remainMin % 60
        return `⏳ Cooldown: อีก ${h > 0 ? `${h}ชม. ` : ''}${m}น.`
      }
      return `✅ พร้อมใช้ (cooldown ${g.cooldown_minutes}น.)`
    }
    if (g.reuse_policy === 'cooldown') return `✅ พร้อมใช้ (cooldown ${g.cooldown_minutes ?? '?'}น.)`
    if (g.expires_at) {
      const exp = new Date(g.expires_at)
      const expired = exp < new Date()
      return expired ? '❌ หมดอายุแล้ว' : `♾️ หมดอายุ: ${exp.toLocaleDateString('th-TH')}`
    }
    return '♾️ ไม่จำกัดการใช้'
  }

  // ── Embed 1: Overview ───────────────────────────────────────
  const overviewEmbed = new EmbedBuilder()
    .setTitle(`⚔️ Skills ของ ${profile.display_name}`)
    .setColor(COLORS.primary)
    .setDescription(
      `**Pathway Skills:** ${pathwaySkills.length} สกิล จาก ${pathwayMap.size} เส้นทาง\n` +
      `**Granted Skills:** ${grantedSkills.length} สกิล\n\n` +
      `ใช้สกิลได้ที่คำสั่ง \`/use-skill\`\n` +
      `[เปิดหน้า Skills บนเว็บ](${config.webUrl}/skills)`
    )
    .setTimestamp()
  embeds.push(overviewEmbed)

  // ── Embeds สำหรับแต่ละ Pathway (max 4 embeds = สูงสุด 4 pathway) ──
  let embedCount = 0
  for (const [pathwayName, skills] of pathwayMap) {
    if (embedCount >= 4) break // Discord limit: 10 embeds/message, เก็บที่ว่างไว้ granted

    const pathwayEmbed = new EmbedBuilder()
      .setTitle(`🌟 ${pathwayName}`)
      .setColor(COLORS.dark)

    for (const skill of skills) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seqName = (skill.sequence as any)?.name ?? ''
      const fieldName = `✨ ${skill.name}  *(${skill.spirit_cost} spirit)*`
      const desc = trunc(skill.description, 200)
      const fieldValue = [
        desc ? `> ${desc}` : '> *(ไม่มีคำอธิบาย)*',
        seqName ? `📖 ลำดับ: ${seqName}` : '',
      ].filter(Boolean).join('\n') || '–'

      // Discord field limit: 25 fields/embed
      if (pathwayEmbed.data.fields && pathwayEmbed.data.fields.length >= 25) break
      pathwayEmbed.addFields({ name: fieldName.slice(0, 256), value: fieldValue.slice(0, 1024), inline: false })
    }

    embeds.push(pathwayEmbed)
    embedCount++
  }

  // ── Embeds สำหรับ Granted Skills (max 4 embeds) ──────────────
  let grantedEmbedCount = 0
  const GRANTED_PER_EMBED = 5

  for (let i = 0; i < grantedSkills.length && grantedEmbedCount < 4; i += GRANTED_PER_EMBED) {
    const chunk = grantedSkills.slice(i, i + GRANTED_PER_EMBED)
    const grantedEmbed = new EmbedBuilder()
      .setTitle(i === 0 ? '🎁 Granted Skills' : `🎁 Granted Skills (ต่อ)`)
      .setColor(0x7B2D8B)

    for (const g of chunk) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skillBase = g.skill as any
      const spiritCost = skillBase?.spirit_cost ?? 0
      const desc = trunc(g.detail || skillBase?.description, 150)

      const fieldValue = [
        desc ? `> ${desc}` : '',
        `💫 Spirit Cost: **${spiritCost}**`,
        `⚡ Effects: ${formatEffects(g)}`,
        `🔄 ${formatAvailability(g)}`,
      ].filter(Boolean).join('\n')

      const fieldName = `${g.title ?? skillBase?.name ?? '?'}`.slice(0, 256)
      grantedEmbed.addFields({ name: fieldName, value: fieldValue.slice(0, 1024), inline: false })
    }

    embeds.push(grantedEmbed)
    grantedEmbedCount++
  }

  await interaction.editReply({ embeds })
}
