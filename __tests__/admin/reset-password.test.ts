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
import { POST } from '@/app/api/gyms/reset-password/route'

describe('Admin Password Reset API (/api/gyms/reset-password)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized caller with 401', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(false)

    const req = new NextRequest('http://localhost:3000/api/gyms/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', password: 'Password123!' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects weak passwords failing security criteria (e.g. no special char or too short)', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    // Short password
    const req1 = new NextRequest('http://localhost:3000/api/gyms/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', password: 'Short1!' }),
    })
    const res1 = await POST(req1)
    expect(res1.status).toBe(422)
    const data1 = await res1.json()
    expect(data1.error).toContain('8 characters')

    // Missing special character
    const req2 = new NextRequest('http://localhost:3000/api/gyms/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', password: 'Password123' }),
    })
    const res2 = await POST(req2)
    expect(res2.status).toBe(422)
    const data2 = await res2.json()
    expect(data2.error).toContain('special character')
  })

  it('successfully updates user password with valid criteria', async () => {
    ;(verifySuperAdmin as any).mockResolvedValue(true)

    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as any).mockReturnValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    })

    const req = new NextRequest('http://localhost:3000/api/gyms/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-valid', password: 'StrongPassword123!' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-valid', { password: 'StrongPassword123!' })
  })
})
