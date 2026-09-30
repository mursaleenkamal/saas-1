'use client'

import { useState } from 'react'
import {
  Headphones,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  Phone,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  Send,
  X,
  Loader2,
  Sparkles,
  Inbox,
} from 'lucide-react'
import toast from 'react-hot-toast'

export interface SupportTicket {
  id: string
  gym_id: string
  subject: string
  message: string
  type: string
  status: string
  created_at: string
  resolved_at?: string | null
  is_cleared_by_admin?: boolean
  gym?: {
    id: string
    name: string
    phone?: string | null
    owner_id: string
  } | null
}

export default function AdminSupportClient({
  initialTickets,
}: {
  initialTickets: SupportTicket[]
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all')
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Resolve Modal State
  const [resolvingTicket, setResolvingTicket] = useState<SupportTicket | null>(null)
  const [replySubject, setReplySubject] = useState('')
  const [replyMessage, setReplyMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openTicketsCount = tickets.filter(t => t.status === 'open').length
  const resolvedTicketsCount = tickets.filter(t => t.status === 'resolved').length

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/admin/support/tickets')
      if (!res.ok) throw new Error('Failed to refresh')
      const data = await res.json()
      const formatted = (data.tickets || []).map((t: any) => ({
        id: t.id,
        gym_id: t.gym_id,
        subject: t.subject,
        message: t.message,
        type: t.type || 'query',
        status: t.status || 'open',
        created_at: t.created_at,
        resolved_at: t.resolved_at,
        gym: Array.isArray(t.gyms) ? t.gyms[0] : (t.gyms || null),
      }))
      setTickets(formatted)
      toast.success('Tickets refreshed')
    } catch {
      toast.error('Could not refresh tickets')
    } finally {
      setIsRefreshing(false)
    }
  }

  const openResolveDialog = (ticket: SupportTicket) => {
    setResolvingTicket(ticket)
    setReplySubject(`Re: ${ticket.subject}`)
    setReplyMessage(
      `Hello! We have reviewed your request regarding "${ticket.subject}" and this has been resolved. Please reach out if you need any further assistance.`
    )
  }

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingTicket) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/support/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: resolvingTicket.id,
          status: 'resolved',
          replySubject,
          replyMessage,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resolve')

      setTickets(prev =>
        prev.map(t =>
          t.id === resolvingTicket.id
            ? { ...t, status: 'resolved', resolved_at: new Date().toISOString() }
            : t
        )
      )

      toast.success('Ticket marked as resolved and notification sent!')
      setResolvingTicket(null)
    } catch (err: any) {
      toast.error(err.message || 'Error resolving ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReopen = async (ticketId: string) => {
    try {
      const res = await fetch('/api/admin/support/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          status: 'open',
        }),
      })

      if (!res.ok) throw new Error('Failed to reopen')

      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, status: 'open', resolved_at: null } : t))
      )
      toast.success('Ticket re-opened')
    } catch {
      toast.error('Failed to update ticket status')
    }
  }

  // Filtered list
  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'open' && t.status !== 'open') return false
    if (filterStatus === 'resolved' && t.status !== 'resolved') return false
    if (selectedType !== 'all' && t.type !== selectedType) return false

    if (search.trim()) {
      const query = search.toLowerCase()
      const matchSubject = t.subject.toLowerCase().includes(query)
      const matchMessage = t.message.toLowerCase().includes(query)
      const matchGym = t.gym?.name?.toLowerCase().includes(query)
      if (!matchSubject && !matchMessage && !matchGym) return false
    }

    return true
  })

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'high_priority':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
            <AlertTriangle className="w-3 h-3" /> High Priority
          </span>
        )
      case 'bug':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Bug Report
          </span>
        )
      case 'issue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
            Technical Issue
          </span>
        )
      case 'query':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
            General Query
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Client Support Tickets
                {openTicketsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-500 text-white shadow-sm">
                    {openTicketsCount} Open
                  </span>
                )}
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Manage and resolve incoming support queries submitted by gym clients in real-time.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter & Controls bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-fit">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({tickets.length})
          </button>
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterStatus === 'open'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Open ({openTicketsCount})
          </button>
          <button
            onClick={() => setFilterStatus('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'resolved'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Resolved ({resolvedTicketsCount})
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
          >
            <option value="all">All Issue Types</option>
            <option value="issue">Technical Issue</option>
            <option value="query">General Query</option>
            <option value="high_priority">High Priority</option>
            <option value="bug">Report a Bug</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subject, gym, text..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Support Tickets Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || filterStatus !== 'all' || selectedType !== 'all'
              ? 'No tickets match the selected filters or search query.'
              : 'There are currently no tickets raised by clients.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map(ticket => {
            const isOpen = ticket.status === 'open'
            const formattedDate = new Date(ticket.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={ticket.id}
                className={`bg-white rounded-2xl border transition-all shadow-sm hover:shadow-md p-6 ${
                  isOpen
                    ? 'border-slate-200/90 border-l-4 border-l-indigo-600'
                    : 'border-slate-200/60 opacity-80'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Badges & Meta */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Resolved
                        </span>
                      )}

                      {getTypeBadge(ticket.type)}

                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                      </span>
                    </div>

                    {/* Subject */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        {ticket.subject}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                          {ticket.gym?.name || 'Unknown Gym'}
                        </span>
                        {ticket.gym?.phone && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {ticket.gym.phone}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400">
                          Gym ID: {ticket.gym_id.slice(0, 10)}...
                        </span>
                      </div>
                    </div>

                    {/* Message Box */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed font-normal">
                      {ticket.message}
                    </div>

                    {ticket.resolved_at && (
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Resolved on {new Date(ticket.resolved_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex md:flex-col items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {isOpen ? (
                      <button
                        onClick={() => openResolveDialog(ticket)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all w-full sm:w-auto"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Resolve Ticket</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReopen(ticket.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-semibold text-xs transition-all w-full sm:w-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Re-open</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Resolve Ticket Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Resolve Ticket & Reply</h3>
                  <p className="text-xs text-slate-500">
                    To: {resolvingTicket.gym?.name || 'Gym Client'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResolvingTicket(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Resolution Subject
                </label>
                <input
                  type="text"
                  value={replySubject}
                  onChange={e => setReplySubject(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Response Message to Client
                </label>
                <textarea
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  rows={4}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  placeholder="Explain how the issue was resolved or instructions for the gym..."
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This message will be delivered to the gym owner&apos;s notifications dashboard.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !replyMessage.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmitting ? 'Resolving...' : 'Confirm & Resolve'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
