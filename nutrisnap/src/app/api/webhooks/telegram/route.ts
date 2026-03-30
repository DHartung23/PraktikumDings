import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GEMINI_MODEL, GEMINI_API_BASE } from '@/utils/ai-config'

export async function POST(req: Request) {
   let body;
   try { 
       body = await req.json() 
   } catch { 
       return NextResponse.json({ ok: false }) 
   }
   
   const message = body.message
   if (!message) return NextResponse.json({ ok: true })
   
   const chatId = message.chat.id
   const text = message.text || ''
   const TOKEN = process.env.TELEGRAM_BOT_TOKEN
   
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
   const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   const supabase = createClient(supabaseUrl, supabaseKey)
   
   const sendMsg = async (msg: string) => {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
         method: 'POST', 
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ chat_id: chatId, text: msg })
      })
   }

   // 1. Connection Verification Flow
   if (text.startsWith('/connect')) {
      const code = text.split(' ')[1]
      if (!code) {
         await sendMsg('Bitte sende den Code im Format: /connect 123456')
         return NextResponse.json({ ok: true })
      }
      
      const { data: profile } = await supabase.from('profiles').select('id').eq('connection_code', code).single()
      if (!profile) {
         await sendMsg('Ungültiger oder abgelaufener Code.')
         return NextResponse.json({ ok: true })
      }
      
      await supabase.from('profiles').update({ telegram_chat_id: String(chatId), connection_code: null }).eq('id', profile.id)
      await sendMsg('✅ Erfolgreich verknüpft! Du kannst mir jetzt jederzeit ein Foto von deinem Essen schicken.')
      return NextResponse.json({ ok: true })
   }
   
   // Gatekeeper: Check if messenger user is connected
   const { data: profile } = await supabase.from('profiles').select('id, gemini_api_key').eq('telegram_chat_id', String(chatId)).single()
   if (!profile) {
      await sendMsg('Dieser Chat ist noch nicht mit NutriSnap verknüpft. Bitte generiere einen Code in deinem Web-Profil und sende mir /connect [code].')
      return NextResponse.json({ ok: true })
   }

   const user_id = profile.id

   // 2. Incoming Image & AI Processing Flow
   if (message.photo && message.photo.length > 0) {
      const photoObj = message.photo[message.photo.length - 1] // highest res layer
      const fileId = photoObj.file_id
      
      await sendMsg('📸 Bild empfangen! Lade in NutriSnap hoch...')
      
      try {
         // Resolve telegram file path securely
         const fpRes = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`)
         const fpData = await fpRes.json()
         const filePath = fpData.result.file_path
         
         // Download strictly to array buffer memory footprint
         const imgRes = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${filePath}`)
         const imgBuffer = await imgRes.arrayBuffer()
         
         // Direct upload bypass utilizing Vercel function runtime limits
         const fileName = `${user_id}/${Date.now()}.jpg`
         const { error: uploadError } = await supabase.storage.from('food-images').upload(fileName, imgBuffer, { contentType: 'image/jpeg' })
         if (uploadError) throw uploadError
         
         const publicUrl = `${supabaseUrl}/storage/v1/object/public/food-images/${fileName}`
         
         // Upsert abstract meal row into main table
         const { data: insertedMeal, error: insertError } = await supabase.from('meals').insert({ user_id, image_url: publicUrl }).select('id').single()
         if (insertError) throw insertError
         
         // Append natural language instruction payloads if user bundled text
         const caption = message.caption || ''
         if (caption) {
            await supabase.from('meals').update({ user_comment: caption }).eq('id', insertedMeal.id)
         }
         
         await sendMsg('🕒 In der Datenbank gesichert! Analysiere Nährwerte über Vertex AI...')
         
         // Invoke Google Gemini remotely bypassing localhost origin domains
         const geminiKey = profile?.gemini_api_key || process.env.GEMINI_API_KEY
         if (!geminiKey) {
             await sendMsg('⚠️ Bild gespeichert! Für die automatische Analyse fehlt jedoch ein Gemini API Key (weder in deinem Profil noch auf dem Server hinterlegt).')
             return NextResponse.json({ ok: true })
         }

         const base64Image = Buffer.from(imgBuffer).toString('base64')
         const prompt = `
             Analyze this food image and provide a nutritional breakdown.
             Respond entirely in German.
             Return the output as a clean, raw JSON object.
             IMPORTANT: estimatedCalories must be an integer (in kcal). protein, carbs, and fat must be integers representing the absolute amount in grams. Provide your best numeric estimate. Do not use words or strings for these values.${caption ? `\nUSER INSTRUCTIONS FOR THIS MEAL: "${caption}". Please aggressively adjust your calculation based on exactly this context!` : ''}
         `
         const aiRes = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
               contents: [{ role: 'user', parts: [{ inlineData: { data: base64Image, mimeType: 'image/jpeg' } }, { text: prompt }] }],
               generationConfig: { responseMimeType: "application/json" }
            })
         })
         const aiData = await aiRes.json()
         const textOutput = aiData.candidates?.[0]?.content?.parts?.[0]?.text
         if (textOutput) {
             const jsonResult = JSON.parse(textOutput)
             await supabase.from('meals').update({ analysis_result: jsonResult }).eq('id', insertedMeal.id)
             await sendMsg(`✅ Analyse Abgeschlossen!\n\n🍴 ${jsonResult.foodItems?.join(', ') || 'Mahlzeit'}\n🔥 Kalorien: ${jsonResult.estimatedCalories} kcal\n🥩 Protein: ${jsonResult.macronutrients?.protein}g\n🍞 Carbs: ${jsonResult.macronutrients?.carbs}g\n🧈 Fett: ${jsonResult.macronutrients?.fat}g\n\n📝 ${jsonResult.description}`)
         }
         
      } catch (err: any) {
         console.error(err)
         await sendMsg(`❌ Ein interner Fehler ist aufgetreten: ${err.message}`)
      }
   } else {
       if (!text.startsWith('/')) {
           await sendMsg('📝 Text-Eintrag erkannt! Analysiere Nährwerte...')
           
           try {
               const geminiKey = profile?.gemini_api_key || process.env.GEMINI_API_KEY
               if (!geminiKey) {
                   await sendMsg('⚠️ Analysiere fehlgeschlagen! Für die automatische Analyse fehlt ein Gemini API Key.')
                   return NextResponse.json({ ok: true })
               }

               const prompt = `
                   Analyze this food description and provide a nutritional breakdown.
                   Respond entirely in German.
                   Return the output as a clean, raw JSON object.
                   IMPORTANT: estimatedCalories must be an integer (in kcal). protein, carbs, and fat must be integers representing the absolute amount in grams. Provide your best numeric estimate. Do not use words or strings for these values.
                   
                   MEAL DESCRIPTION: "${text}"
               `

               const aiRes = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`, {
                   method: 'POST',
                   headers: {'Content-Type': 'application/json'},
                   body: JSON.stringify({
                       contents: [{ role: 'user', parts: [{ text: prompt }] }],
                       generationConfig: { responseMimeType: "application/json" }
                   })
               })
               
               const aiData = await aiRes.json()
               const textOutput = aiData.candidates?.[0]?.content?.parts?.[0]?.text
               
               if (textOutput) {
                   const jsonResult = JSON.parse(textOutput)
                   
                   // Insert into meals table (no image)
                   const { data: insertedMeal, error: insertError } = await supabase.from('meals').insert({ 
                       user_id, 
                       user_comment: text,
                       analysis_result: jsonResult 
                   }).select('id').single()
                   
                   if (insertError) throw insertError
                   
                   await sendMsg(`✅ Text-Eintrag gespeichert!\n\n🍴 ${jsonResult.foodItems?.join(', ') || 'Mahlzeit'}\n🔥 Kalorien: ${jsonResult.estimatedCalories} kcal\n🥩 Protein: ${jsonResult.macronutrients?.protein}g\n🍞 Carbs: ${jsonResult.macronutrients?.carbs}g\n🧈 Fett: ${jsonResult.macronutrients?.fat}g\n\n📝 ${jsonResult.description}`)
               }
           } catch (err: any) {
               console.error(err)
               await sendMsg(`❌ Ein interner Fehler ist aufgetreten: ${err.message}`)
           }
       }
   }

   return NextResponse.json({ ok: true })
}
