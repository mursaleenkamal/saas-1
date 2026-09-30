import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySuperAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/support/tickets
 * Returns all support tickets ordered by created_at DESC with gym details.
 */
export async function GET(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*, gyms(id, name, phone, owner_id)')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ tickets })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/support/tickets
 * Resolves or updates a support ticket and notifies the gym owner.
 *
 * Body: { ticketId: string, status: 'resolved' | 'open', replySubject?: string, replyMessage?: string }
 */
export async function PATCH(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { ticketId, status = 'resolved', replySubject, replyMessage } = body

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch ticket details to identify gym_id
    const { data: ticket, error: fetchError } = await supabase
      .from('support_tickets')
      .select('id, gym_id, subject, status')
      .eq('id', ticketId)
      .single()

    if (fetchError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    // 2. Update ticket status
    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({
        status,
        resolved_at: status === 'resolved' ? now : null,
      })
      .eq('id', ticketId)

    if (updateError) throw updateError

    // 3. If a reply message was provided and resolving, send admin notification to gym owner
    if (status === 'resolved' && replyMessage && ticket.gym_id) {
      try {
        await supabase.from('admin_messages').insert({
          gym_id: ticket.gym_id,
          subject: replySubject || `Resolution: ${ticket.subject}`,
          body: replyMessage,
          type: 'success',
          sent_by: 'super_admin',
        })
      } catch (msgErr) {
        console.warn('Could not insert admin_message reply:', msgErr)
      }
    }

    // 4. Realtime broadcast notification
    try {
      await supabase.channel(`gym_support_realtime_${ticket.gym_id}`).send({
        type: 'broadcast',
        event: 'ticket_update',
        payload: { id: ticketId, status, timestamp: now },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update ticket' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/support/tickets
 * Soft deletes/clears a ticket or all resolved tickets.
 */
export async function DELETE(req: NextRequest) {
  const isAuthorized = await verifySuperAdmin(req)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const ticketId = searchParams.get('ticketId')
    const clearResolved = searchParams.get('clearResolved') === 'true'

    const supabase = createAdminClient()

    if (ticketId) {
      const { error } = await supabase
        .from('support_tickets')
        .update({ is_cleared_by_admin: true })
        .eq('id', ticketId)
      if (error) throw error
    } else if (clearResolved) {
      const { error } = await supabase
        .from('support_tickets')
        .update({ is_cleared_by_admin: true })
        .eq('status', 'resolved')
      if (error) throw error
    } else {
      return NextResponse.json({ error: 'Invalid delete request' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to clear tickets' },
      { status: 500 }
    )
  }
}
