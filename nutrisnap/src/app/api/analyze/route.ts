import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { cookies } from 'next/headers'
import { Locale } from '@/utils/i18n'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function POST(req: Request) {
  try {
    const { base64Image, mimeType, imageUrl, userContext } = await req.json()

    let finalBase64 = base64Image
    let finalMimeType = mimeType || 'image/jpeg'

    if (imageUrl && !base64Image) {
      // Fetch the image from URL
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error("Failed to fetch image from URL")
      }
      const arrayBuffer = await response.arrayBuffer()
      finalBase64 = Buffer.from(arrayBuffer).toString('base64')
      finalMimeType = response.headers.get('content-type') || 'image/jpeg'
    }

    if (!finalBase64 && !userContext) {
      return NextResponse.json({ error: 'No image or text provided' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'de') as Locale
    const targetLanguage = locale === 'en' ? 'English' : locale === 'ja' ? 'Japanese' : 'German'
    
    const contextStr = userContext ? `\n\nUSER INSTRUCTIONS/DESCRIPTION: "${userContext}". Please mathematically adjust your calorie and macronutrient estimations based exactly on this context!` : ''
    
    const prompt = finalBase64 
      ? `Analyze this food image and provide a nutritional breakdown.
         Respond entirely in ${targetLanguage}.
         Return the output as a clean, raw JSON object.
         IMPORTANT: estimatedCalories must be an integer (in kcal). protein, carbs, and fat must be integers representing the absolute amount in grams. Provide your best numeric estimate. Do not use words or strings for these values.${contextStr}`
      : `Analyze this food description and provide a nutritional breakdown.
         Respond entirely in ${targetLanguage}.
         Return the output as a clean, raw JSON object.
         IMPORTANT: estimatedCalories must be an integer (in kcal). protein, carbs, and fat must be integers representing the absolute amount in grams. Provide your best numeric estimate. Do not use words or strings for these values.
         
         DESCRIPTION: "${userContext}"`
    
    const parts: any[] = [{ text: prompt }]
    if (finalBase64) {
      parts.unshift({ inlineData: { data: finalBase64, mimeType: finalMimeType } })
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts }
      ],
      config: {
        responseMimeType: "application/json",
      }
    })

    const text = response.text
    if (!text) {
        throw new Error("No response from AI")
    }
    
    const jsonResult = JSON.parse(text)

    return NextResponse.json(jsonResult)
  } catch (error: any) {
    console.error('Analyze Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
