import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/utils/supabase/server'

// Polyfill for Request if running in a Node environment where it is not globally defined
if (typeof (global as any).Request === 'undefined') {
  (global as any).Request = jest.fn().mockImplementation((input: any, init?: any) => ({
    url: typeof input === 'string' ? input : input.url,
    json: async () => (init?.body ? JSON.parse(init.body) : {}),
    method: init?.method || 'GET',
    headers: new Map(Object.entries(init?.headers || {}))
  }))
}

// Global mock for generateContent that can be used across tests
const mockGenerateContent = jest.fn()

// Use doMock to avoid hoisting issues
jest.doMock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent
    },
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent
    })
  }))
}))

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn()
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockReturnValue({
    get: jest.fn()
  })
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
  },
  NextRequest: jest.fn().mockImplementation((input, init) => ({
    json: async () => (init?.body ? JSON.parse(init.body) : {}),
  })),
}))

describe('Analysis API POST Handler', () => {
  let POST: any

  beforeAll(async () => {
    // Dynamic import to ensure mocks are respected
    const route = await import('./route')
    POST = route.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { gemini_api_key: 'user-key' }, error: null })
          })
        })
      })
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  it('analyzes image successfully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        foodItems: ['Test Food'],
        estimatedCalories: 500,
        macronutrients: { protein: 20, carbs: 50, fat: 10 },
        description: 'A test meal'
      })
    })

    const req = {
      json: async () => ({
        base64Image: 'base64data',
        imageUrl: 'http://example.com/image.jpg'
      })
    } as unknown as Request

    const response = await POST(req)
    const data = await response.json()

    expect(data.estimatedCalories).toBe(500)
    expect(mockGenerateContent).toHaveBeenCalled()
  })

  it('analyzes text-only successfully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        foodItems: ['Banana'],
        estimatedCalories: 100,
        macronutrients: { protein: 1, carbs: 23, fat: 0 },
        description: 'A banana'
      })
    })

    const req = {
      json: async () => ({
        userContext: 'I ate a banana'
      })
    } as unknown as Request

    const response = await POST(req)
    const data = await response.json()

    expect(data.estimatedCalories).toBe(100)
    expect(data.foodItems).toContain('Banana')
  })

  it('returns error if no content provided', async () => {
    const req = {
      json: async () => ({})
    } as unknown as Request

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})
