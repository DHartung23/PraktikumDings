'use client'

import { useRouter } from 'next/navigation'

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter()

  const switchLang = (e: React.ChangeEvent<HTMLSelectElement>) => {
    document.cookie = `NEXT_LOCALE=${e.target.value}; path=/; max-age=31536000`
    router.refresh()
  }

  return (
    <select 
      value={currentLocale} 
      onChange={switchLang}
      className="text-sm bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-medium focus:ring-0 cursor-pointer outline-none transition-colors"
    >
      <option value="de">🇩🇪 DE</option>
      <option value="en">🇬🇧 EN</option>
      <option value="ja">🇯🇵 JA</option>
    </select>
  )
}
