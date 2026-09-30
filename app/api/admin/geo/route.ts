import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/geo
 * Returns pending items in geo_review_queue and learned aliases.
 */
export async function GET(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const [queueRes, aliasesRes] = await Promise.all([
      supabase
        .from('geo_review_queue')
        .select('*, gyms(id, name)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('geo_gym_aliases')
        .select('*, gyms(id, name)')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (queueRes.error) throw queueRes.error

    return NextResponse.json({
      queue: queueRes.data || [],
      aliases: aliasesRes.data || [],
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch geo data' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/geo
 * Resolves or dismisses a pending geo review item.
 * Body: { id: string, action: 'resolve' | 'dismiss', resolved_to?: string }
 */
export async function PATCH(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id, action, resolved_to } = body

    if (!id || !['resolve', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch item to get gym_id and raw_input
    const { data: item, error: fetchErr } = await supabase
      .from('geo_review_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const finalResolvedTo = resolved_to?.trim() || item.top_suggestion || item.raw_input

    // 2. Update queue record
    const { error: updateErr } = await supabase
      .from('geo_review_queue')
      .update({
        status: action === 'resolve' ? 'resolved' : 'dismissed',
        resolved_to: action === 'resolve' ? finalResolvedTo : null,
        resolved_at: now,
      })
      .eq('id', id)

    if (updateErr) throw updateErr

    // 3. If resolved and has gym_id, store learned alias for this gym so it auto-matches in future
    if (action === 'resolve' && item.gym_id && finalResolvedTo) {
      try {
        const normAlias = item.raw_input.toLowerCase().trim().replace(/\s+/g, ' ')
        await supabase.from('geo_gym_aliases').upsert(
          {
            gym_id: item.gym_id,
            alias_raw: item.raw_input,
            alias_normalized: normAlias,
            canonical_name: finalResolvedTo,
            updated_at: now,
          },
          { onConflict: 'alias_normalized,gym_id' }
        )
      } catch (aliasErr) {
        console.warn('Could not store geo_gym_alias:', aliasErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update review item' },
      { status: 500 }
    )
  }
}
