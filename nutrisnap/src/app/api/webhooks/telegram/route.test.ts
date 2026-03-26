jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any) => ({ json: async () => body })
  }
}))

import { POST } from './route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

// Mock global fetch
global.fetch = jest.fn()

describe('Telegram Webhook POST Handler', () => {
    let mockSingle: jest.Mock
    let mockEqForUpdate: jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.TELEGRAM_BOT_TOKEN = 'test-token'
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'test-url'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

        // Set URL-aware fetch mock
        ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('api.telegram.org')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ ok: true })
                })
            }
            if (url.includes('generativelanguage.googleapis.com')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        candidates: [{
                            content: {
                                parts: [{
                                    text: JSON.stringify({
                                        foodItems: ['Test Food'],
                                        estimatedCalories: 100,
                                        macronutrients: { protein: 5, carbs: 20, fat: 2 },
                                        description: 'Mocked meal'
                                    })
                                }]
                            }
                        }]
                    })
                })
            }
            return Promise.reject(new Error(`Unhandled fetch call to: ${url}`))
        })

        mockSingle = jest.fn()
        mockEqForUpdate = jest.fn().mockResolvedValue({ error: null })

        const mockSupabase = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: mockSingle
                    })
                }),
                update: jest.fn().mockReturnValue({
                    eq: mockEqForUpdate
                }),
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { id: 'meal-123' }, error: null })
                    })
                })
            })
        };
        (createClient as jest.Mock).mockReturnValue(mockSupabase)
    })

    const createMockRequest = (body: any) => {
        return { json: jest.fn().mockResolvedValue(body) } as unknown as Request
    }

    it('returns ok:false for malformed JSON payloads to silence broken bots', async () => {
        const req = { json: jest.fn().mockRejectedValue(new Error('bad json')) } as unknown as Request
        const res = await POST(req)
        const data = await res.json()
        expect(data).toEqual({ ok: false })
    })

    it('returns ok:true immediately if there is no message block', async () => {
        const req = createMockRequest({ update_id: 123 })
        const res = await POST(req)
        const data = await res.json()
        expect(data).toEqual({ ok: true })
    })

    it('handles /connect successful pairing scenario seamlessly', async () => {
        mockSingle.mockResolvedValueOnce({ data: { id: 'user-123' } }) 
        mockEqForUpdate.mockResolvedValueOnce({ error: null }) 

        const req = createMockRequest({
            message: { chat: { id: 999 }, text: '/connect 123456' }
        })
        
        await POST(req)

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottest-token/sendMessage',
            expect.objectContaining({
                body: expect.stringContaining('Erfolgreich verknüpft')
            })
        )
    })

    it('rejects /connect with a failed or expired code', async () => {
        mockSingle.mockResolvedValueOnce({ data: null }) 

        const req = createMockRequest({
            message: { chat: { id: 999 }, text: '/connect 999999' }
        })
        
        await POST(req)

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottest-token/sendMessage',
            expect.objectContaining({
                body: expect.stringContaining('Ungültiger oder abgelaufener')
            })
        )
    })

    it('rejects unlinked or anonymous users sending normal strings', async () => {
        mockSingle.mockResolvedValueOnce({ data: null }) 

        const req = createMockRequest({
            message: { chat: { id: 999 }, text: 'Hello bot' }
        })
        
        await POST(req)

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottest-token/sendMessage',
            expect.objectContaining({
                body: expect.stringContaining('noch nicht mit NutriSnap verknüpft')
            })
        )
    })

    it('processes text-only meal tracking for linked users', async () => {
        mockSingle.mockResolvedValueOnce({ data: { id: 'user-123', gemini_api_key: 'user-key' } }) // Link check
        
        // Mock Gemini API response
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            json: async () => ({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify({
                                foodItems: ['Apfel'],
                                estimatedCalories: 95,
                                macronutrients: { protein: 0, carbs: 25, fat: 0 },
                                description: 'Ein frischer Apfel'
                            })
                        }]
                    }
                }]
            })
        })

        const req = createMockRequest({
            message: { chat: { id: 999 }, text: 'Ich habe einen Apfel gegessen' }
        })
        
        await POST(req)

        // Verify Gemini fetch was called with 2.5-flash
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('gemini-2.5-flash'),
            expect.objectContaining({ method: 'POST' })
        )

        // Verify Telegram reply
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('sendMessage'),
            expect.objectContaining({
                body: expect.stringContaining('100 kcal')
            })
        )
    })
})
