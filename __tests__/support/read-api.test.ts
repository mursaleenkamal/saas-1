import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  ROUTE_LIMITS: { DEFAULT: { limit: 100, windowSeconds: 60 } },
}))

vi.mock('@/lib/cache', () => ({
  deleteCache: vi.fn().mockResolvedValue(undefined),
}))

import { createClient } from '@/lib/supabase/server'
import { deleteCache } from '@/lib/cache'
import { POST } from '@/app/api/support/read/route'

describe('Support Read API (/api/support/read)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized request with 401', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const req = new NextRequest('http://localhost:3000/api/support/read', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects request with 400 when neither messageId nor markAll provided', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'gyms') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'gym-1' } }),
              }),
            }),
          }
        }
        return {}
      }),
    })

    const req = new NextRequest('http://localhost:3000/api/support/read', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('required')
  })

  it('marks a single message as read and clears cache', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'gyms') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'gym-1' } }),
              }),
            }),
          }
        }
        if (table === 'admin_messages') {
          return {
            update: mockUpdate,
          }
        }
        return {}
      }),
    })

    const req = new NextRequest('http://localhost:3000/api/support/read', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-123' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(deleteCache).toHaveBeenCalledWith('unread_count:gym-1')
  })

  it('marks all messages as read when markAll is true', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'gyms') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'gym-1' } }),
              }),
            }),
          }
        }
        if (table === 'admin_messages') {
          return {
            update: mockUpdate,
          }
        }
        return {}
      }),
    })

    const req = new NextRequest('http://localhost:3000/api/support/read', {
      method: 'POST',
      body: JSON.stringify({ markAll: true }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(deleteCache).toHaveBeenCalledWith('unread_count:gym-1')
  })
})
