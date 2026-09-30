import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/logs
 * Returns recent platform audit logs and system events.
 */
export async function GET(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // 1. Fetch subscription audit logs
    const auditRes = await supabase
      .from('subscription_audit_logs')
      .select('*, gyms(id, name)')
      .order('created_at', { ascending: false })
      .limit(50)

    // 2. Fetch reviewed subscription requests
    const requestsRes = await supabase
      .from('subscription_requests')
      .select('id, gym_id, status, plan_type, reviewed_at, reviewed_by, rejection_reason, gyms(id, name)')
      .not('reviewed_at', 'is', null)
      .order('reviewed_at', { ascending: false })
      .limit(30)

    // Combine and unify into a chronological feed
    const events: Array<{
      id: string
      type: 'audit' | 'subscription_decision'
      title: string
      description: string
      gymName: string
      timestamp: string
      actor: string
      badge: string
    }> = []

    if (auditRes.data) {
      for (const a of auditRes.data) {
        events.push({
          id: a.id,
          type: 'audit',
          title: `Subscription ${a.action || 'Updated'}`,
          description: a.notes || `Status: ${a.prev_status || 'none'} → ${a.new_status || 'active'}, Plan: ${a.new_plan || 'N/A'}`,
          gymName: a.gyms?.name || 'Unknown Gym',
          timestamp: a.created_at,
          actor: a.performed_by || 'Super Admin',
          badge: a.action || 'audit',
        })
      }
    }

    if (requestsRes.data) {
      for (const r of requestsRes.data) {
        events.push({
          id: r.id,
          type: 'subscription_decision',
          title: `Request ${r.status === 'approved' ? 'Approved' : 'Rejected'}`,
          description:
            r.status === 'approved'
              ? `Approved for ${r.plan_type || 'monthly'} plan`
              : `Reason: ${r.rejection_reason || 'Payment proof verification failed'}`,
          gymName: (r.gyms as any)?.name || 'Unknown Gym',
          timestamp: r.reviewed_at!,
          actor: r.reviewed_by || 'Admin',
          badge: r.status,
        })
      }
    }

    // Sort descending by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ events })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}
