'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/login/actions'
import { ArrowLeft, Loader2, ChevronRight, User, Mail, Lock, Scale, Ruler } from 'lucide-react'

import { use } from 'react'

export default function SignupPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ message?: string }> 
}) {
  const params = use(searchParams)
  const [isPending, setIsPending] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  
  const displayError = clientError || params.message

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setClientError(null)

    const formData = new FormData(e.currentTarget)
    
    // Client-side validation for passwords
    const password = formData.get('password') as string
    const passwordConfirm = formData.get('password_confirm') as string
    
    if (password !== passwordConfirm) {
      setClientError('Passwörter stimmen nicht überein')
      setIsPending(false)
      return
    }

    try {
      setClientError(null)
      // We still use the signup action from login/actions.ts but we'll update it to handle extra fields
      const result = await signup(formData)
    } catch (err: any) {
      setClientError(err.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-xl justify-center gap-2 m-auto min-h-screen py-12">
      <Link
        href="/login"
        className="absolute left-8 top-8 py-2 px-4 rounded-xl no-underline text-slate-600 bg-white shadow-sm border border-slate-100 hover:bg-slate-50 flex items-center group text-sm font-medium transition-all"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Zurück zum Login
      </Link>

      <div className="bg-white/90 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/50 w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">Kostenlos registrieren</h1>
          <p className="text-slate-500 font-medium">Starte jetzt dein smartes Ernährungstagebuch</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-slate-700">
          {/* Basis-Informationen */}
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1" htmlFor="display_name">
                Dein Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="rounded-2xl px-12 py-4 bg-slate-50 border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300"
                  name="display_name"
                  placeholder="z.B. David"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1" htmlFor="email">
                E-Mail Adresse
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="rounded-2xl px-12 py-4 bg-slate-50 border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300"
                  name="email"
                  type="email"
                  placeholder="name@beispiel.de"
                  required
                />
              </div>
            </div>
          </div>

          {/* Passwörter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1" htmlFor="password">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="rounded-2xl px-12 py-4 bg-slate-50 border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1" htmlFor="password_confirm">
                Bestätigen
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="rounded-2xl px-12 py-4 bg-slate-50 border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300"
                  type="password"
                  name="password_confirm"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            </div>
          </div>

          {/* Optionale Körperdaten */}
          <div className="pt-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Körperdaten (optional)</p>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1" htmlFor="height">
                  Größe (cm)
                </label>
                <div className="relative">
                  <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    className="rounded-2xl px-12 py-4 bg-slate-50 border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300"
                    name="height"
                    type="number"
                    placeholder="180"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1" htmlFor="weight">
                  Gewicht (kg)
                </label>
                <div className="relative">
                  <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    className="rounded-2xl px-12 py-4 bg-slate-50 border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300"
                    name="weight"
                    type="number"
                    step="0.1"
                    placeholder="75.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {displayError && (
            <div className="mt-2 p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl border border-rose-100 animate-in fade-in slide-in-from-top-2 duration-300">
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all rounded-2xl py-4 text-white font-bold text-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Konto erstellen
                <ChevronRight className="w-6 h-6" />
              </>
            )}
          </button>

          <p className="text-center text-slate-500 text-sm font-medium mt-4">
            Du hast bereits ein Konto?{' '}
            <Link href="/login" className="text-emerald-600 font-bold hover:underline">
              Hier anmelden
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
