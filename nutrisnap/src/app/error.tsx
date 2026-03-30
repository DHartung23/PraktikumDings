'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Etwas ist schiefgelaufen</h2>
        <p className="text-slate-500 mb-6 text-sm">{error.message || 'Ein unerwarteter Fehler ist aufgetreten.'}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  )
}
