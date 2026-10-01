import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, ROUTE_LIMITS } from '@/lib/rateLimit'
import { deleteCache } from '@/lib/cache'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { allowed } = await checkRateLimit(user.id, 'support_read', ROUTE_LIMITS.DEFAULT)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Verify gym ownership
    const { data: gym } = await supabase
      .from('gyms')
      .select('id')
      .eq('owner_id', user.id)
      .single()
    if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })

    const { messageId, markAll } = await req.json().catch(() => ({}))

    const now = new Date().toISOString()

    if (markAll) {
      const { error } = await supabase
        .from('admin_messages')
        .update({ read_at: now })
        .eq('gym_id', gym.id)
        .is('read_at', null)
      if (error) throw error
    } else if (messageId) {
      const { error } = await supabase
        .from('admin_messages')
        .update({ read_at: now })
        .eq('id', messageId)
        .eq('gym_id', gym.id)
      if (error) throw error
    } else {
      return NextResponse.json({ error: 'messageId or markAll is required' }, { status: 400 })
    }

    // Invalidate Redis/DAL cache
    await deleteCache(`unread_count:${gym.id}`)

    return NextResponse.json({ success: true, read_at: now })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to mark message as read' }, { status: 500 })
  }
}
