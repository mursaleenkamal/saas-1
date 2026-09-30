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
import { GET, PATCH } from '@/app/api/admin/settings/route'

describe('Admin Settings API (/api/admin/settings)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 when unauthorized', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(false)

    const req = new NextRequest('http://localhost:3000/api/admin/settings')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('GET returns platform settings when authorized', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    const mockSettings = {
      id: 1,
      upi_id: '03001234567',
      upi_name: 'GymFlow Pakistan',
      price_monthly: 2999,
      price_yearly: 29999,
    }

    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
          }),
        }),
      }),
    })

    const req = new NextRequest('http://localhost:3000/api/admin/settings')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.settings.price_monthly).toBe(2999)
    expect(body.settings.upi_name).toBe('GymFlow Pakistan')
  })

  it('PATCH rejects negative prices with 400', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    const req = new NextRequest('http://localhost:3000/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ price_monthly: -500 }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('positive number')
  })

  it('PATCH updates platform settings successfully', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    const updatedSettings = {
      id: 1,
      upi_id: '03119876543',
      upi_name: 'GymFlow HQ',
      price_monthly: 3500,
      price_yearly: 35000,
    }

    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedSettings, error: null }),
          }),
        }),
      }),
    })

    const req = new NextRequest('http://localhost:3000/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        price_monthly: 3500,
        price_yearly: 35000,
        upi_id: '03119876543',
        upi_name: 'GymFlow HQ',
      }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.settings.price_monthly).toBe(3500)
  })
})
