'use client'

import { useState } from 'react'
import {
  X,
  Printer,
  Receipt,
  CheckCircle2,
  MessageCircle,
  Copy,
  Check,
  Building2,
  Calendar,
  CreditCard,
  User,
  ShieldCheck,
} from 'lucide-react'
import { formatCurrency, formatDate, cn, isValidPhone } from '@/lib/utils'
import type { Member, Membership, PaymentMode } from '@/types'
import { formatMemberId } from '@/types'
import { buildWaMeUrl } from '@/components/whatsapp/WhatsAppTemplateModal'
import { toast } from 'react-hot-toast'

export interface ReceiptPaymentItem {
  id: string
  type: 'membership' | 'due'
  amount: number
  date: string
  payment_mode: PaymentMode
  membership?: Membership
}

interface ReceiptModalProps {
  open: boolean
  onClose: () => void
  member: Member
  gymName?: string
  payment: ReceiptPaymentItem | null
}

export function ReceiptModal({
  open,
  onClose,
  member,
  gymName = 'GymFlow Partner Gym',
  payment,
}: ReceiptModalProps) {
  const [copied, setCopied] = useState(false)

  if (!open || !payment) return null

  const receiptId = `INV-${payment.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  const isMembership = payment.type === 'membership'
  const m = payment.membership

  // Amounts breakdown
  const planFee = m ? m.amount : payment.amount
  const admissionFee = m?.admission_fee ?? 0
  const dueOnPlan = m?.due_amount ?? 0
  const netPaid = payment.amount

  const paymentDate = payment.date
    ? formatDate(payment.date)
    : formatDate(new Date().toISOString())

  const handlePrint = () => {
    window.print()
  }

  // Pre-formatted WhatsApp text message for receipt sharing
  const generateReceiptText = () => {
    const lines = [
      `🧾 *PAYMENT RECEIPT — ${gymName}*`,
      `Receipt No: *${receiptId}*`,
      `Date: ${paymentDate}`,
      `---------------------------------`,
      `*Member Details:*`,
      `• Name: ${member.name}`,
      `• Member ID: ${formatMemberId(member.member_number)}`,
      `• Phone: ${member.phone}`,
      `---------------------------------`,
      `*Payment Summary:*`,
      isMembership && m
        ? `• Plan: ${m.plan.toUpperCase()} (${m.category === 'both' || !m.category ? 'Strength + Cardio' : m.category})\n• Duration: ${formatDate(m.start_date)} to ${formatDate(m.end_date)}`
        : `• Description: Past Due Balance Clearance`,
      `• Mode: ${payment.payment_mode.toUpperCase()}`,
      `• *Total Paid: ${formatCurrency(netPaid)}*`,
      member.pending_amount > 0
        ? `• Remaining Balance: ${formatCurrency(member.pending_amount)}`
        : `• Dues Status: Fully Cleared ✅`,
      `---------------------------------`,
      `Thank you for working out with us! 💪🏋️`,
    ]
    return lines.join('\n')
  }

  const handleCopy = () => {
    const text = generateReceiptText()
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Receipt details copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsAppShare = () => {
    if (!isValidPhone(member.phone)) {
      toast.error('Member phone number is invalid for WhatsApp')
      return
    }
    const text = generateReceiptText()
    const url = buildWaMeUrl(member.phone, text)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Background click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]">
        {/* Top Action Bar (hidden when printing) */}
        <div className="no-print flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Member Payment Receipt</h2>
              <p className="text-[11px] text-slate-500">Official proof of payment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5" id="printable-receipt">
          {/* Receipt Header */}
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                    {gymName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Fitness & Gym Management</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  PAID
                </span>
                <p className="text-xs font-mono font-bold text-slate-700 mt-1">{receiptId}</p>
              </div>
            </div>
          </div>

          {/* Member & Receipt Meta Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 border border-slate-100 rounded-xl p-3 sm:p-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Billed To</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{member.name}</p>
              <p className="text-slate-600 font-medium">{member.phone}</p>
              <p className="text-slate-500 mt-0.5">ID: {formatMemberId(member.member_number)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Receipt Info</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">Date: {paymentDate}</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5 capitalize">
                Method: <span className="uppercase font-bold">{payment.payment_mode}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Status: Completed</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {isMembership && m ? (
                  <>
                    <tr>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900 capitalize">
                          {m.plan} Membership Package
                        </p>
                        <p className="text-[11px] text-slate-500 capitalize">
                          Category: {m.category === 'both' || !m.category ? 'Strength + Cardio' : m.category}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Period: {formatDate(m.start_date)} — {formatDate(m.end_date)}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        {formatCurrency(planFee)}
                      </td>
                    </tr>
                    {admissionFee > 0 && (
                      <tr>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-slate-700">One-Time Admission / Registration Fee</p>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          +{formatCurrency(admissionFee)}
                        </td>
                      </tr>
                    )}
                    {dueOnPlan > 0 && (
                      <tr>
                        <td className="py-2 px-3 text-red-600">
                          <p className="font-medium">Unpaid Amount (Pending on this Plan)</p>
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-red-600">
                          -{formatCurrency(dueOnPlan)}
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">Past Due Balance Clearance</p>
                      <p className="text-[11px] text-slate-500">
                        Payment towards previously pending dues
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {formatCurrency(payment.amount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Total Paid Highlight */}
            <div className="bg-slate-50 border-t border-slate-200 px-3 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Total Paid Received:
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-700">
                {formatCurrency(netPaid)}
              </span>
            </div>
          </div>

          {/* Dues Status Banner */}
          <div className="flex items-center justify-between text-xs px-3 py-2 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-slate-600 font-medium">Member Due Balance:</span>
            <span
              className={cn(
                'font-bold',
                member.pending_amount > 0 ? 'text-red-600' : 'text-emerald-700'
              )}
            >
              {member.pending_amount > 0
                ? `${formatCurrency(member.pending_amount)} Pending`
                : 'PKR 0 (Fully Cleared ✓)'}
            </span>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-2 border-t border-dashed border-slate-200 text-slate-400 text-[10px] space-y-0.5">
            <p>This is a computer-generated digital receipt and requires no physical signature.</p>
            <p className="font-medium text-slate-500">Powered by GymFlow · Thank you for your workout!</p>
          </div>
        </div>

        {/* Bottom Actions Bar (hidden when printing) */}
        <div className="no-print p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
              title="Copy receipt summary"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {isValidPhone(member.phone) && (
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 active:scale-95 transition-all shadow-sm"
                title="Send receipt to member via WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm shadow-brand-200 active:scale-95 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
