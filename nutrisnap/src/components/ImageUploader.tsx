'use client'

import { useState, useRef } from 'react'
import { UploadCloud, Loader2, Info, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function ImageUploader({ dict }: { dict: Record<string, any> }) {
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const processFiles = (selectedFiles: FileList | File[]) => {
    // Relaxed MIME type checking: accept if it starts with image/ OR if it has a typical image extension, or just allow it if the type is empty (mobile browser quirk)
    const validFiles = Array.from(selectedFiles).filter(f => {
      const isImageMime = f.type.startsWith('image/')
      const hasExtension = /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name)
      return isImageMime || hasExtension || f.type === ''
    })
    
    if (validFiles.length === 0) {
      setError(dict.uploadError || "Bitte wähle ein gültiges Bild aus.")
      return
    }
    setError(null)
    
    setFiles(prev => [...prev, ...validFiles])
    
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setPreviewUrls(prev => [...prev, e.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
    // Reset file input so that selecting the same file again triggers onChange
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
    setPreviewUrls(previewUrls.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (files.length === 0) return
    setIsUploading(true)
    setError(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload sequentially or parallel
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Math.random()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('food-images')
          .upload(fileName, file)
          
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('food-images')
          .getPublicUrl(fileName)

        return publicUrl
      })

      const publicUrls = await Promise.all(uploadPromises)

      // Insert all drafts directly into "meals" table without analysis
      const insertPromises = publicUrls.map(url => {
        return supabase.from('meals').insert({
          user_id: user.id,
          image_url: url,
          analysis_result: null, // Indicates draft/pending analysis
        })
      })

      const results = await Promise.all(insertPromises)
      const hasError = results.find(r => r.error)
      if (hasError) throw hasError.error

      setFiles([])
      setPreviewUrls([])
      router.refresh()
      
    } catch (err: any) {
      console.error('Upload Error:', err)
      setError(err.message || 'Something went wrong.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl text-slate-800 font-semibold mb-4">{dict.logMeal}</h2>
      
      <label 
        htmlFor="meal-image-upload"
        className={`block relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer mb-6 ${dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          id="meal-image-upload"
          ref={inputRef}
          type="file" 
          accept="image/*" 
          multiple
          onChange={handleChange} 
          className="sr-only" 
        />
        <UploadCloud className="mx-auto h-10 w-10 text-slate-400 mb-3" />
        <p className="text-slate-600 font-medium">{dict.dragDrop}</p>
        <p className="text-slate-500 text-sm mt-1">{dict.clickSelect}</p>
      </label>
      
      {previewUrls.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {previewUrls.map((url, index) => (
              <div key={index} className="relative rounded-lg overflow-hidden bg-slate-100 aspect-square group border border-slate-200 shadow-sm">
                <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                <button 
                  onClick={() => removeFile(index)} 
                  disabled={isUploading}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
            <button 
              onClick={() => { setFiles([]); setPreviewUrls([]) }}
              disabled={isUploading}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {dict.cancel}
            </button>
            <button 
              onClick={handleSave}
              disabled={isUploading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {dict.saving}
                </>
              ) : `${dict.saveImages} (${files.length})`}
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start text-sm">
          <Info className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
