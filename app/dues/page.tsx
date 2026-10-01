import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getGym } from '@/lib/dal'
import { DuesClient } from './DuesClient'
import { getMemberStatus } from '@/lib/utils'
import { deleteCache } from '@/lib/cache'
import { cacheKeys } from '@/lib/cache-keys'

export const dynamic = 'force-dynamic'

export default async function DuesPage() {
  const { user } = await getAuthUser()
  if (!user) return null

  const { gym } = await getGym(user.id)
  if (!gym) {
    return (
      <div className="card p-12 text-center text-slate-500">
        No gym profile found. Please contact support.
      </div>
    )
  }

  // Clear any legacy stale Redis cache
  deleteCache(cacheKeys.duesList(gym.id)).catch(() => {})

  const supabase = await createClient()

  // 1. Fetch all members with outstanding dues for this gym
  const { data: members, error } = await supabase
    .from('members')
    .select('id, name, phone, member_number, pending_amount')
    .eq('gym_id', gym.id)
    .gt('pending_amount', 0)
    .order('pending_amount', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[DuesPage] Error fetching due members from database:', error)
  }

  const rawMembers = members ?? []
  const memberIds = rawMembers.map((m: any) => m.id)

  // 2. Fetch latest membership end_dates separately to determine status reliably
  const statusMap = new Map<string, string>()
  if (memberIds.length > 0) {
    try {
      const { data: memberships } = await supabase
        .from('memberships')
        .select('member_id, end_date')
        .in('member_id', memberIds)
        .order('created_at', { ascending: false })

      for (const ms of memberships ?? []) {
        if (!statusMap.has(ms.member_id) && ms.end_date) {
          statusMap.set(ms.member_id, getMemberStatus(ms.end_date))
        }
      }
    } catch (e) {
      console.warn('[DuesPage] Failed to fetch memberships for dues status:', e)
    }
  }

  const dueMembers = rawMembers.map((m: any) => ({
    id: m.id,
    name: m.name,
    phone: m.phone || '',
    member_number: m.member_number,
    pending_amount: Number(m.pending_amount) || 0,
    status: statusMap.get(m.id) || 'expired',
  }))

  const totalDues = dueMembers.reduce((s: number, m: any) => s + m.pending_amount, 0)

  return <DuesClient members={dueMembers} gymId={gym.id} totalDues={totalDues} />
}

