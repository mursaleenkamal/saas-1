import { createAdminClient } from '@/lib/supabase/admin'
import AdminSupportClient from './AdminSupportClient'

export const revalidate = 0 // Always fetch live tickets

export default async function AdminSupportPage() {
  const supabase = createAdminClient()

  // Fetch support tickets with gym info
  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select('*, gyms(id, name, phone, owner_id)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching admin tickets:', error)
  }

  const formattedTickets = (tickets ?? []).map((t: any) => ({
    id: t.id,
    gym_id: t.gym_id,
    subject: t.subject,
    message: t.message,
    type: t.type || 'query',
    status: t.status || 'open',
    created_at: t.created_at,
    resolved_at: t.resolved_at,
    is_cleared_by_admin: t.is_cleared_by_admin || false,
    gym: Array.isArray(t.gyms) ? t.gyms[0] : (t.gyms || null),
  }))

  return <AdminSupportClient initialTickets={formattedTickets} />
}
