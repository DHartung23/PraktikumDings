import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import MealsFeed from '@/components/MealsFeed'
import { cookies } from 'next/headers'
import { dictionaries, Locale } from '@/utils/i18n'

export default async function Index() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const { data: meals } = await supabase
    .from('meals')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: stats } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', user.id)

  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'de') as Locale
  const dict = dictionaries[locale] || dictionaries['de']

  return (
    <div className="flex-1 w-full flex flex-col items-center p-4 sm:px-6 max-w-5xl mx-auto gap-12 mt-8 pb-20">
      
      {/* Upload Section */}
      <section className="w-full flex justify-center">
        <ImageUploader dict={dict} />
      </section>

      {/* Meals History */}
      <section className="w-full">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 font-serif">{dict.yourDiary}</h2>
        <MealsFeed 
            meals={meals || []} 
            profile={profile} 
            stats={stats || []} 
            dict={dict} 
            locale={locale} 
        />
      </section>
    </div>
  )
}
