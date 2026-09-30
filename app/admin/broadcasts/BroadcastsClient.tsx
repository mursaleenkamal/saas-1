'use client'

import { useState } from 'react'
import {
  Megaphone,
  Send,
  Building2,
  Trash2,
  RefreshCw,
  Info,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Radio,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface GymOption {
  id: string
  name: string
}

interface BroadcastMessage {
  id: string
  gym_id: string
  subject: string
  body: string
  type: string
  created_at: string
  read_at?: string | null
  gyms?: {
    id: string
    name: string
    phone?: string | null
  } | null
}

export default function BroadcastsClient({
  gyms,
  initialMessages,
}: {
  gyms: GymOption[]
  initialMessages: BroadcastMessage[]
}) {
  const [messages, setMessages] = useState<BroadcastMessage[]>(initialMessages)
  const [targetGymId, setTargetGymId] = useState<string>('all')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<'info' | 'warning' | 'error' | 'success'>('info')
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/broadcasts')
      if (!res.ok) throw new Error('Failed to refresh')
      const data = await res.json()
      setMessages(data.messages || [])
      toast.success('Announcements refreshed')
    } catch {
      toast.error('Failed to refresh list')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) {
      toast.error('Please enter both subject and message body')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/admin/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetGymId,
          subject,
          body,
          type,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch broadcast')

      toast.success(
        targetGymId === 'all'
          ? `Broadcast sent to ${data.recipientsCount} gyms!`
          : 'Announcement dispatched to gym!'
      )

      setSubject('')
      setBody('')
      setTargetGymId('all')
      setType('info')
      handleRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Error sending message')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to dismiss this message record?')) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/broadcasts?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      setMessages(prev => prev.filter(m => m.id !== id))
      toast.success('Message dismissed')
    } catch {
      toast.error('Failed to delete message')
    } finally {
      setDeletingId(null)
    }
  }

  const getTypeBadge = (msgType: string) => {
    switch (msgType) {
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3" /> Urgent
          </span>
        )
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Update
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
            <Info className="w-3 h-3" /> Notice
          </span>
        )
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-indigo-600" />
            Super Admin Broadcasts
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            Publish announcements, maintenance downtime alerts, and notifications directly into gym tenant dashboards.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 shadow-sm text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Compose Form */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">New Broadcast</h3>
              <p className="text-xs text-slate-500">Compose and dispatch alert</p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Target Audience
              </label>
              <select
                value={targetGymId}
                onChange={e => setTargetGymId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-semibold text-slate-800 transition-all"
              >
                <option value="all">📢 All Registered Gyms ({gyms.length} tenants)</option>
                <optgroup label="Specific Gym">
                  {gyms.map(gym => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Notice Type / Severity
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'info', label: 'Info Notice', color: 'border-indigo-300 text-indigo-700 bg-indigo-50/50' },
                  { value: 'warning', label: 'Warning', color: 'border-amber-300 text-amber-700 bg-amber-50/50' },
                  { value: 'error', label: 'Urgent / Alert', color: 'border-red-300 text-red-700 bg-red-50/50' },
                  { value: 'success', label: 'Feature / Release', color: 'border-emerald-300 text-emerald-700 bg-emerald-50/50' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      type === opt.value
                        ? `${opt.color} ring-2 ring-indigo-500/20`
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Scheduled System Maintenance Notice"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Message Body
              </label>
              <textarea
                rows={4}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write announcement details for gym owners..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-normal text-slate-800 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Broadcast Now</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sent Messages History */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Sent Broadcast History</h3>
              <p className="text-xs text-slate-500">
                Log of past announcements and notifications ({messages.length} total)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {messages.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Megaphone className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No announcements dispatched yet.</p>
                <p className="text-xs text-slate-400 mt-1">Use the compose box to send your first message.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="py-3 px-6">Notice</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Sent At</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {messages.map(msg => (
                    <tr key={msg.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 max-w-xs">
                        <div className="font-bold text-slate-900 truncate" title={msg.subject}>
                          {msg.subject}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2" title={msg.body}>
                          {msg.body}
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {msg.gyms ? (
                          <span className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {msg.gyms.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">All Gyms</span>
                        )}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">{getTypeBadge(msg.type)}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                        {new Date(msg.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(msg.id)}
                          disabled={deletingId === msg.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete message record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
