'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

  const height = parseFloat(formData.get('height') as string || '0')
  const weight = parseFloat(formData.get('weight') as string || '0')
  const age = parseInt(formData.get('age') as string || '0', 10)
  const gender = formData.get('gender') as string
  const gemini_api_key = formData.get('gemini_api_key') as string

  const { error } = await supabase
    .from('profiles')
    .update({ height, weight, age, gender, gemini_api_key })
    .eq('id', user.id)

  if (error) {
    // fallback if profile was deleted
    await supabase.from('profiles').insert({ id: user.id, height, weight, age, gender, gemini_api_key })
  }

  revalidatePath('/profile')
  revalidatePath('/')
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
     throw new Error(error.message)
  }
}

export async function saveDailySteps(dateStr: string, steps: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  // Upsert (insert or update on conflict) requires matching columns.
  // Actually, standard supabase update falls back to insert via RPC or logic if no ON CONFLICT is used.
  // We can select first, then update if exists, or insert.
  const { data: existing } = await supabase
    .from('daily_stats')
    .select('id')
    .eq('user_id', user.id)
    .eq('date_str', dateStr)
    .single()

  if (existing) {
    await supabase.from('daily_stats').update({ steps }).eq('id', existing.id)
  } else {
    await supabase.from('daily_stats').insert({ user_id: user.id, date_str: dateStr, steps })
  }

  revalidatePath('/')
  return { success: true }
}

export async function generateConnectionCode() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const code = Math.floor(100000 + Math.random() * 900000).toString()

  const { error } = await supabase
    .from('profiles')
    .update({ connection_code: code })
    .eq('id', user.id)

  if (error) {
    console.error(error)
    return null
  }
  
  revalidatePath('/profile')
  return code
}
