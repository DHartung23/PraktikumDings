jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any) => ({ json: async () => body })
  }
}))

import { POST } from './route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase globally
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

global.fetch = jest.fn()

describe('LINE Webhook POST Handler', () => {
    let mockSingle: jest.Mock
    let mockEqForUpdate: jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-line-token'
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'test-url'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

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
                })
            })
        };
        (createClient as jest.Mock).mockReturnValue(mockSupabase)
    })

    const createMockRequest = (body: any) => {
        return { json: jest.fn().mockResolvedValue(body) } as unknown as Request
    }

    it('returns ok:true immediately if there are no events', async () => {
        const req = createMockRequest({ events: [] })
        const res = await POST(req)
        const data = await res.json()
        expect(data).toEqual({ ok: true })
    })

    it('rejects /connect with invalid code through Reply API', async () => {
        mockSingle.mockResolvedValueOnce({ data: null }) 

        const req = createMockRequest({
            events: [{
                type: 'message',
                message: { type: 'text', text: '/connect xyz' },
                source: { userId: 'line-123' },
                replyToken: 'reply-token-abc'
            }]
        })
        
        await POST(req)

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.line.me/v2/bot/message/reply',
            expect.objectContaining({
                body: expect.stringContaining('Ungültiger oder abgelaufener')
            })
        )
    })

    it('pairs line accounts successfully upon valid code submission', async () => {
        mockSingle.mockResolvedValueOnce({ data: { id: 'user-777' } }) 
        mockEqForUpdate.mockResolvedValueOnce({ error: null }) 

        const req = createMockRequest({
            events: [{
                type: 'message',
                message: { type: 'text', text: '/connect 555555' },
                source: { userId: 'line-123' },
                replyToken: 'reply-token-abc'
            }]
        })
        
        await POST(req)

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.line.me/v2/bot/message/reply',
            expect.objectContaining({
                body: expect.stringContaining('Erfolgreich verknüpft')
            })
        )
    })
})
