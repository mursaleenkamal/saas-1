import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySuperAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/broadcasts
 * Returns sent super admin messages with gym details.
 */
export async function GET(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data: messages, error } = await supabase
      .from('admin_messages')
      .select('*, gyms(id, name, phone)')
      .eq('is_cleared_by_admin', false)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ messages: messages || [] })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch broadcasts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/broadcasts
 * Broadcasts an announcement or alert to ALL gyms or a specific gym.
 * Body: { targetGymId?: 'all' | string, subject: string, body: string, type?: 'info' | 'warning' | 'error' | 'success' }
 */
export async function POST(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await req.json()
    const { targetGymId = 'all', subject, body, type = 'info' } = payload

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: 'Subject and message body are required' },
        { status: 400 }
      )
    }

    const validTypes = ['info', 'warning', 'error', 'success']
    const messageType = validTypes.includes(type) ? type : 'info'

    const supabase = createAdminClient()

    let targetGymIds: string[] = []

    if (targetGymId === 'all') {
      const { data: gyms, error: gymErr } = await supabase
        .from('gyms')
        .select('id')
      if (gymErr) throw gymErr
      targetGymIds = (gyms || []).map((g: any) => g.id)
    } else {
      targetGymIds = [targetGymId]
    }

    if (targetGymIds.length === 0) {
      return NextResponse.json({ error: 'No recipient gyms found' }, { status: 400 })
    }

    const rowsToInsert = targetGymIds.map(gymId => ({
      gym_id: gymId,
      subject: subject.trim(),
      body: body.trim(),
      type: messageType,
      sent_by: 'super_admin',
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('admin_messages')
      .insert(rowsToInsert)
      .select('id')

    if (insertError) throw insertError

    // Dispatch realtime broadcast event to notify connected clients
    for (const gymId of targetGymIds) {
      try {
        await supabase.channel(`gym_support_realtime_${gymId}`).send({
          type: 'broadcast',
          event: 'new_admin_message',
          payload: { subject, type: messageType },
        })
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({
      success: true,
      recipientsCount: targetGymIds.length,
      insertedCount: inserted?.length || targetGymIds.length,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch broadcast' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/broadcasts
 * Soft-deletes a message from super admin view by message ID.
 */
export async function DELETE(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('admin_messages')
      .update({ is_cleared_by_admin: true })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete message' },
      { status: 500 }
    )
  }
}
