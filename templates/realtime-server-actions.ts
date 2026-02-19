/**
 * 🚀 Real-time Server Actions Template
 * 
 * คัดลอกไปใช้ในโปรเจคใหม่เพื่อสร้างระบบ Real-time
 * 
 * Usage:
 * 1. คัดลอกไฟล์นี้ไป `src/actions/realtime/server-actions.ts`
 * 2. ปรับแต่งตามความต้องการ
 * 3. Import และใช้ใน components
 */

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// 🎯 CORE REAL-TIME FUNCTIONS
// ============================================================================

/**
 * ฟังก์ชันหลักสำหรับการอัพเดตข้อมูลแบบ Real-time
 * 
 * @param table ชื่อตารางใน database
 * @param id ID ของรายการที่จะอัพเดต
 * @param data ข้อมูลที่จะอัพเดต
 * @param channelName ชื่อ channel สำหรับ broadcast
 * @param eventName ชื่อ event สำหรับ broadcast
 * @returns { success: boolean, data?: any, error?: string }
 */
export async function updateWithRealtime<T>(
  table: string,
  id: string,
  data: Partial<T>,
  channelName: string = 'global',
  eventName: string = 'updated'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  try {
    // 1. Validate & Update Database
    const { error, data: result } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // 2. Broadcast to all clients
    await broadcastUpdate(channelName, eventName, {
      id,
      ...data,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    })

    return { success: true, data: result }
  } catch (error: any) {
    return { error: error.message }
  }
}

/**
 * ฟังก์ชันสำหรับสร้างรายการใหม่แบบ Real-time
 */
export async function createWithRealtime<T>(
  table: string,
  data: Omit<T, 'id' | 'created_at' | 'updated_at'>,
  channelName: string = 'global',
  eventName: string = 'created'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  try {
    const { error, data: result } = await supabase
      .from(table)
      .insert({ ...data, created_by: user.id })
      .select()
      .single()

    if (error) throw error

    await broadcastUpdate(channelName, eventName, {
      ...result,
      created_by: user.id
    })

    return { success: true, data: result }
  } catch (error: any) {
    return { error: error.message }
  }
}

/**
 * ฟังก์ชันสำหรับลบรายการแบบ Real-time
 */
export async function deleteWithRealtime(
  table: string,
  id: string,
  channelName: string = 'global',
  eventName: string = 'deleted'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  try {
    // ดึงข้อมูลก่อนลบเพื่อ broadcast
    const { data: existing } = await supabase
      .from(table)
      .select()
      .eq('id', id)
      .single()

    if (!existing) return { error: 'Item not found' }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    if (error) throw error

    await broadcastUpdate(channelName, eventName, {
      id,
      deleted_by: user.id,
      deleted_at: new Date().toISOString()
    })

    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

// ============================================================================
// 📡 BROADCAST HELPERS
// ============================================================================

/**
 * ส่ง broadcast ไปยัง channel ทั่วไป
 */
export async function broadcastUpdate(
  channelName: string,
  eventName: string,
  payload: any
) {
  const supabase = await createClient()
  
  try {
    await supabase.channel(channelName).send({
      type: 'broadcast',
      event: eventName,
      payload
    })
  } catch (error) {
    console.error('Broadcast failed:', error)
    // ไม่ throw error เพราะ broadcast ไม่ควรทำให้ action ล้มเหลว
  }
}

/**
 * ส่ง broadcast ไปยัง map ที่ระบุ
 */
export async function broadcastToMap(
  mapId: string,
  eventName: string,
  payload: any
) {
  return broadcastUpdate(`map_${mapId}`, eventName, payload)
}

/**
 * ส่ง broadcast ไปยัง user ที่ระบุ
 */
export async function broadcastToUser(
  userId: string,
  eventName: string,
  payload: any
) {
  return broadcastUpdate(`user_${userId}`, eventName, payload)
}

/**
 * ส่ง broadcast ไปยัง chat channel
 */
export async function broadcastToChat(
  chatId: string,
  eventName: string,
  payload: any
) {
  return broadcastUpdate(`chat_${chatId}`, eventName, payload)
}

/**
 * ส่ง broadcast ไปยัง game session
 */
export async function broadcastToGame(
  gameId: string,
  eventName: string,
  payload: any
) {
  return broadcastUpdate(`game_${gameId}`, eventName, payload)
}

// ============================================================================
// 🎮 EXAMPLE IMPLEMENTATIONS
// ============================================================================

/**
 * Example: ย้ายตัวละครในแผนที่
 */
export async function moveToken(
  tokenId: string,
  x: number,
  y: number,
  mapId?: string
) {
  const updateData: any = { position_x: x, position_y: y }
  if (mapId) updateData.map_id = mapId

  return updateWithRealtime(
    'map_tokens',
    tokenId,
    updateData,
    mapId ? `map_${mapId}` : 'global',
    'token_moved'
  )
}

/**
 * Example: อัพเดตข้อมูลผู้เล่น
 */
export async function updatePlayerStats(
  userId: string,
  stats: {
    hp?: number
    sanity?: number
    travel_points?: number
    spirituality?: number
  }
) {
  return updateWithRealtime(
    'profiles',
    userId,
    stats,
    `user_${userId}`,
    'stats_updated'
  )
}

/**
 * Example: ส่งข้อความใน chat
 */
export async function sendMessage(
  content: string,
  channelId: string,
  messageType: 'text' | 'system' | 'action' = 'text'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        content,
        channel_id: channelId,
        user_id: user.id,
        message_type: messageType
      })
      .select(`
        *,
        user:profiles(id, display_name, avatar_url)
      `)
      .single()

    if (error) throw error

    await broadcastToChat(channelId, 'new_message', data)

    return { success: true, data }
  } catch (error: any) {
    return { error: error.message }
  }
}

