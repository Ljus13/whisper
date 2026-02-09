# Action & Quest System — Supabase Setup Instructions

## 2 SQL Files to Run (IN ORDER)

### Step 1: Run `add_action_quest_system.sql`
This creates all tables, functions, policies, and indexes:

**How to run:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/)
2. Open your project → SQL Editor
3. Click **"New Query"** 
4. Copy the entire content of `add_action_quest_system.sql`
5. Paste into the editor
6. Click **"Run"**

**Creates:**
- ✅ `public.auto_approve_expired_sleep_requests()` function
- ✅ `public.action_codes` table (admin stores action codes)
- ✅ `public.quest_codes` table (admin stores quest codes)
- ✅ `public.action_submissions` table (players submit actions with URLs)
- ✅ `public.quest_submissions` table (players submit quests with URLs)
- ✅ All RLS policies and indexes

---

### Step 2: Run `add_action_quest_cron.sql`
This schedules the auto-approve function to run at midnight.

**How to run:**
1. Same as Step 1, but use `add_action_quest_cron.sql` content
2. Click **"Run"**

**Creates:**
- ✅ Cron job: runs `auto_approve_expired_sleep_requests()` every day at 00:00 ICT (17:00 UTC)

---

## Features Implemented

### 1. Admin:
- 🎯 Click **สร้างโค้ดแอคชั่น** to generate action codes (`dd-mm-yy-xxxx`)
- 🎯 Click **สร้างโค้ดภารกิจ** to generate quest codes
- ✅ View all submitted actions/quests with approval queue
- ✅ **Approve** → resets player spirituality to max
- ✅ **Reject** with reason → player sees red card with reason

### 2. Players:
- 🎯 **นอนหลับ** — submit 2 RP URLs, 1/day limit, auto-approved at midnight
- 🎯 **ส่งแอคชั่น** — enter code + add/remove evidence URLs (JSONB)
- 🎯 **ส่งภารกิจ** — enter code + add/remove evidence URLs (JSONB)
- 👀 View submitted action/quest history with status
- 👀 View rejection reasons in red card

### 3. Auto-Approve (pg_cron):
- ⏰ Every day at **00:00 ICT** (Bangkok time)
- 🤖 Auto-approves all pending sleep requests from before today
- 🤖 Resets spirituality to `max_spirituality` for each player

---

## Data Structure

### action_codes / quest_codes
```
id (uuid) → name (text) → code (text, unique) → created_by (FK profiles) → created_at
```

### action_submissions / quest_submissions
```
id (uuid)
→ player_id (FK profiles)
→ action_code_id / quest_code_id (FK)
→ evidence_urls (JSONB array of strings)
→ status ('pending'|'approved'|'rejected')
→ rejection_reason (text, nullable)
→ reviewed_by (FK profiles, nullable)
→ reviewed_at (timestamptz, nullable)
→ created_at (timestamptz)
```

---

## RLS Policies

### action_codes / quest_codes
- ✅ Anyone can **SELECT** (players need to validate code)
- ✅ Only admin/DM can **INSERT**

### action_submissions / quest_submissions
- ✅ Players can **SELECT** own submissions
- ✅ Admin/DM can **SELECT** all submissions
- ✅ Players can **INSERT** own submissions
- ✅ Admin/DM can **UPDATE** (approve/reject)

---

## Cron Time Zones

Current setting: `'0 17 * * *'` = **00:00 ICT (Bangkok)**

### To adjust for your timezone:
- UTC+0: `'0 0 * * *'`
- UTC+5 (Pakistan): `'0 19 * * *'` (previous day)
- UTC+8 (Singapore): `'0 16 * * *'`
- UTC+9 (Tokyo): `'0 15 * * *'`

After running `add_action_quest_cron.sql`, you can manually adjust by querying:
```sql
SELECT cron.alter_job(job_name => 'auto-approve-sleep-requests', schedule => '0 17 * * *');
```

---

## Troubleshooting

### Error: "EXPLAIN only works on a single SQL statement"
→ **Solution**: Run each `.sql` file as a separate query (don't paste multiple files together)

### Error: "pg_cron not found"
→ **Solution**: Make sure `add_action_quest_system.sql` ran successfully first, it creates the extension

### Cron not running at expected time
→ **Solution**: Check current cron time with:
```sql
SELECT * FROM cron.job;
```

→ Adjust time with:
```sql
SELECT cron.alter_job(job_name => 'auto-approve-sleep-requests', schedule => '0 17 * * *');
```

---

## Tables Ready in App

After running both SQL files, visit **http://localhost:3000/dashboard/action-quest** to see:
- Admin panel with code generation
- Player action buttons
- Submission history tabs
- Auto-approval dashboard (if admin)
