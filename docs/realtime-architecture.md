# 🚀 Real-time Architecture Template

## 📋 สถาปัตยกรรมระบบ Real-time แบบ Complete

### 🏗️ Core Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client A       │    │   Client B       │    │   Client C       │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ UI State    │ │    │ │ UI State    │ │    │ │ UI State    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌─────────┴─────────┐
                    │ Supabase Channel │
                    │   (Real-time)     │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Server Actions   │
                    │    (Backend)       │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │   PostgreSQL      │
                    │   (Database)      │
                    └───────────────────┘
```

---

## 🎯 หลักการทำงาน

### 1. **Dual Communication Strategy**

#### **Broadcast Channel (Primary)**
- ✅ ส่งข้อมูลตรงไปยัง client ทุกตัว
- ✅ เร็วทันที (instant)
- ✅ ใช้สำหรับ update ที่ต้องการความเร็ว

#### **Postgres Changes (Backup)**
- ✅ สำรองถ้า broadcast หลุด
- ✅ รับประกันความสมบูรณ์
- ✅ ใช้สำหรับ sync ข้อมูลเต็ม

---

### 2. **Optimistic UI Pattern**

```typescript
// 🎯 Client Pattern
const pendingUpdates = new Map()

// 1. อัพเดต UI ทันที (Optimistic)
pendingUpdates.set(id, newData)
setState(prev => updateState(prev, id, newData))

// 2. เรียก Server Action
const result = await serverAction(id, newData)

// 3. จัดการผลลัพธ์
if (result.success) {
  pendingUpdates.delete(id) // สำเร็จ
} else {
  // Rollback UI ถ้าเกิด error
  setState(prev => rollbackState(prev, id, originalData))
}
```

---

## 📁 File Structure Template

```
src/
├── actions/
│   ├── realtime/
│   │   ├── server-actions.ts      # Server Actions
│   │   └── broadcast-helpers.ts    # Broadcast Utilities
│   └── [other-actions].ts
├── components/
│   ├── realtime/
│   │   ├── RealtimeProvider.tsx   # Context Provider
│   │   ├── useRealtime.ts         # Custom Hook
│   │   └── RealtimeChannel.tsx    # Channel Component
│   └── [other-components].tsx
└── hooks/
    ├── useOptimisticUpdate.ts     # Optimistic Pattern
    └── useRealtimeSync.ts         # Realtime Sync
```

---

## 🔧 Implementation Template

### 1. Server Action (`actions/realtime/server-actions.ts`)

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { broadcastUpdate } from './broadcast-helpers'

// 🎯 Template สำหรับ Action ที่ต้องการ Real-time
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

// 🎯 Example Usage
export async function updateTokenPosition(
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
    'map_updates',
    'token_moved'
  )
}
```

### 2. Broadcast Helper (`actions/realtime/broadcast-helpers.ts`)

```typescript
import { createClient } from '@/lib/supabase/server'

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

export async function broadcastToMap(
  mapId: string,
  eventName: string,
  payload: any
) {
  return broadcastUpdate(`map_${mapId}`, eventName, payload)
}

export async function broadcastToUser(
  userId: string,
  eventName: string,
  payload: any
) {
  return broadcastUpdate(`user_${userId}`, eventName, payload)
}
```

### 3. Realtime Hook (`hooks/useRealtimeSync.ts`)

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface RealtimeEvent<T = any> {
  event: string
  payload: T
  timestamp: string
}

