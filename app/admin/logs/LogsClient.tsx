'use client'

import { useState } from 'react'
import {
  ScrollText,
  Search,
  RefreshCw,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Activity,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface LogEvent {
  id: string
  type: 'audit' | 'subscription_decision'
  title: string
  description: string
  gymName: string
  timestamp: string
  actor: string
  badge: string
}

export default function LogsClient({
  initialEvents,
}: {
  initialEvents: LogEvent[]
}) {
  const [events, setEvents] = useState<LogEvent[]>(initialEvents)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/logs')
      if (!res.ok) throw new Error('Failed to refresh logs')
      const data = await res.json()
      setEvents(data.events || [])
      toast.success('Logs synchronized')
    } catch {
      toast.error('Failed to reload logs')
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = events.filter(e => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.gymName.toLowerCase().includes(search.toLowerCase()) ||
      e.actor.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false

    if (filterType === 'approved') return e.badge.toLowerCase().includes('approved')
    if (filterType === 'rejected') return e.badge.toLowerCase().includes('rejected')
    if (filterType === 'audit') return e.type === 'audit'

    return true
  })

  const getBadge = (badge: string) => {
    const b = badge.toLowerCase()
    if (b.includes('approve') || b.includes('active')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> {badge}
        </span>
      )
    }
    if (b.includes('reject') || b.includes('suspend') || b.includes('expired')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
          <XCircle className="w-3 h-3" /> {badge}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
        <Activity className="w-3 h-3" /> {badge}
      </span>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-indigo-600" />
            Platform Audit & Activity Logs
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            Immutable audit record of subscription decisions, administrative overrides, and tenant events.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 shadow-sm text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Stream
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Controls Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { key: 'all', label: `All Events (${events.length})` },
              { key: 'approved', label: 'Approvals' },
              { key: 'rejected', label: 'Rejections' },
              { key: 'audit', label: 'Subscription Audits' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  filterType === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by gym, action, or actor..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Timeline Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm font-medium">
              No matching activity logs found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-6">Event & Description</th>
                  <th className="py-3 px-4">Gym Tenant</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filtered.map(evt => (
                  <tr key={evt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 max-w-sm">
                      <div className="font-bold text-slate-900 text-sm">{evt.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5" title={evt.description}>
                        {evt.description}
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {evt.gymName}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">{getBadge(evt.badge)}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                        <User className="w-3 h-3 text-slate-400" />
                        {evt.actor}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap text-slate-400 text-[11px]">
                      {new Date(evt.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
