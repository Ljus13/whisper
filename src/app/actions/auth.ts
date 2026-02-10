'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const avatarUrl = formData.get('avatar_url') as string | null
  const backgroundUrl = formData.get('background_url') as string | null
  const bio = formData.get('bio') as string | null

  const updates: Record<string, unknown> = {}

  // Avatar URL
  if (avatarUrl !== null && avatarUrl !== undefined) {
    if (avatarUrl.trim()) {
      try { new URL(avatarUrl) } catch { return { error: 'Invalid avatar URL format' } }
      updates.avatar_url = avatarUrl.trim()
    } else {
      updates.avatar_url = null
    }
  }

  // Background URL
  if (backgroundUrl !== null && backgroundUrl !== undefined) {
    if (backgroundUrl.trim()) {
      try { new URL(backgroundUrl) } catch { return { error: 'Invalid background URL format' } }
      updates.background_url = backgroundUrl.trim()
    } else {
      updates.background_url = null
    }
  }

  // Bio (rich text HTML)
  if (bio !== null && bio !== undefined) {
    updates.bio = bio || null
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No fields to update' }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/players')
  return { success: true }
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const origin = (await headers()).get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signInWithDiscord() {
  const supabase = await createClient()
  const origin = (await headers()).get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function updateDisplayName(displayName: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const trimmed = displayName.trim()
  if (!trimmed || trimmed.length < 1) {
    return { error: 'Display name cannot be empty' }
  }
  if (trimmed.length > 100) {
    return { error: 'Display name is too long' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: trimmed,
      display_name_set: true,
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