export function useRealtimeSync<T>(
  channelName: string,
  tableName: string,
  filter?: string,
  initialData?: T[]
) {
  const [data, setData] = useState<T[]>(initialData || [])
  const [connected, setConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // 🎯 Create Channel
    const channel = supabase
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: '*' }, handleBroadcast)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: tableName,
        filter: filter 
      }, handleDatabaseChange)
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [channelName, tableName, filter])

  const handleBroadcast = (event: any) => {
    console.log('Broadcast received:', event)
    // ปรับตามความต้องการของแต่ละ event
    switch (event.event) {
      case 'updated':
        setData(prev => updateItem(prev, event.payload))
        break
      case 'created':
        setData(prev => [...prev, event.payload])
        break
      case 'deleted':
        setData(prev => prev.filter(item => item.id !== event.payload.id))
        break
    }
  }

  const handleDatabaseChange = (payload: any) => {
    console.log('Database change:', payload)
    // Refresh full data เมื่อมีการเปลี่ยนแปลงใน DB
    // หรือ handle specific events
    switch (payload.eventType) {
      case 'INSERT':
        setData(prev => [...prev, payload.new])
        break
      case 'UPDATE':
        setData(prev => updateItem(prev, payload.new))
        break
      case 'DELETE':
        setData(prev => prev.filter(item => item.id !== payload.old.id))
        break
    }
  }

  const updateItem = (items: T[], updated: T): T[] => {
    return items.map(item => 
      (item as any).id === (updated as any).id ? updated : item
    )
  }

  return { data, setData, connected }
}
```

### 4. Optimistic Update Hook (`hooks/useOptimisticUpdate.ts`)

```typescript
'use client'

import { useState, useCallback } from 'react'
import { startTransition } from 'react'

export function useOptimisticUpdate<T extends { id: string }>(
  initialData: T[],
  updateFn: (id: string, data: Partial<T>) => Promise<{ success: boolean; data?: T; error?: string }>
) {
  const [data, setData] = useState<T[]>(initialData)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const optimisticUpdate = useCallback(async (id: string, updateData: Partial<T>) => {
    // 1. หาข้อมูลเดิม
    const originalItem = data.find(item => item.id === id)
    if (!originalItem) return

    // 2. อัพเดต UI ทันที (Optimistic)
    const optimisticData = { ...originalItem, ...updateData }
    
    startTransition(() => {
      setData(prev => prev.map(item => 
        item.id === id ? optimisticData : item
      ))
      setPending(prev => new Set(prev).add(id))
      setErrors(prev => {
        const newErrors = new Map(prev)
        newErrors.delete(id)
        return newErrors
      })
    })

    // 3. เรียก Server Action
    try {
      const result = await updateFn(id, updateData)
      
      if (result.success && result.data) {
        // 4. อัพเดตด้วยข้อมูลจริงจาก server
        startTransition(() => {
          setData(prev => prev.map(item => 
            item.id === id ? result.data! : item
          ))
          setPending(prev => {
            const newPending = new Set(prev)
            newPending.delete(id)
            return newPending
          })
        })
      } else {
        // 5. Rollback ถ้าเกิด error
        throw new Error(result.error || 'Update failed')
      }
    } catch (error: any) {
      // 6. Rollback UI
      startTransition(() => {
        setData(prev => prev.map(item => 
          item.id === id ? originalItem : item
        ))
        setPending(prev => {
          const newPending = new Set(prev)
          newPending.delete(id)
          return newPending
        })
        setErrors(prev => new Map(prev).set(id, error.message))
      })
    }
  }, [data, updateFn])

  return {
    data,
    optimisticUpdate,
    pending,
    errors,
    isLoading: pending.size > 0
  }
}
```

### 5. Realtime Provider (`components/realtime/RealtimeProvider.tsx`)

```typescript
'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

interface RealtimeContextType {
  tokens: any[]
  setTokens: (tokens: any[]) => void
  connected: boolean
}

const RealtimeContext = createContext<RealtimeContextType | null>(null)

