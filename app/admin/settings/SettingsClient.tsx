'use client'

import { useState } from 'react'
import {
  Settings,
  CreditCard,
  QrCode,
  DollarSign,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PlatformSettings {
  id: number
  upi_id: string
  upi_name: string
  price_monthly: number
  price_yearly: number
}

export default function SettingsClient({
  initialSettings,
}: {
  initialSettings: PlatformSettings
}) {
  const [settings, setSettings] = useState<PlatformSettings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleChange = (field: keyof PlatformSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_monthly: Number(settings.price_monthly),
          price_yearly: Number(settings.price_yearly),
          upi_id: settings.upi_id,
          upi_name: settings.upi_name,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save settings')

      setSettings(data.settings)
      setHasChanges(false)
      toast.success('Platform settings updated successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Error updating settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600" />
            Platform & Pricing Settings
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            Configure subscription tiers, payment receiver accounts (Raast / UPI), and global system preferences.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Subscription Pricing Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">SaaS Subscription Pricing</h3>
              <p className="text-xs text-slate-500">
                These prices are shown to gym owners during registration and renewal checkout.
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Monthly Subscription Price (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={settings.price_monthly}
                  onChange={e => handleChange('price_monthly', e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 text-sm transition-all"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">Standard 30-day recurring plan charge.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Yearly Subscription Price (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={settings.price_yearly}
                  onChange={e => handleChange('price_yearly', e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 text-sm transition-all"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">Discounted annual billing plan (365 days access).</p>
            </div>
          </div>
        </div>

        {/* Payment Receiver Details (UPI / Raast) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Payment Receiver Account (Raast / UPI / Bank)</h3>
              <p className="text-xs text-slate-500">
                Payment details displayed to gym tenants on the payment proof submission screen.
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Receiver Account / Raast ID / UPI ID
              </label>
              <input
                type="text"
                value={settings.upi_id}
                onChange={e => handleChange('upi_id', e.target.value)}
                placeholder="e.g. 03001234567 or gymflow@bank"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800 text-sm transition-all"
                required
              />
              <p className="text-[11px] text-slate-400">Mobile number for Raast or UPI Virtual Payment Address.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Account Title / Business Name
              </label>
              <input
                type="text"
                value={settings.upi_name}
                onChange={e => handleChange('upi_name', e.target.value)}
                placeholder="e.g. GymFlow Technologies"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800 text-sm transition-all"
                required
              />
              <p className="text-[11px] text-slate-400">Beneficiary name that matches the bank or wallet account.</p>
            </div>
          </div>
        </div>

        {/* Global System Telemetry & Policies */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Platform Policies & Security</h3>
              <p className="text-xs text-slate-500">Super-admin security boundaries and automated jobs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase mb-1">
                <Zap className="w-4 h-4" />
                Default Trial
              </div>
              <p className="text-sm font-extrabold text-slate-800">14 Days Free</p>
              <p className="text-[11px] text-slate-400 mt-1">Automatic trial assigned on gym registration.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase mb-1">
                <ShieldCheck className="w-4 h-4" />
                Isolation Strategy
              </div>
              <p className="text-sm font-extrabold text-slate-800">Row-Level Security (RLS)</p>
              <p className="text-[11px] text-slate-400 mt-1">Multi-tenant isolation enforced at DB layer.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
                <RefreshCw className="w-4 h-4" />
                Subscription Check
              </div>
              <p className="text-sm font-extrabold text-slate-800">Daily Cron / Active RPC</p>
              <p className="text-[11px] text-slate-400 mt-1">Lapsed accounts automatically locked on expiry.</p>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 text-xs">
            {hasChanges ? (
              <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Unsaved modifications pending.
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                All configurations saved and synchronized.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Settings...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Platform Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
