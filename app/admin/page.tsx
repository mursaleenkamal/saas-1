import { createAdminClient } from '@/lib/supabase/admin'
import { Activity, Users, Dumbbell, MapPin, Headphones, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import AdminDashboardRealtime from './AdminDashboardRealtime'
import AdminGymsTable from './AdminGymsTable'

export const revalidate = 0 // Always fetch fresh metrics for the admin

export default async function AdminPage() {
  const supabase = createAdminClient()

  // Run aggregations and fetch gym records using the service role client.
  const [
    { count: totalGyms },
    { count: totalMembers },
    { count: totalGeoAliases },
    { count: pendingGeoReviews },
    { count: pendingSubscriptions },
    { count: trialGyms },
    { count: activeGyms },
    { count: expiredGyms },
    { count: openTickets },
    { data: gymsData },
  ] = await Promise.all([
    supabase.from('gyms').select('*', { count: 'exact', head: true }),
    supabase.from('members').select('*', { count: 'exact', head: true }),
    supabase.from('geo_gym_aliases').select('*', { count: 'exact', head: true }),
    supabase.from('geo_review_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('subscription_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('gyms').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trial'),
    supabase.from('gyms').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    supabase.from('gyms').select('*', { count: 'exact', head: true }).eq('subscription_status', 'expired'),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('gyms').select('id, name, owner_id, phone, is_active, subscription_status, created_at').order('created_at', { ascending: false }),
  ])

  const stats = [
    { label: 'Total Registered Gyms', value: totalGyms ?? 0, icon: Dumbbell, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Total Members (Platform)', value: totalMembers ?? 0, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Learned Geo Aliases', value: totalGeoAliases ?? 0, icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Open Support Tickets', value: openTickets ?? 0, icon: Headphones, color: 'text-red-600', bg: 'bg-red-100' },
  ]

  return (
    <div className="space-y-8">
      {/* Alert banner for open tickets */}
      {openTickets && openTickets > 0 ? (
        <div className="bg-gradient-to-r from-red-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-sm sm:text-base">
                {openTickets} Client Support {openTickets === 1 ? 'Ticket' : 'Tickets'} Awaiting Action
              </p>
              <p className="text-xs text-white/80 mt-0.5">
                Client has submitted issues or questions that require Super Admin resolution.
              </p>
            </div>
          </div>
          <Link
            href="/admin/support"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all shadow-sm whitespace-nowrap self-start sm:self-auto"
          >
            <span>View Tickets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : null}

      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Platform Overview</h2>
        <p className="text-slate-500 mt-1 text-sm">Real-time aggregate metrics across all multi-tenant fitness centers.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
            </div>
            <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Alert banner for pending geo reviews */}
      {pendingGeoReviews && pendingGeoReviews > 0 ? (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-sm sm:text-base">
                {pendingGeoReviews} Locality Address {pendingGeoReviews === 1 ? 'Review' : 'Reviews'} Pending
              </p>
              <p className="text-xs text-white/80 mt-0.5">
                New member addresses from tenant imports need canonical approval in the address matching queue.
              </p>
            </div>
          </div>
          <Link
            href="/admin/geo"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all shadow-sm whitespace-nowrap self-start sm:self-auto"
          >
            <span>Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : null}

      {/* Subscription Stats — realtime */}
      <AdminDashboardRealtime
        initial={{
          pendingSubscriptions: pendingSubscriptions ?? 0,
          trialGyms: trialGyms ?? 0,
          activeGyms: activeGyms ?? 0,
          expiredGyms: expiredGyms ?? 0,
        }}
      />

      {/* Registered Gyms Management Table */}
      <AdminGymsTable initialGyms={gymsData ?? []} />

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Platform Health & Status</h3>
          <p className="text-xs text-slate-500 mt-0.5">Database connectivity, isolation policies, and background schedulers are operational.</p>
        </div>
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/80 text-xs font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          All Systems Operational
        </div>
      </div>
    </div>
  )
}
