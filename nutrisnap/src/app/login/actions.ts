'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return redirect(`/login?message=${error.message}`)
  }

  revalidatePath('/', 'layout')
  return redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('password_confirm') as string
  const displayName = formData.get('display_name') as string
  const height = formData.get('height') as string
  const weight = formData.get('weight') as string

  if (password !== passwordConfirm) {
    return redirect(`/signup?message=Passwörter stimmen nicht überein`)
  }

  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        display_name: displayName,
        height: height || 0,
        weight: weight || 0,
      }
    },
  })

  if (error) {
    return redirect(`/signup?message=${error.message}`)
  }

  revalidatePath('/', 'layout')
  // We'll redirect to a success message or login. 
  // If email confirmation is off, Supabase might already have logged them in. 
  // But typically we show a message.
  return redirect('/login?message=Registrierung erfolgreich! Bitte schaue in dein E-Mail Postfach (falls Bestätigung aktiv) oder melde dich direkt an.')
}

export async function resetPasswordRequest(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/profile`,
  })

  if (error) {
    return redirect(`/login/forgot-password?message=${error.message}`)
  }

  return redirect('/login/forgot-password?message=Check email for password reset link')
}
