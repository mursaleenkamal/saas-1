import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/settings
 * Returns platform settings (subscription prices, UPI payment config, etc.)
 */
export async function GET(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (error) throw error

    // Fallback defaults if row doesn't exist yet
    const settings = data || {
      id: 1,
      upi_id: 'gymflow@upi',
      upi_name: 'GymFlow Platform',
      price_monthly: 2999,
      price_yearly: 29999,
    }

    return NextResponse.json({ settings })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/settings
 * Updates platform settings (prices, payment details)
 */
export async function PATCH(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { price_monthly, price_yearly, upi_id, upi_name } = body

    const updates: Record<string, any> = {}
    if (price_monthly !== undefined) {
      const pm = Number(price_monthly)
      if (isNaN(pm) || pm < 0) {
        return NextResponse.json({ error: 'Monthly price must be a positive number' }, { status: 400 })
      }
      updates.price_monthly = pm
    }

    if (price_yearly !== undefined) {
      const py = Number(price_yearly)
      if (isNaN(py) || py < 0) {
        return NextResponse.json({ error: 'Yearly price must be a positive number' }, { status: 400 })
      }
      updates.price_yearly = py
    }

    if (upi_id !== undefined) updates.upi_id = String(upi_id).trim()
    if (upi_name !== undefined) updates.upi_name = String(upi_name).trim()

    const supabase = createAdminClient()

    // Upsert into platform_settings row id=1
    const { data, error } = await supabase
      .from('platform_settings')
      .upsert({ id: 1, ...updates })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, settings: data })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update settings' },
      { status: 500 }
    )
  }
}
