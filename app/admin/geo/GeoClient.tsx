'use client'

import { useState } from 'react'
import {
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Building2,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  Compass,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface QueueItem {
  id: string
  gym_id: string
  raw_input: string
  top_suggestion?: string | null
  top_confidence?: number | null
  status: string
  resolved_to?: string | null
  created_at: string
  gyms?: {
    id: string
    name: string
  } | null
}

interface AliasItem {
  id: string
  gym_id: string
  alias_raw: string
  alias_normalized: string
  canonical_name: string
  created_at: string
  gyms?: {
    id: string
    name: string
  } | null
}

interface Props {
  initialQueue: QueueItem[]
  initialAliases: AliasItem[]
  totalAliases: number
  pendingCount: number
}

export default function GeoClient({
  initialQueue,
  initialAliases,
  totalAliases,
  pendingCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<'queue' | 'aliases'>('queue')
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue)
  const [aliases, setAliases] = useState<AliasItem[]>(initialAliases)
  const [search, setSearch] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState<Record<string, string>>({})

  const handleResolve = async (id: string, action: 'resolve' | 'dismiss') => {
    setActionLoadingId(id)
    const custom = customInput[id]

    try {
      const res = await fetch('/api/admin/geo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          resolved_to: custom,
        }),
      })

      if (!res.ok) throw new Error('Failed to update')

      setQueue(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                status: action === 'resolve' ? 'resolved' : 'dismissed',
                resolved_to: custom || item.top_suggestion || item.raw_input,
              }
            : item
        )
      )

      toast.success(action === 'resolve' ? 'Locality alias approved!' : 'Item dismissed')
    } catch {
      toast.error('Failed to update review item')
    } finally {
      setActionLoadingId(null)
    }
  }

  const pendingItems = queue.filter(q => q.status === 'pending')
  const resolvedItems = queue.filter(q => q.status !== 'pending')

  const filteredAliases = aliases.filter(
    a =>
      a.alias_raw.toLowerCase().includes(search.toLowerCase()) ||
      a.canonical_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.gyms?.name && a.gyms.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Compass className="w-8 h-8 text-emerald-600" />
            Geo Locality & Address Normalization
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            AI-driven address matcher review queue and learned locality aliases across Pakistan.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Reviews</p>
          </div>
          <p className="text-3xl font-black text-slate-900">{pendingItems.length}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Learned Aliases</p>
          </div>
          <p className="text-3xl font-black text-emerald-600">{totalAliases}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reviewed Records</p>
          </div>
          <p className="text-3xl font-black text-slate-900">{resolvedItems.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Review Queue ({pendingItems.length})
        </button>

        <button
          onClick={() => setActiveTab('aliases')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'aliases'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Learned Aliases Directory ({aliases.length})
        </button>
      </div>

      {/* Queue View */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Unmatched Member Addresses</h3>
              <p className="text-xs text-slate-500">
                Addresses from member CSV imports that fell below the high confidence matching threshold
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {pendingItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-400 mt-0.5">No pending geo review requests in the queue.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="py-3 px-6">Raw Member Input</th>
                    <th className="py-3 px-4">Gym Tenant</th>
                    <th className="py-3 px-4">AI Top Suggestion</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-6 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {pendingItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-900 text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                          "{item.raw_input}"
                        </span>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-700">
                        {item.gyms?.name || 'Unknown Gym'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-indigo-700">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{item.top_suggestion || 'No suggestion'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          {item.top_confidence ? `${Math.round(item.top_confidence * 100)}%` : 'Low'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResolve(item.id, 'resolve')}
                            disabled={actionLoadingId === item.id}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
                          >
                            Approve Match
                          </button>
                          <button
                            onClick={() => handleResolve(item.id, 'dismiss')}
                            disabled={actionLoadingId === item.id}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Aliases View */}
      {activeTab === 'aliases' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Learned Locality Aliases</h3>
              <p className="text-xs text-slate-500">
                Synonyms and abbreviations mapped to canonical localities
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search raw alias or canonical..."
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredAliases.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No matching learned aliases found.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="py-3 px-6">Raw Alias</th>
                    <th className="py-3 px-4">Canonical Locality</th>
                    <th className="py-3 px-4">Associated Gym</th>
                    <th className="py-3 px-4">Learned On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {filteredAliases.map(alias => (
                    <tr key={alias.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-800">
                        {alias.alias_raw}
                      </td>
                      <td className="py-4 px-4 font-semibold text-emerald-700">
                        {alias.canonical_name}
                      </td>
                      <td className="py-4 px-4 text-slate-600">
                        {alias.gyms?.name || 'All Platform'}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {new Date(alias.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
