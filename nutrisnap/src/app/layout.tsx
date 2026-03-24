import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { createClient } from '@/utils/supabase/server'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { cookies } from 'next/headers'
import { dictionaries, Locale } from '@/utils/i18n'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NutriSnap AI',
  description: 'Visual nutritional diary powered by Gemini AI',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'de') as Locale
  const dict = dictionaries[locale] || dictionaries['de']

  return (
    <html lang={locale}>
      <body className={`${inter.className} min-h-screen bg-slate-50 flex flex-col`}>
        {session && (
          <header className="fixed top-0 w-full z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <Link href="/" className="font-bold text-xl text-emerald-600 tracking-tight">
                NutriSnap<span className="text-slate-800">AI</span>
              </Link>
              <div className="flex items-center gap-4">
                <LanguageSwitcher currentLocale={locale} />
                <Link href="/profile" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                  {dict.profile}
                </Link>
                <form action="/auth/signout" method="post">
                  <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    {dict.signOut}
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className={`flex-1 flex flex-col items-center w-full ${session ? 'pt-16' : ''}`}>
          {children}
        </main>
      </body>
    </html>
  )
}
