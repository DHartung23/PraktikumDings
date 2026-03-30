import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GEMINI_MODEL, GEMINI_API_BASE } from '@/utils/ai-config'

export async function POST(req: Request) {
   let body;
   try { body = await req.json() } catch { return NextResponse.json({ ok: false }) }
   
   const events = body.events || []
   if (events.length === 0) return NextResponse.json({ ok: true })
   
   const event = events[0]
   const userId = event.source?.userId
   const replyToken = event.replyToken
   const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
   
   if (!userId || !replyToken || !TOKEN) return NextResponse.json({ ok: true })

   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
   const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   const supabase = createClient(supabaseUrl, supabaseKey)
   
   const replyMsg = async (msg: string) => {
      await fetch('https://api.line.me/v2/bot/message/reply', {
         method: 'POST', 
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
         },
         body: JSON.stringify({
             replyToken: replyToken,
             messages: [{ type: 'text', text: msg }]
         })
      })
   }

   // 1. Connection Verification Flow
   if (event.message?.type === 'text') {
      const text = event.message.text
      if (text.startsWith('/connect')) {
         const code = text.split(' ')[1]
         if (!code) {
            await replyMsg('Bitte sende den Code im Format: /connect 123456')
            return NextResponse.json({ ok: true })
         }
         
         const { data: profile } = await supabase.from('profiles').select('id').eq('connection_code', code).single()
         if (!profile) {
            await replyMsg('Ungültiger oder abgelaufener Code.')
            return NextResponse.json({ ok: true })
         }
         
         await supabase.from('profiles').update({ line_user_id: userId, connection_code: null }).eq('id', profile.id)
         await replyMsg('✅ Erfolgreich verknüpft! Du kannst mir jetzt jederzeit ein Foto von deinem Essen schicken.')
         return NextResponse.json({ ok: true })
      }
      
      await replyMsg('Schick mir einfach ein Foto deines Essens!')
      return NextResponse.json({ ok: true })
   }

   // Gatekeeper
   const { data: profile } = await supabase.from('profiles').select('id').eq('line_user_id', userId).single()
   if (!profile) {
      await replyMsg('Dieser Chat ist noch nicht verknüpft. Generiere einen Code im Web-Profil und sende: /connect [code].')
      return NextResponse.json({ ok: true })
   }
   
   const user_id = profile.id

   // 2. Incoming Image Flow
   if (event.message?.type === 'image') {
       await replyMsg('📸 Bild empfangen! (Wird auf NutriSnap Servern verarbeitet...)')
       
       const messageId = event.message.id
       try {
           // Get binary image data from LINE API
           const imgRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
               headers: { 'Authorization': `Bearer ${TOKEN}` }
           })
           const imgBuffer = await imgRes.arrayBuffer()
           
           // Upload securely to Supabase Storage
           const fileName = `${user_id}/${Date.now()}.jpg`
           const { error: uploadError } = await supabase.storage.from('food-images').upload(fileName, imgBuffer, { contentType: 'image/jpeg' })
           if (uploadError) throw uploadError
           
           const publicUrl = `${supabaseUrl}/storage/v1/object/public/food-images/${fileName}`
           
           // Upsert abstract meal row 
           const { data: insertedMeal, error: insertError } = await supabase.from('meals').insert({ user_id, image_url: publicUrl }).select('id').single()
           if (insertError) throw insertError
           
           const geminiKey = process.env.GEMINI_API_KEY
           if (geminiKey) {
             const base64Image = Buffer.from(imgBuffer).toString('base64')
             const jsonSchema = `{"foodItems":["string"],"estimatedCalories":0,"description":"string","macronutrients":{"protein":0,"carbs":0,"fat":0}}`
             const prompt = `Analyze this food image and provide a nutritional breakdown. Respond entirely in German. Return ONLY a raw JSON object matching this exact schema: ${jsonSchema}. Rules: foodItems=array of food names, estimatedCalories=integer kcal, description=short German description, macronutrients.protein/carbs/fat=integer grams never null.`
             
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
                 // NOTE: Since the replyToken might expire while Gemini thinks, the push message API is technically better for LINE, but requires explicit push privileges.
             }
           }
       } catch (error: any) {
           console.error(error)
       }
   }

   return NextResponse.json({ ok: true })
}
