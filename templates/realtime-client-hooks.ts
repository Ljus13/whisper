/**
 * 🚀 Real-time Client Hooks Template
 * 
 * คัดลอกไปใช้ในโปรเจคใหม่เพื่อสร้าง Real-time UI
 * 
 * Usage:
 * 1. คัดลอกไฟล์นี้ไป `src/hooks/useRealtimeSync.ts`
 * 2. คัดลอกไฟล์ optimistic update ไป `src/hooks/useOptimisticUpdate.ts`
 * 3. Import และใช้ใน components
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

// ============================================================================
// 🎯 REAL-TIME SYNC HOOK
// ============================================================================

export interface RealtimeEvent<T = any> {
  event: string
  payload: T
  timestamp: string
}

export interface UseRealtimeSyncOptions<T> {
  channelName: string
  tableName: string
  filter?: string
  initialData?: T[]
  onBroadcast?: (event: RealtimeEvent<T>) => void
  onDatabaseChange?: (payload: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

/**
 * Hook หลักสำหรับ Real-time synchronization
 */
export function useRealtimeSync<T extends { id: string }>(
  options: UseRealtimeSyncOptions<T>
) {
  const {
    channelName,
    tableName,
    filter,
    initialData = [],
    onBroadcast,
    onDatabaseChange,
    onConnect,
    onDisconnect
  } = options

  const [data, setData] = useState<T[]>(initialData)
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent<T> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  // Update item in array
  const updateItem = useCallback((items: T[], updated: T): T[] => {
    return items.map(item => 
      item.id === updated.id ? updated : item
    )
  }, [])

  // Handle broadcast events
  const handleBroadcast = useCallback((event: any) => {
    console.log('Broadcast received:', event)
    setLastEvent(event)
    
    // Call custom handler
    onBroadcast?.(event)
    
    // Default handling based on event type
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
      case 'token_moved':
        setData(prev => updateItem(prev, event.payload))
        break
      case 'stats_updated':
        setData(prev => updateItem(prev, event.payload))
        break
      case 'new_message':
        setData(prev => [...prev, event.payload])
        break
      default:
        console.warn('Unknown broadcast event:', event.event)
    }
  }, [onBroadcast, updateItem])

  // Handle database changes
  const handleDatabaseChange = useCallback((payload: any) => {
    console.log('Database change:', payload)
    
    // Call custom handler
    onDatabaseChange?.(payload)
    
    // Default handling
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
  }, [onDatabaseChange, updateItem])

  // Setup channel
  useEffect(() => {
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
        const isConnected = status === 'SUBSCRIBED'
        setConnected(isConnected)
        
        if (isConnected) {
          onConnect?.()
        } else {
          onDisconnect?.()
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [channelName, tableName, filter, handleBroadcast, handleDatabaseChange, onConnect, onDisconnect])

  return {
    data,
    setData,
    connected,
    lastEvent,
    addItem: useCallback((item: T) => setData(prev => [...prev, item]), []),
    updateItem: useCallback((item: T) => setData(prev => updateItem(prev, item)), [updateItem]),
    removeItem: useCallback((id: string) => setData(prev => prev.filter(item => item.id !== id)), [])
  }
}

// ============================================================================
// 🎯 OPTIMISTIC UPDATE HOOK
// ============================================================================

export interface UseOptimisticUpdateOptions<T extends { id: string }> {
  initialData: T[]
  updateFn: (id: string, data: Partial<T>) => Promise<{ success: boolean; data?: T; error?: string }>
  onSuccess?: (data: T) => void
  onError?: (error: string, id: string) => void
}

/**
 * Hook สำหรับ Optimistic Updates
 */
export function useOptimisticUpdate<T extends { id: string }>(
  options: UseOptimisticUpdateOptions<T>
) {
  const { initialData, updateFn, onSuccess, onError } = options
  
  const [data, setData] = useState<T[]>(initialData)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const [originalData, setOriginalData] = useState<Map<string, T>>(new Map())

  // Optimistic update function
  const optimisticUpdate = useCallback(async (id: string, updateData: Partial<T>) => {
    // 1. หาข้อมูลเดิม
    const originalItem = data.find(item => item.id === id)
    if (!originalItem) {
      onError?.('Item not found', id)
      return
    }

    // 2. เก็บข้อมูลเดิมไว้ rollback
    setOriginalData(prev => new Map(prev).set(id, originalItem))

    // 3. อัพเดต UI ทันที (Optimistic)
    const optimisticData = { ...originalItem, ...updateData }
    
    setData(prev => prev.map(item => 
      item.id === id ? optimisticData : item
    ))
    setPending(prev => new Set(prev).add(id))
    setErrors(prev => {
      const newErrors = new Map(prev)
      newErrors.delete(id)
      return newErrors
    })

    // 4. เรียก Server Action
    try {
      const result = await updateFn(id, updateData)
      
      if (result.success && result.data) {
        // 5. อัพเดตด้วยข้อมูลจริงจาก server
        setData(prev => prev.map(item => 
          item.id === id ? result.data! : item
        ))
        setPending(prev => {
          const newPending = new Set(prev)
          newPending.delete(id)
          return newPending
        })
        setOriginalData(prev => {
          const newOriginal = new Map(prev)
          newOriginal.delete(id)
          return newOriginal
        })
        onSuccess?.(result.data)
      } else {
        throw new Error(result.error || 'Update failed')
      }
    } catch (error: any) {
      // 6. Rollback UI ถ้าเกิด error
      const originalItem = originalData.get(id)
      if (originalItem) {
        setData(prev => prev.map(item => 
          item.id === id ? originalItem : item
        ))
      }
      setPending(prev => {
        const newPending = new Set(prev)
        newPending.delete(id)
        return newPending
      })
      setErrors(prev => new Map(prev).set(id, error.message))
      setOriginalData(prev => {
        const newOriginal = new Map(prev)
        newOriginal.delete(id)
        return newOriginal
      })
      onError?.(error.message, id)
    }
  }, [data, updateFn, onSuccess, onError, originalData])

  return {
    data,
    optimisticUpdate,
    pending,
    errors,
    isLoading: pending.size > 0,
    clearError: useCallback((id: string) => {
      setErrors(prev => {
        const newErrors = new Map(prev)
        newErrors.delete(id)
        return newErrors
      })
    }, []),
    clearAllErrors: useCallback(() => setErrors(new Map()), [])
  }
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook สำหรับ Real-time Map Tokens
 */
export function useMapTokens(mapId: string) {
  return useRealtimeSync({
    channelName: `map_${mapId}`,
    tableName: 'map_tokens',
    filter: `map_id=eq.${mapId}`,
    onBroadcast: (event) => {
      // Custom handling for map events
      if (event.event === 'token_moved') {
        console.log('Token moved:', event.payload)
      }
    }
  })
}

/**
 * Hook สำหรับ Real-time Chat
 */
export function useChatMessages(chatId: string) {
  return useRealtimeSync({
    channelName: `chat_${chatId}`,
    tableName: 'messages',
    filter: `channel_id=eq.${chatId}`,
    onBroadcast: (event) => {
      if (event.event === 'new_message') {
        // Play notification sound, etc.
        console.log('New message:', event.payload)
      }
    }
  })
}

/**
 * Hook สำหรับ Real-time Game State
 */
export function useGameState(gameId: string) {
  return useRealtimeSync({
    channelName: `game_${gameId}`,
    tableName: 'games',
    filter: `id=eq.${gameId}`,
    onBroadcast: (event) => {
      if (event.event === 'state_updated') {
        console.log('Game state updated:', event.payload)
      }
    }
  })
}

/**
 * Hook สำหรับ Real-time Player Stats
 */
export function usePlayerStats(userId: string) {
  return useRealtimeSync({
    channelName: `user_${userId}`,
    tableName: 'profiles',
    filter: `id=eq.${userId}`,
    onBroadcast: (event) => {
      if (event.event === 'stats_updated') {
        console.log('Player stats updated:', event.payload)
      }
    }
  })
}

/**
 * Hook สำหรับ Real-time Notifications
 */
export function useNotifications(userId: string) {
  return useRealtimeSync({
    channelName: `notifications_${userId}`,
    tableName: 'notifications',
    filter: `user_id=eq.${userId}`,
    onBroadcast: (event) => {
      if (event.event === 'new_notification') {
        // Show toast, play sound, etc.
        console.log('New notification:', event.payload)
      }
    }
  })
}

// ============================================================================
// 🎯 UTILITY HOOKS
// ============================================================================

/**
 * Hook สำหรับ Connection Status
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const startReconnect = useCallback(() => {
    setStatus('connecting')
    setReconnectAttempts(prev => prev + 1)
    
    // Simulate reconnection logic
    setTimeout(() => {
      setStatus('connected')
      setReconnectAttempts(0)
    }, 1000 + Math.random() * 2000)
  }, [])

  const disconnect = useCallback(() => {
    setStatus('disconnected')
  }, [])

  return {
    status,
    reconnectAttempts,
    isConnected: status === 'connected',
    startReconnect,
    disconnect
  }
}

/**
 * Hook สำหรับ Event History
 */
export function useEventHistory<T>(maxEvents: number = 100) {
  const [events, setEvents] = useState<RealtimeEvent<T>[]>([])

  const addEvent = useCallback((event: RealtimeEvent<T>) => {
    setEvents(prev => {
      const newEvents = [event, ...prev]
      return newEvents.slice(0, maxEvents)
    })
  }, [maxEvents])

  const clearEvents = useCallback(() => setEvents([]), [])

  return {
    events,
    addEvent,
    clearEvents,
    lastEvent: events[0] || null
  }
}

// ============================================================================
// 🎯 EXAMPLE USAGE
// ============================================================================

/*
🚀 วิธีใช้งาน:

1. คัดลอกไฟล์นี้ไป `src/hooks/useRealtimeSync.ts`

2. ใน component ที่ต้องการ Real-time:

```typescript
// Map Component Example
function MapComponent({ mapId }: { mapId: string }) {
  const { data: tokens, connected, addItem, updateItem, removeItem } = useMapTokens(mapId)
  const { optimisticUpdate, pending, errors } = useOptimisticUpdate({
    initialData: tokens,
    updateFn: async (id, data) => {
      const result = await moveToken(id, data.position_x, data.position_y)
      return result
    }
  })

  const handleMoveToken = async (tokenId: string, x: number, y: number) => {
    await optimisticUpdate(tokenId, { position_x: x, position_y: y })
  }

  return (
    <div>
      <div className="status">
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
        {pending.size > 0 && ` (${pending.size} pending)`}
      </div>
      
      {tokens.map(token => (
        <TokenComponent 
          key={token.id}
          token={token}
          isPending={pending.has(token.id)}
          hasError={errors.has(token.id)}
          onMove={handleMoveToken}
        />
      ))}
    </div>
  )
}

// Chat Component Example
function ChatComponent({ chatId }: { chatId: string }) {
  const { data: messages, connected } = useChatMessages(chatId)

  return (
    <div className="chat">
      <div className="status">
        {connected ? '🟢 Chat Connected' : '🔴 Chat Disconnected'}
      </div>
      
      <div className="messages">
        {messages.map(message => (
          <MessageComponent key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}

// Game Component Example
function GameComponent({ gameId }: { gameId: string }) {
  const { data: gameState, connected } = useGameState(gameId)

  return (
    <div className="game">
      <div className="status">
        {connected ? '🟢 Game Connected' : '🔴 Game Disconnected'}
      </div>
      
      {gameState.length > 0 && (
        <GameBoard state={gameState[0]} />
      )}
    </div>
  )
}
```

3. อย่าลืม import server actions และ setup database!

🎉 เสร็จแล้ว! คุณพร้อมสร้าง Real-time UI แล้ว!
*/
