# 🚀 Real-time Architecture Template

## 📋 สรุปเอกสารสำหรับนำไปใช้

### 🎯 สิ่งที่ได้รับ

1. **`docs/realtime-architecture.md`** - เอกสารสมบูรณ์พร้อม diagram และ best practices
2. **`templates/realtime-server-actions.ts`** - Template server actions พร้อม examples
3. **`templates/realtime-client-hooks.ts`** - Template client hooks พร้อม specialized hooks

---

## 🚀 Quick Start

### 1. คัดลอกไฟล์ไปโปรเจคใหม่

```bash
# สร้าง directories ถ้ายังไม่มี
mkdir -p src/actions/realtime
mkdir -p src/hooks
mkdir -p docs

# คัดลอก templates
cp templates/realtime-server-actions.ts src/actions/realtime/
cp templates/realtime-client-hooks.ts src/hooks/
cp docs/realtime-architecture.md docs/
```

### 2. Setup ในโปรเจคใหม่

#### **Server Actions (`src/actions/realtime/server-actions.ts`)**
```typescript
// คัดลอก template และปรับแต่งตามตารางของคุณ
import { updateWithRealtime, broadcastToMap } from './server-actions'

export async function moveYourToken(tokenId: string, x: number, y: number) {
  return updateWithRealtime(
    'your_table',
    tokenId,
    { position_x: x, position_y: y },
    `map_${mapId}`,
    'token_moved'
  )
}
```

#### **Client Hooks (`src/hooks/useRealtimeSync.ts`)**
```typescript
// คัดลอก template hooks
import { useRealtimeSync, useOptimisticUpdate } from './useRealtimeSync'

function YourComponent() {
  const { data, connected } = useRealtimeSync({
    channelName: 'your_channel',
    tableName: 'your_table',
    filter: 'your_filter'
  })
  
  // ใช้งาน...
}
```

### 3. Setup Supabase Realtime

```sql
-- เปิดใช้งาน Realtime ใน Supabase
-- ตรวจสอบว่า table มี Realtime enabled
SELECT * FROM pg_publication_tables;

-- เปิดการใช้งาน (ถ้ายังไม่ได้เปิด)
ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
```

---

## 🎯 สถาปัตยกรรมหลัก

```
📱 Client (React)
├── useRealtimeSync() - รับข้อมูลแบบ real-time
├── useOptimisticUpdate() - อัพเดต UI ทันที
└── useMapTokens() / useChat() - Specialized hooks

🌐 Server (Next.js)
├── updateWithRealtime() - อัพเดต + broadcast
├── createWithRealtime() - สร้าง + broadcast  
└── broadcastToMap() / broadcastToUser() - Send events

🗄️ Database (Supabase)
├── Tables ที่เปิด Realtime
├── RLS Policies สำหรับความปลอดภัย
└── Triggers สำหรับ complex logic
```

---

## 🔧 ปรับแต่งตามความต้องการ

### **แบบที่ 1: Map/Game System**
```typescript
// Server
export async function movePlayer(playerId: string, x: number, y: number) {
  return updateWithRealtime(
    'players',
    playerId,
    { x, y },
    `game_${gameId}`,
    'player_moved'
  )
}

// Client
function GameMap({ gameId }: { gameId: string }) {
  const { data: players } = useMapTokens(gameId)
  const { optimisticUpdate } = useOptimisticUpdate({
    initialData: players,
    updateFn: movePlayer
  })
}
```

### **แบบที่ 2: Chat System**
```typescript
// Server
export async function sendMessage(content: string, channelId: string) {
  return createWithRealtime(
    'messages',
    { content, channel_id: channelId },
    `chat_${channelId}`,
    'new_message'
  )
}

// Client
function ChatRoom({ channelId }: { channelId: string }) {
  const { data: messages } = useChatMessages(channelId)
  // Render messages...
}
```

### **แบบที่ 3: Dashboard System**
```typescript
// Server
export async function updateMetrics(metrics: any) {
  return updateWithRealtime(
    'metrics',
    'global',
    metrics,
    'dashboard',
    'metrics_updated'
  )
}

// Client
function Dashboard() {
  const { data: metrics } = useRealtimeSync({
    channelName: 'dashboard',
    tableName: 'metrics'
  })
  // Render dashboard...
}
```

---

## 🎯 Best Practices

### ✅ ทำควร
- ✅ ใช้ Broadcast สำหรับ update ที่ต้องความเร็ว
- ✅ ใช้ Postgres Changes สำหรับ backup/reliability
- ✅ Implement optimistic updates สำหรับ UX ที่ดี
- ✅ จำกัด payload size (< 1KB)
- ✅ ใช้ channel naming ที่ชัดเจน
- ✅ Handle connection failures gracefully

### ❌ หลีกเลี่ย
- ❌ ส่งข้อมูลที่ไม่จำเป็นใน broadcast
- ❌ ใช้ `.select('*')` ใน production
- ❌ ลืม validate ข้อมูลบน server
- ❌ ไม่มี error handling
- ❌ ใช้ channel เดียวสำหรับทุกอย่าง

---

## 🔍 Troubleshooting

### **Connection Issues**
```typescript
// ตรวจสอบ connection status
const { connected } = useRealtimeSync({...})

if (!connected) {
  return <div>Connecting...</div>
}
```

### **Broadcast Not Working**
```typescript
// ตรวจสอบว่า channel ถูกต้อง
const channelName = `map_${mapId}` // ต้องตรงกับ server
```

### **Performance Issues**
```typescript
// จำกัดจำนวน subscriptions
const { data } = useRealtimeSync({
  channelName: 'specific_channel', // ไม่ใช่ 'global'
  filter: 'specific_filter'         // กรองข้อมูลให้แคบ
})
```

---

## 📊 Performance Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Latency | < 100ms | Browser DevTools |
| Connection Success | > 99% | Supabase Dashboard |
| UI Responsiveness | < 16ms | React Profiler |
| Memory Usage | < 50MB | Chrome DevTools |

---

## 🎉 ตัวอย่างสำเร็จ

### **Real-time Map**
- ✅ ผู้เล่นย้ายตัวละครแบบ real-time
- ✅ ทุกคนเห็นการเคลื่อนที่ทันที
- ✅ Optimistic updates ทำให้ UX ลื่นไหล
- ✅ Auto-reconnect เมื่อขาดการเชื่อมต่อ

### **Real-time Chat**
- ✅ ข้อความปรากฏทันที
- ✅ Typing indicators
- ✅ Online status updates
- ✅ Message delivery confirmations

### **Real-time Dashboard**
- ✅ Metrics update แบบ live
- ✅ Notifications แบบ real-time
- ✅ Multi-user collaboration
- ✅ Data consistency ข้าม users

---

## 🚀 Next Steps

1. **Implement** - คัดลอก template และเริ่มต้น
2. **Test** - ทดสอบ basic functionality
3. **Optimize** - ปรับแต่งตามความต้องการ
4. **Scale** - ขยายไปใช้งานจริง
5. **Monitor** - ติดตาม performance และ errors

---

## 📞 Support

ถ้ามีปัญหาหรือข้อสงสัย:
1. อ่าน `docs/realtime-architecture.md` ก่อน
2. ตรวจสอบ Supabase Realtime settings
3. ดู browser console สำหรับ errors
4. ทดสอบ network tab สำหรับ failed requests

---

🎯 **Ready to build amazing real-time experiences!**
