import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySuperAdmin } from '@/lib/admin-auth'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const isAuthorized = await verifySuperAdmin(req)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscription_status, plan_type, trial_ends_at, subscription_ends_at } = await req.json()

    const supabase = createAdminClient()


    const updates: any = {}
    if (subscription_status !== undefined) updates.subscription_status = subscription_status
    if (plan_type !== undefined) updates.plan_type = plan_type
    
    // Convert empty strings back to null for dates
    if (trial_ends_at !== undefined) updates.trial_ends_at = trial_ends_at || null
    if (subscription_ends_at !== undefined) updates.subscription_ends_at = subscription_ends_at || null

    const { data: gym, error } = await supabase
      .from('gyms')
      .update(updates)
      .eq('id', params.id)
      .select('owner_id')
      .single()

    if (error) throw error

    if (gym?.owner_id) {
      const { deleteCache } = await import('@/lib/cache')
      await deleteCache(`user:${gym.owner_id}:gym`)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
