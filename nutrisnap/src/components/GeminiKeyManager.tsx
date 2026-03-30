'use client'

import { useState, useEffect } from 'react'
import { KeyRound, Check, Save } from 'lucide-react'

interface Props {
  initialKey?: string
}

export default function GeminiKeyManager({ initialKey = '' }: Props) {
  const [apiKey, setApiKey] = useState(initialKey)
  const [isSaved, setIsSaved] = useState(false)
  const [isError, setIsError] = useState(false)

  // Synchronize state if initialKey changes (e.g. on page load)
  useEffect(() => {
    if (initialKey) {
      setApiKey(initialKey)
    }
  }, [initialKey])

  const handleSave = async () => {
    try {
      setIsError(false)

      const res = await fetch('/api/profile/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_api_key: apiKey.trim() })
      })

      if (!res.ok) throw new Error('Failed to save')

      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (err) {
      console.error(err)
      setIsError(true)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2.5 rounded-xl">
          <KeyRound className="w-5 h-5 text-indigo-600" />
        </div>
        <h2 className="text-xl font-bold font-serif text-slate-800">API Key Manager</h2>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Persönlicher Gemini API Key</label>
          <div className="flex gap-3">
             <input 
               type="password"
               value={apiKey}
               onChange={(e) => setApiKey(e.target.value)}
               placeholder="AIzaSy..."
               className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-600 font-mono text-sm" 
             />
             <button 
               onClick={handleSave}
               className={`px-6 py-3 ${isError ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-semibold rounded-xl shadow-sm transition-colors md:w-auto w-32 flex items-center justify-center`}
             >
               {isSaved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
             </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Deine API-Schlüssel werden sicher in deinem Profil gespeichert. Der Telegram-Bot nutzt diesen Key automatisch für deine Analysen.
          </p>
        </div>
      </div>
    </div>
  )
}
