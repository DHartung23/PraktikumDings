'use client'

import { useState } from 'react'
import { Flame, Beef, Droplet, Wheat, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Footprints, Trash2, CheckCircle2, Circle, MessageSquare, Edit2, Check } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { calculateTDEE, calculateStepCalories, getMacroGoals } from '@/utils/tdee'
import { saveDailySteps } from '@/app/profile/actions'

export interface AnalysisResult {
  foodItems?: string[];
  estimatedCalories?: string | number;
  description?: string;
  macronutrients?: {
    protein?: string | number;
    carbs?: string | number;
    fat?: string | number;
  };
}

export interface Meal {
  id: string;
  created_at: string;
  user_id: string;
  image_url: string;
  user_comment?: string | null;
  analysis_result?: AnalysisResult | null;
}

export interface Profile {
  id: string;
  height: number;
  weight: number;
  age: number;
  gender: string;
}

export interface Stat {
  id: string;
  date_str: string;
  steps: number;
  user_id: string;
}

function DailyStepsInput({ isoDate, initialSteps, dict }: { isoDate: string, initialSteps: number, dict: Record<string, any> }) {
  const [steps, setSteps] = useState(initialSteps)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSteps, setSavedSteps] = useState(initialSteps)

  const handleBlur = async () => {
    if (steps === savedSteps) return
    setIsSaving(true)
    await saveDailySteps(isoDate, steps)
    setSavedSteps(steps)
    setIsSaving(false)
  }

  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 mt-4 lg:mt-0">
      <div className="bg-indigo-100 p-2 rounded-lg">
        <Footprints className="w-5 h-5 text-indigo-600" />
      </div>
      <div>
        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">{dict.steps}</label>
        <div className="relative w-24">
          <input
            type="number"
            value={steps || ''}
            onChange={(e) => setSteps(parseInt(e.target.value) || 0)}
            onBlur={handleBlur}
            className="w-full bg-transparent font-bold text-lg text-slate-800 leading-tight outline-none focus:border-b-2 border-indigo-400 p-0 m-0"
            placeholder="0"
          />
          {isSaving && <Loader2 className="absolute right-0 top-1 w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </div>
    </div>
  )
}

