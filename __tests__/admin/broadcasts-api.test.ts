import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/admin-auth', () => ({
  verifySuperAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { verifySuperAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET, POST, DELETE } from '@/app/api/admin/broadcasts/route'

describe('Admin Broadcasts API (/api/admin/broadcasts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET rejects unauthorized request with 401', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(false)

    const req = new NextRequest('http://localhost:3000/api/admin/broadcasts')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('POST rejects empty subject or body with 400', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    const req = new NextRequest('http://localhost:3000/api/admin/broadcasts', {
      method: 'POST',
      body: JSON.stringify({ subject: '', body: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('required')
  })

  it('POST dispatches broadcast to all gyms when targetGymId is "all"', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    const mockGyms = [{ id: 'gym-1' }, { id: 'gym-2' }]
    const mockChannel = {
      send: vi.fn().mockResolvedValue(undefined),
    }

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'msg-1' }, { id: 'msg-2' }],
        error: null,
      }),
    })

    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'gyms') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockGyms, error: null }),
          }
        }
        if (table === 'admin_messages') {
          return {
            insert: mockInsert,
          }
        }
        return {}
      }),
      channel: vi.fn().mockReturnValue(mockChannel),
    })

    const req = new NextRequest('http://localhost:3000/api/admin/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        targetGymId: 'all',
        subject: 'Scheduled Maintenance',
        body: 'System will be updated at midnight.',
        type: 'warning',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.recipientsCount).toBe(2)
  })

  it('DELETE soft-deletes message with valid ID', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    })

    const req = new NextRequest('http://localhost:3000/api/admin/broadcasts?id=msg-123', {
      method: 'DELETE',
    })

    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
