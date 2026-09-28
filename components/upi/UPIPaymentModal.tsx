'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, QrCode, Wallet, Loader2, CheckCircle2, Copy, Check, Settings, ArrowLeft, Building2, ShieldCheck, Smartphone } from 'lucide-react'
import { generatePaymentQRCode, buildPakistanQRString, PakistanPaymentProvider } from '@/lib/payment/pakistan-qr'
import { formatCurrency } from '@/lib/utils'
import { savePakistanPaymentConfig } from '@/app/account/upi-actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

interface MerchantConfig {
  upi_id?: string
  merchant_name?: string
  merchant_code?: string | null
  currency?: string
  raw_params?: Record<string, any>
}

interface Props {
  open: boolean
  onClose: () => void
  onGenerateQR?: () => void
  onCollectManually: () => void
  merchantConfig: MerchantConfig | null
  amount: number
  memberName: string
  memberNumber?: string | number
  gymId?: string | null
}

type Provider = 'jazzcash' | 'easypaisa' | 'raast'

export default function UPIPaymentModal({
  open,
  onClose,
  onGenerateQR,
  onCollectManually,
  merchantConfig,
  amount,
  memberName,
  memberNumber,
}: Props) {
  // Parse existing settings if present in merchantConfig.raw_params
  const existingParams = merchantConfig?.raw_params || {}

  const [provider, setProvider] = useState<Provider>('jazzcash')
  const [showSetup, setShowSetup] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Local state for account details (initialized from merchantConfig or defaults)
  const [jazzcashNumber, setJazzcashNumber] = useState(
    existingParams.jazzcash_number || (merchantConfig?.upi_id?.startsWith('03') ? merchantConfig.upi_id : '') || ''
  )
  const [jazzcashTitle, setJazzcashTitle] = useState(
    existingParams.jazzcash_title || merchantConfig?.merchant_name || ''
  )

  const [easypaisaNumber, setEasypaisaNumber] = useState(
    existingParams.easypaisa_number || ''
  )
  const [easypaisaTitle, setEasypaisaTitle] = useState(
    existingParams.easypaisa_title || merchantConfig?.merchant_name || ''
  )

  const [raastId, setRaastId] = useState(
    existingParams.raast_id || existingParams.bank_account || ''
  )
  const [raastTitle, setRaastTitle] = useState(
    existingParams.raast_title || existingParams.bank_title || merchantConfig?.merchant_name || ''
  )

  const [saving, setSaving] = useState(false)

  // Sync state whenever merchantConfig changes or modal opens
  useEffect(() => {
    if (open) {
      const raw = merchantConfig?.raw_params || {}
      const jcNum = raw.jazzcash_number || (merchantConfig?.upi_id?.startsWith('03') ? merchantConfig.upi_id : '') || ''
      const jcTitle = raw.jazzcash_title || merchantConfig?.merchant_name || ''
      const epNum = raw.easypaisa_number || ''
      const epTitle = raw.easypaisa_title || merchantConfig?.merchant_name || ''
      const rId = raw.raast_id || raw.bank_account || ''
      const rTitle = raw.raast_title || raw.bank_title || merchantConfig?.merchant_name || ''

      setJazzcashNumber(jcNum)
      setJazzcashTitle(jcTitle)
      setEasypaisaNumber(epNum)
      setEasypaisaTitle(epTitle)
      setRaastId(rId)
      setRaastTitle(rTitle)

      // Always show QR code view directly when collecting member payment
      setShowSetup(false)

      // Automatically select whichever provider has an account configured
      if (jcNum) {
        setProvider('jazzcash')
      } else if (epNum) {
        setProvider('easypaisa')
      } else if (rId) {
        setProvider('raast')
      }

      // If merchantConfig doesn't have accounts, attempt to load fresh from Supabase
      if (!jcNum && !epNum && !rId) {
        const supabase = createClient()
        supabase
          .from('gym_upi_config')
          .select('*')
          .maybeSingle()
          .then(({ data }: { data: any }) => {
            if (data?.raw_params) {
              const fresh = data.raw_params
              if (fresh.jazzcash_number) {
                setJazzcashNumber(fresh.jazzcash_number)
                setProvider('jazzcash')
              }
              if (fresh.jazzcash_title) setJazzcashTitle(fresh.jazzcash_title)
              if (fresh.easypaisa_number) {
                setEasypaisaNumber(fresh.easypaisa_number)
                if (!fresh.jazzcash_number) setProvider('easypaisa')
              }
              if (fresh.easypaisa_title) setEasypaisaTitle(fresh.easypaisa_title)
              if (fresh.raast_id) {
                setRaastId(fresh.raast_id)
                if (!fresh.jazzcash_number && !fresh.easypaisa_number) setProvider('raast')
              }
              if (fresh.raast_title) setRaastTitle(fresh.raast_title)
            }
          })
          .catch(() => {})
      }
    }
  }, [open, merchantConfig])

  // Active account number & title based on selected provider tab
  const currentAccount = useMemo(() => {
    if (provider === 'jazzcash') {
      return {
        number: jazzcashNumber || (merchantConfig?.upi_id?.startsWith('03') ? merchantConfig.upi_id : ''),
        title: jazzcashTitle || merchantConfig?.merchant_name || 'Gym Merchant',
      }
    }
    if (provider === 'easypaisa') {
      return {
        number: easypaisaNumber || '',
        title: easypaisaTitle || merchantConfig?.merchant_name || 'Gym Merchant',
      }
    }
    return {
      number: raastId || '',
      title: raastTitle || merchantConfig?.merchant_name || 'Gym Merchant',
    }
  }, [provider, jazzcashNumber, jazzcashTitle, easypaisaNumber, easypaisaTitle, raastId, raastTitle, merchantConfig])

  // Generate QR Code dynamically whenever provider, account, or amount changes
  useEffect(() => {
    if (!open || showSetup) return

    if (!currentAccount.number) {
      setQrDataUrl(null)
      return
    }

    let isMounted = true
    setGenerating(true)

    const refString = memberNumber ? `GF${String(memberNumber).padStart(4, '0')}` : memberName

    const qrPayload = buildPakistanQRString({
      provider,
      accountNumber: currentAccount.number,
      accountTitle: currentAccount.title,
      amount,
      city: 'Pakistan',
      reference: refString,
    })

    generatePaymentQRCode(qrPayload, 260)
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl)
          setGenerating(false)
          onGenerateQR?.()
        }
      })
      .catch((err) => {
        console.error('Failed to generate Pakistan QR code:', err)
        if (isMounted) setGenerating(false)
      })

    return () => {
      isMounted = false
    }
  }, [open, showSetup, provider, currentAccount, amount, memberName, memberNumber])

  // Copy to clipboard helper
  function copyText(text: string, fieldName: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied!`)
    setTimeout(() => {
      setCopiedField(null)
    }, 2000)
  }

  // Save Pakistan payment settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await savePakistanPaymentConfig({
        default_provider: provider,
        jazzcash_number: jazzcashNumber.trim(),
        jazzcash_title: jazzcashTitle.trim(),
        easypaisa_number: easypaisaNumber.trim(),
        easypaisa_title: easypaisaTitle.trim(),
        raast_id: raastId.trim(),
        raast_title: raastTitle.trim(),
      })

      if (!res.success) {
        throw new Error(res.error || 'Failed to save account details')
      }

      toast.success('Payment account details saved!')
      setShowSetup(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-500/10 text-brand-600 rounded-xl flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                {showSetup ? 'Configure Online Accounts' : 'Online Payment (QR / Transfer)'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">JazzCash &middot; EasyPaisa &middot; Raast / Bank</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">

          {/* Setup / Edit Form View */}
          {showSetup ? (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Apna <strong>JazzCash</strong>, <strong>EasyPaisa</strong> ya <strong>Raast ID</strong> enter karein. Member scan karega to us k bank/wallet app mien details fetch ho jayengi.
                </span>
              </div>

              {/* JazzCash Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">JazzCash Account</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Mobile / Account Number</label>
                    <input
                      type="text"
                      value={jazzcashNumber}
                      onChange={(e) => setJazzcashNumber(e.target.value)}
                      placeholder="0300 1234567"
                      className="input-field text-sm py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Account Title</label>
                    <input
                      type="text"
                      value={jazzcashTitle}
                      onChange={(e) => setJazzcashTitle(e.target.value)}
                      placeholder="e.g. Mursaleen Gym"
                      className="input-field text-sm py-2"
                    />
                  </div>
                </div>
              </div>

              {/* EasyPaisa Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">EasyPaisa Account</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Mobile / Account Number</label>
                    <input
                      type="text"
                      value={easypaisaNumber}
                      onChange={(e) => setEasypaisaNumber(e.target.value)}
                      placeholder="0345 1234567"
                      className="input-field text-sm py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Account Title</label>
                    <input
                      type="text"
                      value={easypaisaTitle}
                      onChange={(e) => setEasypaisaTitle(e.target.value)}
                      placeholder="e.g. Mursaleen Gym"
                      className="input-field text-sm py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Raast / Bank Account Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">Raast ID / Bank Account (Optional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Raast ID (Phone / IBAN)</label>
                    <input
                      type="text"
                      value={raastId}
                      onChange={(e) => setRaastId(e.target.value)}
                      placeholder="0300 1234567 or PK..."
                      className="input-field text-sm py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Account Title</label>
                    <input
                      type="text"
                      value={raastTitle}
                      onChange={(e) => setRaastTitle(e.target.value)}
                      placeholder="e.g. Iron Fitness"
                      className="input-field text-sm py-2"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSetup(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={saving || (!jazzcashNumber && !easypaisaNumber && !raastId)}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save & Show QR Code
                </button>
              </div>
            </form>
          ) : (
            /* Active QR & Payment Details View */
            <div className="space-y-4">
              {/* Provider Selection Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProvider('jazzcash')}
                  className={`py-2 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    provider === 'jazzcash'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  JazzCash
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('easypaisa')}
                  className={`py-2 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    provider === 'easypaisa'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  EasyPaisa
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('raast')}
                  className={`py-2 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    provider === 'raast'
                      ? 'bg-white text-sky-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-sky-600" />
                  Raast / Bank
                </button>
              </div>

              {/* If no number configured for current provider */}
              {!currentAccount.number ? (
                <div className="p-6 text-center space-y-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <p className="text-sm font-semibold text-slate-700">
                    {provider === 'jazzcash' ? 'JazzCash' : provider === 'easypaisa' ? 'EasyPaisa' : 'Raast'} number is not set up yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSetup(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors shadow-sm"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Enter {provider.toUpperCase()} Details
                  </button>
                </div>
              ) : (
                /* QR Code & Account Card */
                <div className="space-y-3">
                  {/* Amount Pill */}
                  <div className="flex items-center justify-between p-3 bg-brand-50 border border-brand-100 rounded-xl">
                    <div>
                      <p className="text-[11px] font-bold text-brand-600 uppercase tracking-wide">Amount Due</p>
                      <p className="text-xl font-black text-slate-900">{formatCurrency(amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Member</p>
                      <p className="text-xs font-bold text-slate-800">{memberName || 'New Member'}</p>
                    </div>
                  </div>

                  {/* QR Display Container */}
                  <div className="flex flex-col items-center justify-center p-3.5 bg-white border-2 border-slate-200 rounded-2xl shadow-sm relative">
                    {generating ? (
                      <div className="w-[220px] h-[220px] flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                      </div>
                    ) : qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Payment QR Code"
                        width={220}
                        height={220}
                        className="rounded-xl shadow-inner"
                      />
                    ) : (
                      <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-slate-400">
                        Unable to load QR
                      </div>
                    )}

                    <div className="mt-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> State Bank Raast Verified QR
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug max-w-xs">
                        Kisi bhi Pakistani Mobile Banking App (Meezan, HBL, Alfalah) ya {provider === 'jazzcash' ? 'JazzCash' : provider === 'easypaisa' ? 'EasyPaisa' : 'Wallets'} se scan karein.
                      </p>
                    </div>
                  </div>

                  {/* Account Information Card with One-Click Copy */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Account Title</span>
                      <span className="text-xs font-bold text-slate-800">{currentAccount.title || 'Gym Merchant'}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          {provider === 'jazzcash' ? 'JazzCash Number' : provider === 'easypaisa' ? 'EasyPaisa Number' : 'Raast ID / IBAN'}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-900 tracking-wider">
                          {currentAccount.number}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(currentAccount.number, 'Account Number')}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                      >
                        {copiedField === 'Account Number' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Edit Accounts Toggle */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowSetup(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      <Settings className="w-3 h-3" />
                      Edit Account Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!showSetup && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCollectManually}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Payment Received & Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