function MealCard({ meal, dict, locale, isSelected, onToggleSelect }: { meal: Meal, dict: Record<string, any>, locale: string, isSelected: boolean, onToggleSelect: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analysis = meal.analysis_result
  const isDraft = !analysis

  const supabase = createClient()
  const router = useRouter()

  const dateOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  const timeStr = new Date(meal.created_at).toLocaleTimeString(locale, dateOptions)

  const [isEditingComment, setIsEditingComment] = useState(false)
  const [commentText, setCommentText] = useState(meal.user_comment || '')
  const [isSavingComment, setIsSavingComment] = useState(false)

  const handleSaveComment = async () => {
    setIsSavingComment(true)
    try {
      const { error } = await supabase.from('meals').update({ user_comment: commentText }).eq('id', meal.id)
      if (error) throw error
      setIsEditingComment(false)
      router.refresh()
    } catch(err) {
      console.error(err)
      alert(locale === 'en' ? 'Could not save comment' : 'Kommentar konnte nicht gespeichert werden')
    } finally {
      setIsSavingComment(false)
    }
  }

  const handleAnalyzeNow = async () => {
    setIsAnalyzing(true)
    try {
      let newAnalysis;
      const apiKey = localStorage.getItem('gemini_api_key')

      if (apiKey) {
        // 1. Fetch image directly and convert to base64
        const imgRes = await fetch(meal.image_url)
        if (!imgRes.ok) throw new Error("Could not fetch image")
        const blob = await imgRes.blob()
        const reader = new FileReader()

        const base64Image = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.readAsDataURL(blob)
        })
        const mimeType = blob.type || 'image/jpeg'

        // 2. Call Gemini API directly from browser
        const targetLanguage = locale === 'en' ? 'English' : locale === 'ja' ? 'Japanese' : 'German'
        const userContext = meal.user_comment ? `\n\nUSER INSTRUCTIONS FOR THIS MEAL: "${meal.user_comment}". Please mathematically adjust your calorie and macronutrient estimations based exactly on this context!` : ''
        
        const prompt = `
          Analyze this food image and provide a nutritional breakdown. 
          Respond entirely in ${targetLanguage}.
          Return the output as a clean, raw JSON object.
          IMPORTANT: estimatedCalories must be an integer (in kcal). protein, carbs, and fat must be integers representing the absolute amount in grams. Provide your best numeric estimate. Do not use words or strings for these values.${userContext}
        `

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: prompt }, { inlineData: { data: base64Image, mimeType } }]
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  foodItems: { type: "ARRAY", items: { type: "STRING" } },
                  estimatedCalories: { type: "INTEGER" },
                  macronutrients: {
                    type: "OBJECT",
                    properties: {
                      protein: { type: "INTEGER", description: "Total protein in grams" },
                      carbs: { type: "INTEGER", description: "Total carbs in grams" },
                      fat: { type: "INTEGER", description: "Total fat in grams" }
                    }
                  },
                  description: { type: "STRING" }
                }
              }
            }
          })
        })

        if (!geminiRes.ok) {
          const errData = await geminiRes.json()
          throw new Error(errData.error?.message || 'Gemini API Error')
        }

        const data = await geminiRes.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error("No response from AI")
        newAnalysis = JSON.parse(text)
      } else {
        // Fallback to our server route
        const aiResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: meal.image_url, userContext: meal.user_comment })
        })

        if (!aiResponse.ok) throw new Error(dict.aiError)
        newAnalysis = await aiResponse.json()
      }

      const { error: dbError } = await supabase
        .from('meals')
        .update({ analysis_result: newAnalysis })
        .eq('id', meal.id)

      if (dbError) throw dbError
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert(err.message || dict.aiError)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${isDraft ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'} overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-300`}>
      <div className="h-48 w-full bg-slate-100 relative overflow-hidden shrink-0 border-b border-slate-100">
        <img src={meal.image_url} alt="Meal" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded">{timeStr}</div>
        <button
          onClick={() => onToggleSelect(meal.id)}
          className={`absolute top-2 left-2 p-1.5 rounded-full transition-all shadow-sm ${isSelected ? 'bg-emerald-500 text-white' : 'bg-white/90 text-slate-400 hover:text-slate-700 backdrop-blur-sm'}`}
          title="Select Meal"
        >
          {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
      </div>
      
      {/* User Comment Section / AI Context */}
      <div className="px-5 pt-4 w-full">
         {isEditingComment ? (
            <div className="flex flex-col gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
               <textarea 
                 value={commentText} 
                 onChange={e => setCommentText(e.target.value)} 
                 placeholder={locale === 'en' ? 'Write a comment / AI instructions...' : 'KI-Instruktionen (z.B. "Nur die Hälfte gegessen")...'}
                 className="w-full bg-transparent text-sm resize-none outline-none text-slate-700"
                 rows={2}
                 autoFocus
               />
               <div className="flex justify-end gap-2 mt-1">
                  <button onClick={() => { setIsEditingComment(false); setCommentText(meal.user_comment || '') }} className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1">{locale === 'en' ? 'Cancel' : 'Abbrechen'}</button>
                  <button onClick={handleSaveComment} disabled={isSavingComment} className="text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-3 py-1 rounded-lg flex items-center transition-colors">
                    {isSavingComment ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />} {locale === 'en' ? 'Save' : 'Speichern'}
                  </button>
               </div>
            </div>
         ) : (
            meal.user_comment ? (
              <div className="group relative bg-indigo-50/50 border-l-2 border-indigo-400 p-3 rounded-r-xl text-sm text-slate-700 italic flex justify-between items-start">
                <p className="whitespace-pre-wrap">{meal.user_comment}</p>
                <button onClick={() => setIsEditingComment(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:text-indigo-600 p-1">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsEditingComment(true)} className="text-xs font-medium text-slate-400 hover:text-indigo-500 transition-colors flex items-center">
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> {locale === 'en' ? 'Add notes / AI context...' : 'Notizen / KI-Kontext hinzufügen...'}
              </button>
            )
         )}
      </div>

      {isDraft ? (
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
          <h3 className="font-semibold text-lg text-amber-900 mb-2">{dict.pendingAnalysis}</h3>
          <p className="text-sm text-slate-500 mb-6">{dict.noDescription}</p>
          <button onClick={handleAnalyzeNow} disabled={isAnalyzing} className="w-full flex items-center justify-center bg-amber-500 hover:bg-amber-600 font-semibold py-2.5 rounded-xl text-white transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
            {isAnalyzing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{dict.analyzing}</> : dict.analyzeNow}
          </button>
        </div>
      ) : (
        <div className="p-5 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-3 gap-3">
            <h3 className={`font-semibold text-lg text-slate-800 ${!isExpanded ? 'line-clamp-1' : ''}`}>
              {analysis.foodItems?.join(', ') || dict.unknownMeal}
            </h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 shrink-0 shadow-sm mt-0.5">
              <Flame className="w-3 h-3 mr-1 opacity-70" />
              {analysis.estimatedCalories || 0} {dict.kcal}
            </span>
          </div>
          <p className={`text-sm text-slate-600 mb-2 ${!isExpanded ? 'line-clamp-2' : ''}`}>{analysis.description || dict.noDescription}</p>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-emerald-600 text-xs font-semibold flex items-center mb-5 hover:text-emerald-700 transition-colors w-fit">
            {isExpanded ? <>{dict.showLess} <ChevronUp className="w-3 h-3 ml-1" /></> : <>{dict.showMore} <ChevronDown className="w-3 h-3 ml-1" /></>}
          </button>
          <div className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
            <div className="flex flex-col items-center justify-center p-2 text-emerald-700">
              <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">{dict.protein}</span>
              <span className="font-semibold flex items-center text-sm text-center"><Beef className="w-3.5 h-3.5 mr-1.5 opacity-70" />{analysis.macronutrients?.protein ?? 0}{dict.g}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 text-blue-700 border-x border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">{dict.carbs}</span>
              <span className="font-semibold flex items-center text-sm text-center"><Wheat className="w-3.5 h-3.5 mr-1.5 opacity-70" />{analysis.macronutrients?.carbs ?? 0}{dict.g}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 text-amber-700">
              <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">{dict.fat}</span>
              <span className="font-semibold flex items-center text-sm text-center"><Droplet className="w-3.5 h-3.5 mr-1.5 opacity-70" />{analysis.macronutrients?.fat ?? 0}{dict.g}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function parseMacro(val: any): number {
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}

// Helper to determine the dynamic color class of a macro widget
function getMacroColors(type: 'kcal' | 'protein' | 'carbs' | 'fat', actual: number, goal: number) {
  if (!goal) return { wrapper: 'bg-slate-50 border-slate-100', iconBg: 'bg-slate-200', iconText: 'text-slate-500', textVal: 'text-slate-800' }
  const ratio = actual / goal

  if (type === 'protein') {
    if (ratio >= 0.90) return { wrapper: 'bg-emerald-50 border-emerald-100', iconBg: 'bg-emerald-200', iconText: 'text-emerald-700', textVal: 'text-emerald-800' }
    if (ratio >= 0.70) return { wrapper: 'bg-amber-50 border-amber-100', iconBg: 'bg-amber-200', iconText: 'text-amber-700', textVal: 'text-amber-800' }
    return { wrapper: 'bg-red-50 border-red-100', iconBg: 'bg-red-200', iconText: 'text-red-700', textVal: 'text-red-800' }
  } else {
    // Kcal, Carbs, Fat
    if (ratio > 1.15) return { wrapper: 'bg-red-50 border-red-100', iconBg: 'bg-red-200', iconText: 'text-red-700', textVal: 'text-red-800' }
    if (ratio < 0.85) return { wrapper: 'bg-blue-50 border-blue-100', iconBg: 'bg-blue-200', iconText: 'text-blue-700', textVal: 'text-blue-800' }
    return { wrapper: 'bg-emerald-50 border-emerald-100', iconBg: 'bg-emerald-200', iconText: 'text-emerald-700', textVal: 'text-emerald-800' }
  }
}

export default function MealsFeed({ meals, profile, stats, dict, locale }: { meals: Meal[], profile: Profile | null, stats: Stat[], dict: Record<string, any>, locale: string }) {
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false)
  const [selectedMealIds, setSelectedMealIds] = useState<Set<string>>(new Set())
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedMealIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedMealIds(newSet)
  }

  const handleBatchDelete = async () => {
    if (selectedMealIds.size === 0) return
    const msg = locale === 'en' ? `Delete ${selectedMealIds.size} meals?` : `${selectedMealIds.size} Mahlzeiten wirklich löschen?`
    if (!confirm(msg)) return
    
    setIsDeletingBatch(true)
    try {
      const mealsToDelete = meals.filter(m => selectedMealIds.has(m.id))
      const paths = mealsToDelete.map(m => {
         if (!m.image_url) return null;
         const parts = m.image_url.split('/food-images/')
         return parts.length === 2 ? parts[1] : null
      }).filter(Boolean) as string[]

      if (paths.length > 0) {
         await supabase.storage.from('food-images').remove(paths)
      }

      const idsArray = Array.from(selectedMealIds)
      const { error } = await supabase.from('meals').delete().in('id', idsArray)
      if (error) throw error

      setSelectedMealIds(new Set())
      router.refresh()
    } catch(err) {
      console.error(err)
      alert("Error deleting meals")
    } finally {
      setIsDeletingBatch(false)
    }
  }

  if (!meals || meals.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-500">
        <p className="text-lg font-medium text-slate-600 mb-2">{dict.noMeals}</p>
        <p className="text-sm">{dict.uploadStart}</p>
      </div>
    )
  }

  const allDrafts = meals.filter(m => !m.analysis_result)

  const handleAnalyzeAll = async () => {
    setIsAnalyzingAll(true)
    try {
      const apiKey = localStorage.getItem('gemini_api_key')

      if (apiKey) {
        const parts: any[] = []
        for (const meal of allDrafts) {
          const imgRes = await fetch(meal.image_url)
          if (!imgRes.ok) throw new Error("Could not fetch image")
          const blob = await imgRes.blob()
          const reader = new FileReader()
          const base64Image = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const result = reader.result as string
              resolve(result.split(',')[1])
            }
            reader.readAsDataURL(blob)
          })
          const mimeType = blob.type || 'image/jpeg'
          parts.push({ inlineData: { data: base64Image, mimeType } })
        }

        const targetLanguage = locale === 'en' ? 'English' : locale === 'ja' ? 'Japanese' : 'German'
        
        const userContexts = allDrafts.map((m, i) => m.user_comment ? `Image ${i+1}: "${m.user_comment}"` : null).filter(Boolean)
        const contextStr = userContexts.length > 0 ? `\n\nUSER INSTRUCTIONS PER IMAGE:\n${userContexts.join('\n')}\nPlease mathematically adjust your calorie and macronutrient estimations for the respective images based exactly on these specific notes!` : ''

        const prompt = `
          I am providing you with ${allDrafts.length} food images in order.
          Analyze each food image individually and provide a nutritional breakdown for each one.
          Respond entirely in ${targetLanguage}.
          Return the output as a clean, raw JSON ARRAY of exactly ${allDrafts.length} objects.
          The objects MUST be in the exact same order as the images provided.
          IMPORTANT: estimatedCalories must be an integer (in kcal). protein, carbs, and fat must be integers representing the absolute amount in grams. Provide your best numeric estimate. Do not use words or strings for these values.${contextStr}
        `

        parts.unshift({ text: prompt })

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: parts
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    foodItems: { type: "ARRAY", items: { type: "STRING" } },
                    estimatedCalories: { type: "INTEGER" },
                    macronutrients: {
                      type: "OBJECT",
                      properties: {
                        protein: { type: "INTEGER", description: "Total protein in grams" },
                        carbs: { type: "INTEGER", description: "Total carbs in grams" },
                        fat: { type: "INTEGER", description: "Total fat in grams" }
                      }
                    },
                    description: { type: "STRING" }
                  }
                }
              }
            }
          })
        })

        if (!geminiRes.ok) throw new Error("Batch Gemini API Error")

        const data = await geminiRes.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error("No response from AI")

        const newAnalyses = JSON.parse(text)
        if (!Array.isArray(newAnalyses) || newAnalyses.length !== allDrafts.length) {
          throw new Error("Invalid output format from AI")
        }

        for (let i = 0; i < allDrafts.length; i++) {
          const meal = allDrafts[i]
          const analysis = newAnalyses[i]
          const { error: dbError } = await supabase
            .from('meals')
            .update({ analysis_result: analysis })
            .eq('id', meal.id)
          if (dbError) throw dbError
        }

      } else {
        // Fallback server sequentially
        for (const meal of allDrafts) {
          const aiResponse = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: meal.image_url })
          })
          if (!aiResponse.ok) throw new Error(dict.aiError)
          const newAnalysis = await aiResponse.json()
          const { error: dbError } = await supabase
            .from('meals')
            .update({ analysis_result: newAnalysis })
            .eq('id', meal.id)
          if (dbError) throw dbError
        }
      }
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert(err.message || dict.aiError)
    } finally {
      setIsAnalyzingAll(false)
    }
  }

  // Base TDEE without activity
  const baseTDEE = calculateTDEE(profile?.height || 0, profile?.weight || 0, profile?.age || 0, profile?.gender || '')

  // Group by YYYY-MM-DD
  const groupedMeals = meals.reduce((acc, meal) => {
    const isoDate = new Date(meal.created_at).toISOString().slice(0, 10)
    if (!acc[isoDate]) acc[isoDate] = []
    acc[isoDate].push(meal)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-12 pb-16">
      
      {selectedMealIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-5 border border-slate-700 animate-in slide-in-from-bottom-5">
          <span className="font-semibold">{selectedMealIds.size} {locale === 'en' ? 'selected' : 'ausgewählt'}</span>
          <div className="w-px h-5 bg-slate-700"></div>
          <button 
            onClick={handleBatchDelete}
            disabled={isDeletingBatch}
            className="flex items-center text-red-400 hover:text-red-300 transition-colors font-bold disabled:opacity-50"
          >
            {isDeletingBatch ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {locale === 'en' ? 'Delete' : 'Löschen'}
          </button>
        </div>
      )}

      {allDrafts.length > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div>
            <h3 className="text-amber-900 font-bold">{dict.pendingAnalysis}</h3>
            <p className="text-amber-700 text-sm">Du hast {allDrafts.length} Bilder, die noch nicht analysiert wurden.</p>
          </div>
          <button
            onClick={handleAnalyzeAll}
            disabled={isAnalyzingAll}
            className="whitespace-nowrap w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center disabled:opacity-70"
          >
            {isAnalyzingAll ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{dict.analyzing}</> : dict.analyzeAll}
          </button>
        </div>
      )}

      {Object.entries(groupedMeals).map(([isoDate, dayMeals]) => {
        // UI date string formatting
        const uiDateStr = new Date(isoDate).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

        let totalKcal = 0
        let totalProtein = 0
        let totalCarbs = 0
        let totalFat = 0
        let analyzedCount = 0

        dayMeals.forEach(meal => {
          if (meal.analysis_result) {
            analyzedCount++
            totalKcal += parseMacro(meal.analysis_result.estimatedCalories)
            totalProtein += parseMacro(meal.analysis_result.macronutrients?.protein)
            totalCarbs += parseMacro(meal.analysis_result.macronutrients?.carbs)
            totalFat += parseMacro(meal.analysis_result.macronutrients?.fat)
          }
        })

        const todayStat = stats.find(s => s.date_str === isoDate)
        const steps = todayStat?.steps || 0
        const stepKcal = calculateStepCalories(steps)
        const adjustedTDEE = baseTDEE + stepKcal

        const goals = getMacroGoals(profile?.weight || 0, baseTDEE, stepKcal)

        const netDifference = adjustedTDEE - totalKcal
        const isDeficit = netDifference > 0 && totalKcal > 0
        const isSurplus = netDifference < 0

        const clKcal = getMacroColors('kcal', totalKcal, goals.kcalGoal)
        const clProt = getMacroColors('protein', totalProtein, goals.proteinGoal)
        const clCarbs = getMacroColors('carbs', totalCarbs, goals.carbsGoal)
        const clFat = getMacroColors('fat', totalFat, goals.fatGoal)

        return (
          <div key={isoDate} className="flex flex-col gap-6">

            {/* Daily Dashboard Summary Header */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-slate-800">{uiDateStr}</h3>
                <p className="text-slate-500 mt-1">
                  {dayMeals.length} {dict.mealsCount} {analyzedCount < dayMeals.length && `(${dayMeals.length - analyzedCount} ${dict.pendingAnalysis})`}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className={`flex items-center border rounded-xl px-4 py-3 transition-colors ${clKcal.wrapper}`}>
                    <div className={`${clKcal.iconBg} p-2 rounded-lg mr-3`}><Flame className={`w-5 h-5 flex-shrink-0 ${clKcal.iconText}`} /></div>
                    <div className="flex flex-col">
                      <p className="text-[10px] uppercase font-bold text-slate-500">{dict.total}</p>
                      <p className={`font-bold text-xl leading-tight ${clKcal.textVal}`}>{totalKcal} <span className="text-xs font-semibold opacity-70">{dict.kcal}</span></p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dict.goal}: {goals.kcalGoal}</p>
                    </div>
                  </div>
                  <div className={`flex items-center border rounded-xl px-4 py-3 transition-colors ${clProt.wrapper}`}>
                    <div className={`${clProt.iconBg} p-2 rounded-lg mr-3`}><Beef className={`w-5 h-5 flex-shrink-0 ${clProt.iconText}`} /></div>
                    <div className="flex flex-col">
                      <p className="text-[10px] uppercase font-bold text-slate-500">{dict.protein}</p>
                      <p className={`font-bold text-xl leading-tight ${clProt.textVal}`}>{totalProtein}<span className="text-xs font-semibold opacity-70">{dict.g}</span></p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dict.goal}: {goals.proteinGoal}{dict.g}</p>
                    </div>
                  </div>
                  <div className={`flex items-center border rounded-xl px-4 py-3 transition-colors ${clCarbs.wrapper}`}>
                    <div className={`${clCarbs.iconBg} p-2 rounded-lg mr-3`}><Wheat className={`w-5 h-5 flex-shrink-0 ${clCarbs.iconText}`} /></div>
                    <div className="flex flex-col">
                      <p className="text-[10px] uppercase font-bold text-slate-500">{dict.carbs}</p>
                      <p className={`font-bold text-xl leading-tight ${clCarbs.textVal}`}>{totalCarbs}<span className="text-xs font-semibold opacity-70">{dict.g}</span></p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dict.goal}: {goals.carbsGoal}{dict.g}</p>
                    </div>
                  </div>
                  <div className={`flex items-center border rounded-xl px-4 py-3 transition-colors ${clFat.wrapper}`}>
                    <div className={`${clFat.iconBg} p-2 rounded-lg mr-3`}><Droplet className={`w-5 h-5 flex-shrink-0 ${clFat.iconText}`} /></div>
                    <div className="flex flex-col">
                      <p className="text-[10px] uppercase font-bold text-slate-500">{dict.fat}</p>
                      <p className={`font-bold text-xl leading-tight ${clFat.textVal}`}>{totalFat}<span className="text-xs font-semibold opacity-70">{dict.g}</span></p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dict.goal}: {goals.fatGoal}{dict.g}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row xl:flex-col gap-4">
                <DailyStepsInput isoDate={isoDate} initialSteps={steps} dict={dict} />

                <div className={`flex items-center gap-3 border rounded-xl px-5 py-4 ${isDeficit ? 'bg-emerald-50 border-emerald-100' : isSurplus ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className={`p-2 rounded-lg ${isDeficit ? 'bg-emerald-200 text-emerald-700' : isSurplus ? 'bg-orange-200 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>
                    {isDeficit ? <TrendingDown className="w-5 h-5" /> : isSurplus ? <TrendingUp className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      {totalKcal > 0 ? (isDeficit ? dict.deficit : isSurplus ? dict.surplus : "Balance") : "Kalorienbilanz"}
                    </p>
                    {totalKcal > 0 ? (
                      <p className={`font-bold text-xl leading-tight ${isDeficit ? 'text-emerald-700' : isSurplus ? 'text-orange-700' : 'text-slate-700'}`}>
                        {Math.abs(netDifference)} <span className="text-sm font-medium opacity-70">{dict.kcal}</span>
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-slate-500">K.A.</p>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Grid of Meals for this Day */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dayMeals.map((meal) => (
                <MealCard key={meal.id} meal={meal} dict={dict} locale={locale} isSelected={selectedMealIds.has(meal.id)} onToggleSelect={handleToggleSelect} />
              ))}
            </div>

          </div>
        )
      })}
    </div>
  )
}
