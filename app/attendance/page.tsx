import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getGym } from '@/lib/dal'
import { AttendanceClient } from './AttendanceClient'
import { format } from 'date-fns'

import { cacheWrapper } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const { user } = await getAuthUser()
  if (!user) return null

  const { gym } = await getGym(user.id)
  if (!gym) return null

  const today = format(new Date(), 'yyyy-MM-dd')
  const cacheKey = `gym:${gym.id}:attendance:${today}`

  const count = await cacheWrapper(cacheKey, 60, async () => {
    const supabase = await createClient()
    const { count: c } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gym.id)
      .eq('date', today)
    return c ?? 0
  })

  return (
    <AttendanceClient
      gymId={gym.id}
      gymName={gym.name}
      today={today}
      totalPresent={count}
    />
  )
}
