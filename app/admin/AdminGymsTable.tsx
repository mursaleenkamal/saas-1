'use client'

import { useState } from 'react'
import { Dumbbell, Search, CheckCircle2, Ban, ShieldCheck, Phone, Calendar, Eye, Copy, X, Building2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface GymRow {
  id: string
  name: string
  owner_id: string
  phone?: string | null
  is_active: boolean
  subscription_status?: string | null
  created_at: string
}

export default function AdminGymsTable({ initialGyms }: { initialGyms: GymRow[] }) {
  const [gyms, setGyms] = useState<GymRow[]>(initialGyms)
  const [search, setSearch] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [selectedGym, setSelectedGym] = useState<GymRow | null>(null)

  const toggleGymStatus = async (gym: GymRow) => {
    const nextState = !gym.is_active
    const confirmAction = window.confirm(
      nextState
        ? `Reactivate ${gym.name}? The gym owner will regain immediate access.`
        : `Suspend ${gym.name}? The gym owner will be blocked from logging in.`
    )
    if (!confirmAction) return

    setLoadingId(gym.id)
    try {
      const res = await fetch(`/api/gyms/${gym.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextState }),
      })

      if (res.ok) {
        setGyms(prev =>
          prev.map(g => (g.id === gym.id ? { ...g, is_active: nextState } : g))
        )
        toast.success(nextState ? `${gym.name} reactivated!` : `${gym.name} suspended!`)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to update gym status.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  const filtered = gyms.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.phone && g.phone.includes(search))
  )

  const getSubBadge = (status?: string | null) => {
    switch (status) {
      case 'active':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Active</span>
      case 'trial':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Free Trial</span>
      case 'expired':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Expired</span>
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Standard</span>
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-indigo-600" />
            Registered Gym Tenants
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {gyms.length} registered gyms across the SaaS platform.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search gym name or phone..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="py-3 px-6">Gym Name</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Subscription</th>
              <th className="py-3 px-4">Access Status</th>
              <th className="py-3 px-4">Registered</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                  {search ? 'No gyms match your search query.' : 'No registered gyms found.'}
                </td>
              </tr>
            ) : (
              filtered.map(gym => (
                <tr key={gym.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900 text-sm">{gym.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {gym.id.slice(0, 13)}...</div>
                  </td>
                  <td className="py-4 px-4">
                    {gym.phone ? (
                      <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {gym.phone}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {getSubBadge(gym.subscription_status)}
                  </td>
                  <td className="py-4 px-4">
                    {gym.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full text-xs border border-emerald-200/60">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-red-700 font-semibold bg-red-50 px-2.5 py-1 rounded-full text-xs border border-red-200/60">
                        <Ban className="w-3.5 h-3.5" />
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(gym.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedGym(gym)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold text-xs bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200/80 shadow-sm"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      <button
                        onClick={() => toggleGymStatus(gym)}
                        disabled={loadingId === gym.id}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shadow-sm ${
                          gym.is_active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/80'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        } disabled:opacity-50`}
                      >
                        {loadingId === gym.id
                          ? 'Updating...'
                          : gym.is_active
                          ? 'Suspend'
                          : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Gym Details Modal */}
      {selectedGym && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedGym.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedGym.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active Account
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
                        <Ban className="w-3 h-3 text-red-600" /> Suspended Account
                      </span>
                    )}
                    <span className="text-slate-300">•</span>
                    {getSubBadge(selectedGym.subscription_status)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedGym(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gym Database ID</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-xs text-slate-700 truncate mr-2">{selectedGym.id}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedGym.id)
                        toast.success('Gym ID copied!')
                      }}
                      className="text-slate-400 hover:text-indigo-600 p-1"
                      title="Copy ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Owner User ID</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-xs text-slate-700 truncate mr-2">{selectedGym.owner_id}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedGym.owner_id)
                        toast.success('Owner ID copied!')
                      }}
                      className="text-slate-400 hover:text-indigo-600 p-1"
                      title="Copy Owner ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                  <span className="font-semibold text-slate-500">Contact Phone</span>
                  <span className="font-bold text-slate-800">{selectedGym.phone || 'Not provided'}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                  <span className="font-semibold text-slate-500">Registration Date</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedGym.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                  <span className="font-semibold text-slate-500">Platform Access Status</span>
                  <span className={`font-bold ${selectedGym.is_active ? 'text-emerald-600' : 'text-red-600'}`}>
                    {selectedGym.is_active ? 'Allowed to log in' : 'Access blocked / Suspended'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  toggleGymStatus(selectedGym)
                  setSelectedGym(null)
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedGym.is_active
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {selectedGym.is_active ? 'Suspend Gym Access' : 'Reactivate Gym Access'}
              </button>

              <button
                onClick={() => setSelectedGym(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
