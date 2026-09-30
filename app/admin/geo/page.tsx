import { createAdminClient } from '@/lib/supabase/admin'
import GeoClient from './GeoClient'

export const dynamic = 'force-dynamic'

export default async function AdminGeoPage() {
  const supabase = createAdminClient()

  const [queueRes, aliasesRes, { count: totalAliases }, { count: pendingQueue }] = await Promise.all([
    supabase
      .from('geo_review_queue')
      .select('*, gyms(id, name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('geo_gym_aliases')
      .select('*, gyms(id, name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('geo_gym_aliases').select('*', { count: 'exact', head: true }),
    supabase.from('geo_review_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return (
    <GeoClient
      initialQueue={queueRes.data || []}
      initialAliases={aliasesRes.data || []}
      totalAliases={totalAliases ?? 0}
      pendingCount={pendingQueue ?? 0}
    />
  )
}
