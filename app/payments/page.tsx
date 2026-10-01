import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getGym } from '@/lib/dal'
import { cacheWrapper } from '@/lib/cache'
import { PaymentsClient } from './PaymentsClient'
import { subMonths, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const { user } = await getAuthUser()
  if (!user) return null

  const { gym } = await getGym(user.id)
  if (!gym) return null

  const cacheKey = `gym:${gym.id}:payments_page:12mo`

  const data = await cacheWrapper(cacheKey, 300, async () => {
    const supabase = await createClient()

    const twelveMonthsAgo = format(subMonths(new Date(), 12), 'yyyy-MM-dd')

    const [paymentsRes, productSalesRes, pendingMembersRes, duePaymentsRes] = await Promise.all([
      supabase
        .from('memberships')
        .select('id, member_id, plan, start_date, end_date, amount, admission_fee, due_amount, payment_mode, created_at, member:members(id, name, phone, member_number)')
        .eq('gym_id', gym.id)
        .gte('created_at', twelveMonthsAgo)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('inventory_sales')
        .select('id, product_name, variant_name, quantity, unit_price, total_price, payment_mode, sold_at')
        .eq('gym_id', gym.id)
        .gte('sold_at', twelveMonthsAgo)
        .order('sold_at', { ascending: false })
        .limit(500),
      supabase
        .from('members')
        .select('id, name, phone, member_number, pending_amount')
        .eq('gym_id', gym.id)
        .gt('pending_amount', 0)
        .order('pending_amount', { ascending: false })
        .limit(200),
      supabase
        .from('due_payments')
        .select('id, member_id, amount, payment_mode, created_at, member:members(id, name, phone, member_number)')
        .eq('gym_id', gym.id)
        .gte('created_at', twelveMonthsAgo)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    const rawPayments = paymentsRes.data ?? []
    const rawDuePayments = duePaymentsRes.data ?? []

    const payments = rawPayments.map((p: any) => ({
      ...p,
      member: Array.isArray(p.member) ? p.member[0] : p.member,
    }))
    const duePayments = rawDuePayments.map((dp: any) => ({
      ...dp,
      member: Array.isArray(dp.member) ? dp.member[0] : dp.member,
    }))

    // Defensive fallback: if any membership or due payment lacks member details, resolve from members table
    const missingMemberIds = Array.from(
      new Set([
        ...payments.filter((p: any) => !p.member?.name && p.member_id).map((p: any) => p.member_id),
        ...duePayments.filter((dp: any) => !dp.member?.name && dp.member_id).map((dp: any) => dp.member_id),
      ])
    )

    if (missingMemberIds.length > 0) {
      const { data: missingMembers } = await supabase
        .from('members')
        .select('id, name, phone, member_number')
        .in('id', missingMemberIds)

      if (missingMembers && missingMembers.length > 0) {
        const memberMap = new Map(missingMembers.map((m: any) => [m.id, m]))
        for (const p of payments) {
          if (!p.member?.name && p.member_id && memberMap.has(p.member_id)) {
            p.member = memberMap.get(p.member_id)
          }
        }
        for (const dp of duePayments) {
          if (!dp.member?.name && dp.member_id && memberMap.has(dp.member_id)) {
            dp.member = memberMap.get(dp.member_id)
          }
        }
      }
    }

    return {
      payments,
      productSales: productSalesRes.data ?? [],
      pendingMembers: pendingMembersRes.data ?? [],
      duePayments,
    }
  })

  return (
    <PaymentsClient
      payments={data.payments as any}
      productSales={data.productSales}
      duePayments={data.duePayments as any}
      pendingMembers={data.pendingMembers}
      gymId={gym.id}
      gymName={gym.name}
    />
  )
}
