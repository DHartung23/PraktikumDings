import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { dictionaries, Locale } from '@/utils/i18n'
import { calculateTDEE } from '@/utils/tdee'
import { updateProfile, updatePassword } from './actions'
import { Activity, TrendingDown, TrendingUp } from 'lucide-react'

// Helper to cleanly parse macro value
function parseMacro(val: any): number {
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch meals to compute total and avg kcal
  const { data: meals } = await supabase
    .from('meals')
    .select('created_at, analysis_result')
    .eq('user_id', user.id)

  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'de') as Locale
  const dict = dictionaries[locale] || dictionaries['de']

  const height = profile?.height || 0
  const weight = profile?.weight || 0
  const age = profile?.age || 0
  const gender = profile?.gender || ''

  const tdee = calculateTDEE(height, weight, age, gender)

  // Calculate Avg Kcal per day logged
  const dailyKcalMap: Record<string, number> = {}
  
  if (meals) {
    meals.forEach(meal => {
      if (meal.analysis_result) {
        // use standard slice format YYYY-MM-DD for grouping
        const dateStr = meal.created_at.slice(0, 10) 
        const kcal = parseMacro(meal.analysis_result.estimatedCalories)
        dailyKcalMap[dateStr] = (dailyKcalMap[dateStr] || 0) + kcal
      }
    })
  }

  const daysLogged = Object.keys(dailyKcalMap).length
  const totalKcalLog = Object.values(dailyKcalMap).reduce((a, b) => a + b, 0)
  const avgKcal = daysLogged > 0 ? Math.round(totalKcalLog / daysLogged) : 0

  // Quick average deficit check (without daily steps, just baseline TDEE comparison)
  const avgDiff = tdee - avgKcal
  const isInDeficit = avgDiff > 0 && avgKcal > 0
  const isSurplus = avgDiff < 0

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:px-6 pt-12 pb-24 space-y-8">
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold font-serif text-slate-800 mb-6">{dict.profile}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-slate-400 mb-1">{dict.tdee}</p>
              <p className="text-2xl font-bold text-slate-800 leading-none">{tdee} <span className="text-sm font-medium text-slate-500">{dict.kcal}</span></p>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl flex items-center gap-4">
            <div className={`p-3 rounded-lg ${isInDeficit ? 'bg-emerald-100 text-emerald-600' : isSurplus ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>
              {isInDeficit ? <TrendingDown className="w-6 h-6" /> : isSurplus ? <TrendingUp className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-slate-400 mb-1">
                Ø {avgKcal > 0 ? (isInDeficit ? dict.deficit : isSurplus ? dict.surplus : "Balance") : "Keine Daten"}
              </p>
              {avgKcal > 0 ? (
                <p className="text-2xl font-bold text-slate-800 leading-none">
                  {Math.abs(avgDiff)} <span className="text-sm font-medium text-slate-500">{dict.kcal}/Tag</span>
                </p>
              ) : (
                <p className="text-sm text-slate-500 leading-none pt-1">Ø {avgKcal} kcal/Tag</p>
              )}
            </div>
          </div>
        </div>

        <form action={updateProfile} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{dict.height}</label>
              <input 
                name="height" 
                type="number" 
                defaultValue={height || ''} 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{dict.weight}</label>
              <input 
                name="weight" 
                type="number" 
                step="0.1"
                defaultValue={weight || ''} 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{dict.age}</label>
              <input 
                name="age" 
                type="number" 
                defaultValue={age || ''} 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{dict.gender}</label>
              <select 
                name="gender" 
                defaultValue={gender || ''} 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
              >
                <option value="">-</option>
                <option value="male">{dict.male}</option>
                <option value="female">{dict.female}</option>
                <option value="other">{dict.other}</option>
              </select>
            </div>
          </div>

          <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-colors mt-4">
            {dict.updateProfile}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h2 className="text-xl font-bold font-serif text-slate-800 mb-6">{dict.changePassword}</h2>
        <form action={updatePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{dict.newPassword}</label>
            <input 
              name="password" 
              type="password" 
              minLength={6}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" 
            />
          </div>
          <button type="submit" className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl shadow-sm transition-colors">
            {dict.changePassword}
          </button>
        </form>
      </div>

    </div>
  )
}
