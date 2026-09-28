import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { addDays, addMonths, addYears, differenceInDays, format, isAfter, isBefore, parseISO } from 'date-fns'
import type { MemberStatus, Plan } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPlanDuration(plan: Plan): number {
  switch (plan) {
    case 'monthly': return 1
    case 'quarterly': return 3
    case 'annual': return 12
    case 'custom': return 1
  }
}

export function calcEndDate(startDate: string, plan: Plan, customMonths?: number): string {
  const start = parseISO(startDate)
  const months = plan === 'custom' ? (customMonths ?? 1) : getPlanDuration(plan)
  const end = addMonths(start, months)
  return format(end, 'yyyy-MM-dd')
}

export function getMemberStatus(endDate: string): MemberStatus {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (endDate < today) return 'expired'
  const daysLeft = differenceInDays(parseISO(endDate), parseISO(today))
  if (daysLeft <= 7) return 'expiring'
  return 'active'
}

export function getDaysRemaining(endDate: string): number {
  const today = format(new Date(), 'yyyy-MM-dd')
  return differenceInDays(parseISO(endDate), parseISO(today))
}

export function formatDate(date: string): string {
  return format(parseISO(date), 'dd MMM yyyy')
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'PKR 0'
  return `PKR ${Math.round(amount).toLocaleString('en-PK')}`
}

export function isValidPhone(phone: string): boolean {
  return /^[0-9]{10}$/.test(phone.replace(/\D/g, '').slice(-10))
}

/**
 * Auto-formats Pakistani CNIC numbers to XXXXX-XXXXXXX-X format as digits are typed.
 * Automatically inserts dashes at standard positions without requiring manual dash input.
 */
export function formatCNIC(val: string): string {
  if (!val) return ''
  const digits = val.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`
}

export function isValidCNIC(val: string): boolean {
  return /^\d{5}-\d{7}-\d{1}$/.test(val)
}

export function buildWhatsAppLink(phone: string, memberName: string, endDate: string): string {
  const message = `Hi ${memberName}! 🏋️ Your gym membership expires on ${formatDate(endDate)}. Please renew to continue your fitness journey. Contact us to renew.`
  return buildCustomWhatsAppLink(phone, message)
}

export function buildCustomWhatsAppLink(phone: string, message: string): string {
  let cleanPhone = phone.replace(/\D/g, '')
  while (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.slice(1)
  }
  // If already starts with country code 92 or 91
  if ((cleanPhone.startsWith('92') || cleanPhone.startsWith('91')) && cleanPhone.length >= 11) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
  }
  // Format with Pakistan country code +92
  const withCountryCode = cleanPhone.length >= 10 ? `92${cleanPhone.slice(-10)}` : `92${cleanPhone}`
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}

export const PLAN_LABELS: Record<Plan, string> = {
  monthly: 'Monthly (1 month)',
  quarterly: 'Quarterly (3 months)',
  annual: 'Annual (12 months)',
  custom: 'Custom',
}

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'Online / Bank Transfer',
  card: 'Card',
}
