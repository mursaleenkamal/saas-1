import { createAdminClient } from '@/lib/supabase/admin'
import BroadcastsClient from './BroadcastsClient'

export const dynamic = 'force-dynamic'

export default async function AdminBroadcastsPage() {
  const supabase = createAdminClient()

  const [gymsRes, messagesRes] = await Promise.all([
    supabase.from('gyms').select('id, name').order('name'),
    supabase
      .from('admin_messages')
      .select('*, gyms(id, name, phone)')
      .eq('is_cleared_by_admin', false)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <BroadcastsClient
      gyms={gymsRes.data || []}
      initialMessages={messagesRes.data || []}
    />
  )
}
