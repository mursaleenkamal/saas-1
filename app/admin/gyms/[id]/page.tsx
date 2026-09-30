import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import GymDetailClient from './GymDetailClient'

export const dynamic = 'force-dynamic'

export default async function AdminGymDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const supabase = createAdminClient()

  // 1. Fetch gym data
  const { data: gym, error } = await supabase
    .from('gyms')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !gym) {
    notFound()
  }

  // 2. Fetch owner details from auth admin
  let owner = null
  if (gym.owner_id) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(gym.owner_id)
      if (userData?.user) {
        owner = {
          id: userData.user.id,
          email: userData.user.email,
          created_at: userData.user.created_at,
          last_sign_in_at: userData.user.last_sign_in_at,
        }
      }
    } catch {
      // Ignored if user not found
    }
  }

  // 3. Fetch gym metrics
  const today = new Date().toISOString().split('T')[0]
  const [
    { count: totalMembers },
    { count: activeMemberships },
    { count: pendingDues },
    { count: todayAttendance },
    recentMembersRes,
    recentTicketsRes,
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', id),
    supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('gym_id', id).eq('status', 'active'),
    supabase.from('due_payments').select('*', { count: 'exact', head: true }).eq('gym_id', id).eq('status', 'pending'),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('gym_id', id).gte('check_in_time', `${today}T00:00:00`),
    supabase.from('members').select('id, name, phone, created_at').eq('gym_id', id).order('created_at', { ascending: false }).limit(6),
    supabase.from('support_tickets').select('id, subject, status, created_at').eq('gym_id', id).order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <GymDetailClient
      gym={gym}
      owner={owner}
      stats={{
        totalMembers: totalMembers ?? 0,
        activeMemberships: activeMemberships ?? 0,
        pendingDues: pendingDues ?? 0,
        todayAttendance: todayAttendance ?? 0,
      }}
      recentMembers={recentMembersRes.data || []}
      recentTickets={recentTicketsRes.data || []}
    />
  )
}
