'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Camera, CheckCircle2, Loader2, Trash2, Smartphone, Building2, ShieldCheck, Edit3 } from 'lucide-react'
import { savePakistanPaymentConfig, deleteUPIConfig, saveUPIConfig } from '@/app/account/upi-actions'
import type { UPIConfig, PakistanPaymentConfig } from '@/app/account/upi-actions'
import { toast } from 'react-hot-toast'

interface Props {
  initialConfig: UPIConfig | null
  onConfigChange?: (config: UPIConfig | null) => void
}

type TabMode = 'manual' | 'qr'

export default function UPIQRSetup({ initialConfig, onConfigChange }: Props) {
  const existingParams = initialConfig?.raw_params || {}

  const [config, setConfig] = useState<UPIConfig | null>(initialConfig)
  const [tabMode, setTabMode] = useState<TabMode>('manual')
  const [isEditing, setIsEditing] = useState(!initialConfig)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [jazzcashNumber, setJazzcashNumber] = useState(
    existingParams.jazzcash_number || (initialConfig?.upi_id?.startsWith('03') ? initialConfig.upi_id : '') || ''
  )
  const [jazzcashTitle, setJazzcashTitle] = useState(
    existingParams.jazzcash_title || initialConfig?.merchant_name || ''
  )

  const [easypaisaNumber, setEasypaisaNumber] = useState(
    existingParams.easypaisa_number || ''
  )
  const [easypaisaTitle, setEasypaisaTitle] = useState(
    existingParams.easypaisa_title || initialConfig?.merchant_name || ''
  )

  const [raastId, setRaastId] = useState(
    existingParams.raast_id || existingParams.bank_account || ''
  )
  const [raastTitle, setRaastTitle] = useState(
    existingParams.raast_title || existingParams.bank_title || initialConfig?.merchant_name || ''
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Handle Manual Save ───────────────────────────────────────────────────
  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault()
    if (!jazzcashNumber && !easypaisaNumber && !raastId) {
      setError('Please provide at least one account (JazzCash, EasyPaisa, or Raast).')
      return
    }

    setSaving(true)
    setError('')

    const payload: PakistanPaymentConfig = {
      default_provider: jazzcashNumber ? 'jazzcash' : easypaisaNumber ? 'easypaisa' : 'raast',
      jazzcash_number: jazzcashNumber.trim(),
      jazzcash_title: jazzcashTitle.trim(),
      easypaisa_number: easypaisaNumber.trim(),
      easypaisa_title: easypaisaTitle.trim(),
      raast_id: raastId.trim(),
      raast_title: raastTitle.trim(),
    }

    const res = await savePakistanPaymentConfig(payload)
    setSaving(false)

    if (!res.success) {
      setError(res.error || 'Failed to save account details')
      return
    }

    toast.success('Online payment accounts saved!')
    const updated: UPIConfig = {
      id: config?.id || '',
      gym_id: config?.gym_id || '',
      upi_id: payload.jazzcash_number || payload.easypaisa_number || payload.raast_id || '',
      merchant_name: payload.jazzcash_title || payload.easypaisa_title || payload.raast_title || '',
      merchant_code: null,
      currency: 'PKR',
      raw_params: payload,
      created_at: config?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setConfig(updated)
    setIsEditing(false)
    onConfigChange?.(updated)
  }

  // ── Handle File Upload / QR Decoding ──────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const jsQR = (await import('jsqr')).default
      const result = jsQR(imageData.data, imageData.width, imageData.height)

      if (!result?.data) {
        setError('Could not detect a QR code in the image. Please try a clearer image or enter details manually.')
        return
      }

      const decoded = result.data
      // Extract phone number or details if present
      const phoneMatch = decoded.match(/03\d{9}/) || decoded.match(/923\d{9}/)
      if (phoneMatch) {
        let phone = phoneMatch[0]
        if (phone.startsWith('92')) phone = '0' + phone.slice(2)
        setJazzcashNumber(phone)
        setEasypaisaNumber(phone)
        setRaastId(phone)
        toast.success(`Account number ${phone} extracted from QR!`)
        setTabMode('manual')
      } else {
        setRaastId(decoded.slice(0, 30))
        toast.success('QR Code data read successfully!')
        setTabMode('manual')
      }
    } catch {
      setError('Failed to process image. You can enter your account number directly above.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Delete Config ─────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm('Remove your online payment setup? Members will not see your QR code until you configure it again.')) return
    setDeleting(true)
    const result = await deleteUPIConfig()
    setDeleting(false)
    if (result.success) {
      setConfig(null)
      setJazzcashNumber('')
      setJazzcashTitle('')
      setEasypaisaNumber('')
      setEasypaisaTitle('')
      setRaastId('')
      setRaastTitle('')
      setIsEditing(true)
      onConfigChange?.(null)
      toast.success('Payment setup removed')
    }
  }

  // ── Display: Saved state ──────────────────────────────────────────────────
  if (!isEditing && config) {
    const raw = config.raw_params || {}
    const jcNum = raw.jazzcash_number || (config.upi_id?.startsWith('03') ? config.upi_id : null)
    const epNum = raw.easypaisa_number
    const rId = raw.raast_id

    return (
      <div className="space-y-3">
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-slate-900 text-sm">Online Payments Configured</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Edit Accounts"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Accounts"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            {jcNum && (
              <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide block">JazzCash</span>
                <p className="font-bold text-slate-900 mt-0.5">{jcNum}</p>
                <p className="text-slate-500 text-[11px] truncate">{raw.jazzcash_title || config.merchant_name}</p>
              </div>
            )}
            {epNum && (
              <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide block">EasyPaisa</span>
                <p className="font-bold text-slate-900 mt-0.5">{epNum}</p>
                <p className="text-slate-500 text-[11px] truncate">{raw.easypaisa_title || config.merchant_name}</p>
              </div>
            )}
            {rId && (
              <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wide block">Raast / Bank</span>
                <p className="font-bold text-slate-900 mt-0.5 truncate">{rId}</p>
                <p className="text-slate-500 text-[11px] truncate">{raw.raast_title || config.merchant_name}</p>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
        >
          + Update or change payment account numbers
        </button>
      </div>
    )
  }

  // ── Display: Edit / Setup form ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Switch between Manual & QR */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTabMode('manual')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            tabMode === 'manual'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Enter Account Numbers (Recommended)
        </button>
        <button
          type="button"
          onClick={() => setTabMode('qr')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            tabMode === 'qr'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Scan / Upload Existing QR Image
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {tabMode === 'manual' ? (
        <form onSubmit={handleManualSave} className="space-y-3.5">
          {/* JazzCash */}
          <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">JazzCash Account</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Mobile / Account Number</label>
                <input
                  type="text"
                  value={jazzcashNumber}
                  onChange={(e) => setJazzcashNumber(e.target.value)}
                  placeholder="0300 1234567"
                  className="input-field text-xs py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Account Title</label>
                <input
                  type="text"
                  value={jazzcashTitle}
                  onChange={(e) => setJazzcashTitle(e.target.value)}
                  placeholder="e.g. Ali Khan"
                  className="input-field text-xs py-2"
                />
              </div>
            </div>
          </div>

          {/* EasyPaisa */}
          <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">EasyPaisa Account</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Mobile / Account Number</label>
                <input
                  type="text"
                  value={easypaisaNumber}
                  onChange={(e) => setEasypaisaNumber(e.target.value)}
                  placeholder="0345 1234567"
                  className="input-field text-xs py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Account Title</label>
                <input
                  type="text"
                  value={easypaisaTitle}
                  onChange={(e) => setEasypaisaTitle(e.target.value)}
                  placeholder="e.g. Ali Khan"
                  className="input-field text-xs py-2"
                />
              </div>
            </div>
          </div>

          {/* Raast / Bank */}
          <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">Raast ID / Bank Account (Optional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Raast ID / IBAN</label>
                <input
                  type="text"
                  value={raastId}
                  onChange={(e) => setRaastId(e.target.value)}
                  placeholder="0300 1234567 or PK..."
                  className="input-field text-xs py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Account Title</label>
                <input
                  type="text"
                  value={raastTitle}
                  onChange={(e) => setRaastTitle(e.target.value)}
                  placeholder="e.g. Iron Gym"
                  className="input-field text-xs py-2"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            {config && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Payment Accounts
            </button>
          </div>
        </form>
      ) : (
        /* Upload QR image */
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3 bg-slate-50/50">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center">
            <Upload className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Upload your merchant QR code sticker/image</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Supports JazzCash, EasyPaisa, or Raast QR codes</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
          >
            Select Image
          </button>
        </div>
      )}
    </div>
  )
}
