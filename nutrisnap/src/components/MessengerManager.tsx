'use client'

import { useState } from 'react'
import { MessageCircle, CheckCircle, Link2 } from 'lucide-react'
import { generateConnectionCode } from '@/app/profile/actions'

export default function MessengerManager({ profile }: { profile: any }) {
  const [code, setCode] = useState(profile?.connection_code || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const isLinked = !!profile?.telegram_chat_id

  const handleGenerate = async () => {
    setIsGenerating(true)
    const newCode = await generateConnectionCode()
    if (newCode) setCode(newCode)
    setIsGenerating(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="w-6 h-6 text-indigo-500" />
        <h2 className="text-xl font-bold font-serif text-slate-800">Messenger Integration</h2>
      </div>

      <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
             <div className="bg-blue-500 text-white p-2 rounded-full">
               <MessageCircle className="w-5 h-5 fill-current" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800">Telegram Bot</h3>
                <p className="text-xs text-slate-500">@Nutri_chan_bot</p>
             </div>
          </div>
          {isLinked ? (
            <span className="flex items-center text-sm font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full"><CheckCircle className="w-4 h-4 mr-1"/> Verbunden</span>
          ) : (
            <span className="text-sm font-bold text-slate-400 bg-slate-200 px-3 py-1 rounded-full">Nicht verbunden</span>
          )}
        </div>

        {!isLinked && (
          <div className="mt-4 pt-4 border-t border-slate-200">
             <p className="text-sm text-slate-600 mb-4">
               Um deinen Account zu verknüpfen, generiere einen Einmalcode und schicke ihn direkt an deinen Telegram Bot.
             </p>
             
             {code ? (
               <div className="bg-white border border-indigo-200 p-4 rounded-xl flex flex-col items-center gap-2">
                 <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Dein Kommando</p>
                 <code className="bg-slate-100 px-4 py-2 rounded-lg mt-1 inline-block font-mono font-bold text-slate-800 text-lg border border-slate-200 shadow-sm cursor-text selection:bg-indigo-200">
                   /connect {code}
                 </code>
                 <p className="text-xs text-slate-500 mt-2 text-center">
                   Kopiere dieses Kommando und sende es als Nachricht an <b>@Nutri_chan_bot</b> in Telegram.
                 </p>
               </div>
             ) : (
               <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex justify-center items-center gap-2">
                 <Link2 className="w-5 h-5" /> {isGenerating ? 'Wird generiert...' : 'Verknüpfungs-Code generieren'}
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  )
}