/**
 * Example: อัพเดต game state
 */
export async function updateGameState(
  gameId: string,
  gameState: {
    status?: 'waiting' | 'playing' | 'paused' | 'finished'
    current_turn?: string
    round_number?: number
    scores?: Record<string, number>
  }
) {
  return updateWithRealtime(
    'games',
    gameId,
    gameState,
    `game_${gameId}`,
    'state_updated'
  )
}

/**
 * Example: สร้าง NPC ใหม่
 */
export async function createNpc(
  mapId: string,
  npcData: {
    name: string
    position_x: number
    position_y: number
    npc_type: string
    image_url?: string
  }
) {
  return createWithRealtime(
    'map_tokens',
    {
      ...npcData,
      map_id: mapId,
      token_type: 'npc'
    },
    `map_${mapId}`,
    'npc_added'
  )
}

/**
 * Example: ลบ token จากแผนที่
 */
export async function removeToken(
  tokenId: string,
  mapId: string
) {
  return deleteWithRealtime(
    'map_tokens',
    tokenId,
    `map_${mapId}`,
    'token_removed'
  )
}

// ============================================================================
// 🔧 UTILITY FUNCTIONS
// ============================================================================

/**
 * ตรวจสอบว่า user มีสิทธิ์ใน map หรือไม่
 */
export async function checkMapPermission(
  userId: string,
  mapId: string,
  action: 'read' | 'write' | 'admin' = 'read'
): Promise<boolean> {
  const supabase = await createClient()
  
  // Logic สำหรับตรวจสอบ permission ตามระบบของคุณ
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  
  if (action === 'admin') return isAdmin
  if (action === 'write') return isAdmin || true // ปรับตาม logic
  
  return true
}

/**
 * คำนวณค่าใช้จ่ายสำหรับการเคลื่อนที่
 */
export function calculateMoveCost(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  useSpirit: boolean = false
): number {
  const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2))
  const baseCost = Math.ceil(distance / 10) // 1 cost ต่อ 10 units
  return useSpirit ? baseCost * 2 : baseCost // Spirit ใช้ 2x cost
}

/**
 * ตรวจสอบว่าตำแหน่งอยู่ใน locked zone หรือไม่
 */
export function checkLockedZone(
  x: number,
  y: number,
  zones: Array<{
    zone_x: number
    zone_y: number
    zone_width: number
    zone_height: number
    allowed_user_ids?: string[]
  }>,
  userId: string
): { allowed: boolean; message?: string } {
  for (const zone of zones) {
    const inZone =
      x >= zone.zone_x &&
      x <= zone.zone_x + zone.zone_width &&
      y >= zone.zone_y &&
      y <= zone.zone_y + zone.zone_height

    if (inZone) {
      const allowed = zone.allowed_user_ids?.includes(userId) ?? false
      return {
        allowed,
        message: allowed ? undefined : 'พื้นที่นี้ถูกล็อค'
      }
    }
  }
  return { allowed: true }
}

// ============================================================================
// 🎯 QUICK START GUIDE
// ============================================================================

/*
🚀 วิธีใช้งาน:

1. คัดลอกไฟล์นี้ไป `src/actions/realtime/server-actions.ts`

2. ใน component ที่ต้องการ:
```typescript
import { moveToken, updatePlayerStats } from '@/actions/realtime/server-actions'

// ใน client component
const handleMove = async () => {
  const result = await moveToken(tokenId, newX, newY, mapId)
  if (result.success) {
    console.log('Token moved!')
  }
}
```

3. ใน client component ใช้ realtime hook:
```typescript
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

function MapComponent({ mapId }: { mapId: string }) {
  const { data: tokens, connected } = useRealtimeSync(
    `map_${mapId}`,
    'map_tokens',
    `map_id=eq.${mapId}`
  )

  return (
    <div>
      <div>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      {tokens.map(token => (
        <div key={token.id}>{token.name}</div>
      ))}
    </div>
  )
}
```

4. อย่าลืม setup Supabase Realtime ใน database!

🎉 เสร็จแล้ว! คุณพร้อมใช้งานระบบ Real-time แล้ว!
*/