export function RealtimeProvider({ 
  children, 
  mapId 
}: { 
  children: ReactNode
  mapId: string 
}) {
  const { data: tokens, setData: setTokens, connected } = useRealtimeSync(
    `map_${mapId}`,
    'map_tokens',
    `map_id=eq.${mapId}`
  )

  return (
    <RealtimeContext.Provider value={{ tokens, setTokens, connected }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider')
  }
  return context
}
```

---

## 🎯 Usage Examples

### Example 1: Token Movement System

```typescript
// Server Action
export async function moveToken(tokenId: string, x: number, y: number) {
  return updateWithRealtime(
    'map_tokens',
    tokenId,
    { position_x: x, position_y: y },
    `map_${getCurrentMapId()}`,
    'token_moved'
  )
}

// Client Component
function TokenComponent({ token }: { token: any }) {
  const { optimisticUpdate, pending } = useOptimisticUpdate(
    [token],
    moveToken
  )

  const handleMove = async (newX: number, newY: number) => {
    await optimisticUpdate(token.id, { 
      position_x: newX, 
      position_y: newY 
    })
  }

  return (
    <div 
      className={`token ${pending.has(token.id) ? 'pending' : ''}`}
      onClick={() => handleMove(token.position_x + 1, token.position_y)}
    >
      {token.name}
    </div>
  )
}
```

### Example 2: Chat System

```typescript
// Server Action
export async function sendMessage(message: string, channelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      content: message,
      channel_id: channelId,
      user_id: user!.id
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Broadcast to channel
  await broadcastUpdate(`chat_${channelId}`, 'new_message', data)

  return { success: true, data }
}

// Client Hook
function useChat(channelId: string) {
  return useRealtimeSync(
    `chat_${channelId}`,
    'messages',
    `channel_id=eq.${channelId}`
  )
}
```

---

## 🚀 Best Practices

### 1. **Performance**
- ✅ ใช้ Broadcast สำหรับ update ที่ต้องการความเร็ว
- ✅ ใช้ Postgres Changes สำหรับ sync ข้อมูลเต็ม
- ✅ จำกัด payload ใน broadcast (< 1KB)
- ✅ ใช้ optimistic updates สำหรับ UX ที่ดีขึ้น

### 2. **Reliability**
- ✅ มี backup channel (postgres changes)
- ✅ Handle connection failures gracefully
- ✅ Implement retry logic สำหรับ critical updates
- ✅ Log errors แต่ไม่ทำให้ system crash

### 3. **Security**
- ✅ Validate ข้อมูลบน server
- ✅ ใช้ RLS policies เพื่อปกป้องข้อมูล
- ✅ Sanitize broadcast payloads
- ✅ Rate limit critical operations

### 4. **Scalability**
- ✅ ใช้ channel naming ที่มีโครงสร้างชัดเจน
- ✅ Partition users ตาม map/room/channel
- ✅ Monitor connection counts
- ✅ Implement connection pooling

---

## 🔧 Migration Guide

### Step 1: Setup Infrastructure
```bash
# 1. สร้างไฟล์ template
mkdir src/actions/realtime
mkdir src/components/realtime
mkdir src/hooks

# 2. คัดลอก template files
cp realtime-architecture.md docs/
```

### Step 2: Implement Base Components
```typescript
// 1. สร้าง base server actions
// 2. สร้าง broadcast helpers
// 3. สร้าง realtime hooks
// 4. สร้าง provider components
```

### Step 3: Migrate Existing Features
```typescript
// จาก .select('*') ไปเป็น specific columns
// เพิ่ม broadcast logic ใน server actions
// ใช้ optimistic updates ใน client components
// เพิ่ม realtime subscriptions
```

### Step 4: Testing & Monitoring
```typescript
// ทดสอบ connection stability
// ทดสอบ optimistic rollback
// ทดสอบ broadcast delivery
// ทดสอบ performance impact
```

---

## 📊 Performance Metrics

| Metric | Target | Tool |
|--------|--------|------|
| Latency | < 100ms | Browser DevTools |
| Connection Success | > 99% | Supabase Dashboard |
| Broadcast Delivery | > 95% | Custom Monitoring |
| UI Responsiveness | < 16ms | React Profiler |
| Memory Usage | < 50MB | Chrome DevTools |

---

## 🎯 Quick Start Checklist

- [ ] สร้าง realtime directory structure
- [ ] คัดลอก server action templates
- [ ] คัดลอก client hook templates
- [ ] ตั้งค่า Supabase Realtime
- [ ] ทดสอบ basic broadcast
- [ ] ทดสอบ optimistic updates
- [ ] ทดสอบ postgres changes backup
- [ ] Implement error handling
- [ ] Add monitoring & logging
- [ ] Performance testing

---

🎉 **Ready to build amazing real-time experiences!**
