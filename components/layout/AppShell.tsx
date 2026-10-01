// Server component — passes children to the client shell guard
import ShellGuard from './ShellGuard'
import { getAuthUser, getGym, getGymSubscription, getGymIsActive, getUnreadAdminMessages, getSubscriptionState } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = await getAuthUser()

  let gym = null
  let isActive = true
  let unreadCount = 0
  let subscriptionStatus = 'unknown'
  let trialDaysLeft = 0
  let unreadMessages: any[] = []

  if (user) {
    // getGym: cached identity fields (name, id, onboarding) — stable, safe to cache.
    // getGymSubscription: always fresh from Postgres — never cached.
    // getGymIsActive: always fresh — security-critical.
    // getUnreadAdminMessages: cached 30s.
    // Run gym identity, subscription status, and active check concurrently
    const [gymResult, subResult, activeResult] = await Promise.all([
      getGym(user.id),
      getGymSubscription(user.id),
      getGymIsActive(user.id),
    ])

    gym = gymResult.gym
    isActive = activeResult.isActive

    if (gym) {
      const unreadResult = await getUnreadAdminMessages(gym.id)
      unreadCount = unreadResult.count ?? 0

      if (unreadCount > 0) {
        try {
          const supabase = await createClient()
          const { data } = await supabase
            .from('admin_messages')
            .select('id, gym_id, subject, body, type, created_at, read_at')
            .eq('gym_id', gym.id)
            .is('read_at', null)
            .eq('is_cleared_by_owner', false)
            .order('created_at', { ascending: false })
          unreadMessages = data || []
        } catch {
          unreadMessages = []
        }
      }
    }

    const subState = getSubscriptionState(subResult.gym)
    subscriptionStatus = subState.status
    trialDaysLeft = subState.daysLeft ?? 0
  }

  return (
    <ShellGuard
      initialUser={user}
      initialGym={gym}
      initialIsActive={isActive}
      initialUnreadCount={unreadCount}
      initialSubscriptionStatus={subscriptionStatus}
      initialTrialDaysLeft={trialDaysLeft}
      initialUnreadMessages={unreadMessages}
    >
      {children}
    </ShellGuard>
  )
}

