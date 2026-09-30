'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Ban,
  Phone,
  Mail,
  Users,
  CreditCard,
  KeyRound,
  Send,
  AlertTriangle,
  Clock,
  Dumbbell,
  ShieldAlert,
  Save,
  RefreshCw,
  PlusCircle,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface GymData {
  id: string
  name: string
  owner_id: string
  phone?: string | null
  address?: string | null
  is_active: boolean
  subscription_status?: string | null
  plan_type?: string | null
  subscription_started_at?: string | null
  subscription_ends_at?: string | null
  trial_ends_at?: string | null
  created_at: string
}

interface OwnerData {
  id: string
  email?: string | null
  created_at?: string
  last_sign_in_at?: string | null
}

interface StatsData {
  totalMembers: number
  activeMemberships: number
  pendingDues: number
  todayAttendance: number
}

interface Props {
  gym: GymData
  owner: OwnerData | null
  stats: StatsData
  recentMembers: Array<{ id: string; name: string; phone?: string | null; created_at: string }>
  recentTickets: Array<{ id: string; subject: string; status: string; created_at: string }>
}

export default function GymDetailClient({
  gym: initialGym,
  owner,
  stats,
  recentMembers,
  recentTickets,
}: Props) {
  const router = useRouter()
  const [gym, setGym] = useState<GymData>(initialGym)

  // Status & Subscription state
  const [subStatus, setSubStatus] = useState(gym.subscription_status || 'trial')
  const [planType, setPlanType] = useState(gym.plan_type || 'monthly')
  const [subEndsAt, setSubEndsAt] = useState(
    gym.subscription_ends_at ? gym.subscription_ends_at.slice(0, 10) : ''
  )
  const [savingSub, setSavingSub] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)

  // Password Reset state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)

  // Direct Message state
  const [msgSubject, setMsgSubject] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [msgType, setMsgType] = useState<'info' | 'warning' | 'error' | 'success'>('info')
  const [sendingMsg, setSendingMsg] = useState(false)

  // 1. Toggle Active / Suspended
  const handleToggleActive = async () => {
    const nextState = !gym.is_active
    const confirm = window.confirm(
      nextState
        ? `Reactivate ${gym.name}? The gym owner will regain access.`
        : `Suspend ${gym.name}? The gym owner will be blocked from logging in.`
    )
    if (!confirm) return

    setTogglingStatus(true)
    try {
      const res = await fetch(`/api/gyms/${gym.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextState }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setGym(prev => ({ ...prev, is_active: nextState }))
      toast.success(nextState ? 'Gym reactivated!' : 'Gym suspended!')
    } catch (err: any) {
      toast.error(err.message || 'Status toggle failed')
    } finally {
      setTogglingStatus(false)
    }
  }

  // 2. Save Subscription Changes
  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSub(true)

    try {
      const res = await fetch(`/api/gyms/${gym.id}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_status: subStatus,
          plan_type: planType,
          subscription_ends_at: subEndsAt ? new Date(subEndsAt).toISOString() : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update subscription')
      }

      setGym(prev => ({
        ...prev,
        subscription_status: subStatus,
        plan_type: planType,
        subscription_ends_at: subEndsAt ? new Date(subEndsAt).toISOString() : null,
      }))
      toast.success('Subscription plan updated successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Error updating subscription')
    } finally {
      setSavingSub(false)
    }
  }

  // Quick Extension Helpers
  const addDays = (days: number) => {
    const base = subEndsAt ? new Date(subEndsAt) : new Date()
    base.setDate(base.getDate() + days)
    setSubEndsAt(base.toISOString().slice(0, 10))
    setSubStatus('active')
    toast.success(`Extended by ${days} days! Don't forget to save changes.`)
  }

  // 3. Reset Owner Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!owner?.id) {
      toast.error('Owner account ID not found')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setResettingPassword(true)
    try {
      const res = await fetch('/api/gyms/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: owner.id,
          password: newPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')

      toast.success('Owner password has been updated!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Password update failed')
    } finally {
      setResettingPassword(false)
    }
  }

  // 4. Send Direct Message to this Gym
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!msgSubject.trim() || !msgBody.trim()) {
      toast.error('Subject and body required')
      return
    }

    setSendingMsg(true)
    try {
      const res = await fetch('/api/admin/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetGymId: gym.id,
          subject: msgSubject,
          body: msgBody,
          type: msgType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch message')

      toast.success('Message delivered to gym dashboard!')
      setMsgSubject('')
      setMsgBody('')
    } catch (err: any) {
      toast.error(err.message || 'Error sending message')
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Navigation / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {gym.name}
              </h1>
              {gym.is_active ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-200/60">
                  <Ban className="w-3.5 h-3.5" /> Suspended
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Gym ID: {gym.id}</p>
          </div>
        </div>

        <button
          onClick={handleToggleActive}
          disabled={togglingStatus}
          className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto ${
            gym.is_active
              ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          } disabled:opacity-50`}
        >
          {togglingStatus
            ? 'Updating...'
            : gym.is_active
            ? 'Suspend Gym Tenant'
            : 'Reactivate Gym Access'}
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Total Members
          </p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalMembers}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Active Memberships
          </p>
          <p className="text-2xl sm:text-3xl font-black text-indigo-600">{stats.activeMemberships}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Pending Dues
          </p>
          <p className="text-2xl sm:text-3xl font-black text-amber-600">{stats.pendingDues}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Today Attendance
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.todayAttendance}</p>
        </div>
      </div>

      {/* Main Grid: Subscription & Owner Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Subscription & Plan Management */}
        <div className="lg:col-span-2 space-y-8">
          {/* Subscription Manager */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Subscription & Plan Control</h3>
                  <p className="text-xs text-slate-500">
                    Directly modify this gym's tier, status, or extend expiration date
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveSubscription} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Subscription Status
                  </label>
                  <select
                    value={subStatus}
                    onChange={e => setSubStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-xs font-semibold text-slate-800 transition-all"
                  >
                    <option value="active">Active (Paid Account)</option>
                    <option value="trial">Free Trial</option>
                    <option value="expired">Expired (Locked Out)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Assigned Plan Tier
                  </label>
                  <select
                    value={planType}
                    onChange={e => setPlanType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-xs font-semibold text-slate-800 transition-all"
                  >
                    <option value="monthly">Monthly (30 Days)</option>
                    <option value="yearly">Yearly (365 Days)</option>
                    <option value="lifetime">Lifetime Access</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Subscription Expiration Date
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="date"
                      value={subEndsAt}
                      onChange={e => setSubEndsAt(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-xs font-medium text-slate-800 flex-1"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addDays(30)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        +30 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => addDays(365)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        +1 Year
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSubEndsAt('')
                          setPlanType('lifetime')
                          setSubStatus('active')
                          toast.success('Set to Lifetime plan! Click Save Changes.')
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                      >
                        Lifetime
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSub}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white shadow-md disabled:opacity-50 transition-all"
                >
                  {savingSub ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Subscription Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Direct Gym Announcement / Notification */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Direct Notice to this Gym</h3>
                <p className="text-xs text-slate-500">Delivered directly to the gym owner's dashboard</p>
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Subject (e.g. Action required on payment)"
                    value={msgSubject}
                    onChange={e => setMsgSubject(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <select
                    value={msgType}
                    onChange={e => setMsgType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 font-medium"
                  >
                    <option value="info">Info Notice</option>
                    <option value="warning">Warning</option>
                    <option value="error">Urgent Alert</option>
                    <option value="success">Success / Resolution</option>
                  </select>
                </div>
              </div>

              <textarea
                rows={2}
                placeholder="Message body..."
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white"
                required
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sendingMsg}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  {sendingMsg ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Deliver Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Owner Profile & Password Reset */}
        <div className="space-y-8">
          {/* Owner Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Tenant Contact Info
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Owner Email</p>
                  <p className="font-bold text-slate-800 mt-0.5">{owner?.email || 'N/A'}</p>
                </div>
                {owner?.email && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(owner.email!)
                      toast.success('Email copied!')
                    }}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                  <p className="font-bold text-slate-800 mt-0.5">{gym.phone || 'Not provided'}</p>
                </div>
                {gym.phone && (
                  <a
                    href={`tel:${gym.phone}`}
                    className="text-slate-400 hover:text-emerald-600 p-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registration Date</p>
                <p className="font-semibold text-slate-700 mt-0.5">
                  {new Date(gym.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {owner?.last_sign_in_at && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Sign In</p>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    {new Date(owner.last_sign_in_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reset Owner Password */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <KeyRound className="w-5 h-5 text-red-500" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Owner Password</h3>
                <p className="text-xs text-slate-500">Super admin override</p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={resettingPassword}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {resettingPassword ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Update Owner Password</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
