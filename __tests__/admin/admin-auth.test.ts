import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { verifySuperAdmin, DEFAULT_ADMIN_EMAIL } from '@/lib/admin-auth'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

describe('Admin Authentication (verifySuperAdmin)', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'super_secret_test_password'
    process.env.ADMIN_EMAIL = 'admin@gymflow.sbs'
    vi.clearAllMocks()
  })

  it('authorizes request when Bearer token matches ADMIN_PASSWORD', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/settings', {
      headers: {
        Authorization: 'Bearer super_secret_test_password',
      },
    })

    const isAuthorized = await verifySuperAdmin(req)
    expect(isAuthorized).toBe(true)
  })

  it('rejects request when Bearer token is invalid', async () => {
    // When bearer token is wrong and no valid session exists, must return false
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
      },
    })

    const req = new NextRequest('http://localhost:3000/api/admin/settings', {
      headers: {
        Authorization: 'Bearer wrong_password',
      },
    })

    const isAuthorized = await verifySuperAdmin(req)
    expect(isAuthorized).toBe(false)
  })

  it('authorizes request when session cookie matches ADMIN_EMAIL', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'admin@gymflow.sbs' } },
          error: null,
        }),
      },
    })

    const req = new NextRequest('http://localhost:3000/api/admin/settings')
    const isAuthorized = await verifySuperAdmin(req)
    expect(isAuthorized).toBe(true)
  })

  it('rejects session cookie if email does not match ADMIN_EMAIL', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'gymowner@example.com' } },
          error: null,
        }),
      },
    })

    const req = new NextRequest('http://localhost:3000/api/admin/settings')
    const isAuthorized = await verifySuperAdmin(req)
    expect(isAuthorized).toBe(false)
  })
})
