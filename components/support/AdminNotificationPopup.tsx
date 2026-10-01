'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Info,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Check,
  BellRing,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface AdminMessage {
  id: string
  gym_id: string
  subject: string
  body: string
  type: string
  created_at: string
  read_at: string | null
}

interface AdminNotificationPopupProps {
  gymId?: string | null
  initialMessages?: AdminMessage[]
}

export default function AdminNotificationPopup({
  gymId,
  initialMessages = [],
}: AdminNotificationPopupProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const dismissedIds = useRef<Set<string>>(new Set())

  // State for unread messages currently in the popup queue
  const [queue, setQueue] = useState<AdminMessage[]>(() =>
    initialMessages.filter((m) => !m.read_at)
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(() => initialMessages.filter((m) => !m.read_at).length > 0)
  const [isProcessing, setIsProcessing] = useState(false)

  // Don't show modal if user is explicitly on the notifications page
  const isNotificationsPage = pathname === '/account/notifications'

  // Update queue if initialMessages prop changes (e.g. navigation or re-render)
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      const unread = initialMessages.filter((m) => !m.read_at && !dismissedIds.current.has(m.id))
      if (unread.length > 0) {
        setQueue(unread)
        setIsOpen(true)
        setCurrentIndex(0)
      } else {
        setIsOpen(false)
      }
    }
  }, [initialMessages])

  // Realtime subscription for incoming broadcast notifications
  useEffect(() => {
    if (!gymId) return

    // 1. Broadcast channel listener
    const broadcastChannel = supabase
      .channel(`gym_support_realtime_popup_${gymId}`)
      .on(
        'broadcast',
        { event: 'new_admin_message' },
        async (payload: any) => {
          handleIncomingMessage(payload?.payload?.id)
        }
      )
      .on(
        'broadcast',
        { event: 'admin_message' },
        async (payload: any) => {
          handleIncomingMessage(payload?.payload?.id)
        }
      )
      .subscribe()

    // 2. Postgres CDC table listener for direct table inserts
    const cdcChannel = supabase
      .channel(`admin_messages_cdc_${gymId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_messages',
          filter: `gym_id=eq.${gymId}`,
        },
        (payload: any) => {
          const newRow = payload.new as AdminMessage
          if (newRow && !newRow.read_at) {
            setQueue((prev) => {
              if (prev.some((m) => m.id === newRow.id)) return prev
              return [newRow, ...prev]
            })
            setIsOpen(true)
          }
        }
      )
      .subscribe()

    async function handleIncomingMessage(msgId?: string) {
      if (msgId) {
        const { data: newMsg } = await supabase
          .from('admin_messages')
          .select('id, gym_id, subject, body, type, created_at, read_at')
          .eq('id', msgId)
          .single()

        if (newMsg && !newMsg.read_at) {
          setQueue((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [newMsg, ...prev]
          })
          setIsOpen(true)
        }
      } else {
        // Fetch all unread if no ID supplied
        const { data } = await supabase
          .from('admin_messages')
          .select('id, gym_id, subject, body, type, created_at, read_at')
          .eq('gym_id', gymId)
          .is('read_at', null)
          .eq('is_cleared_by_owner', false)
          .order('created_at', { ascending: false })

        if (data && data.length > 0) {
          setQueue(data)
          setIsOpen(true)
        }
      }
    }

    return () => {
      supabase.removeChannel(broadcastChannel)
      supabase.removeChannel(cdcChannel)
    }
  }, [gymId, supabase])

  // Helper to mark a message as read in database
  const markAsRead = useCallback(async (msgId: string) => {
    try {
      await fetch('/api/support/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId }),
      })

      // Notify other components like AccountMenu
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gymflow:admin_message_read', { detail: { messageId: msgId } }))
      }
    } catch (e) {
      console.error('Failed to mark notification as read:', e)
    }
  }, [])

  // Helper to mark all currently queued messages as read
  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/support/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gymflow:admin_message_read', { detail: { all: true } }))
      }
    } catch (e) {
      console.error('Failed to mark all as read:', e)
    }
  }, [])

  // Acknowledge single message: marks as read and advances or closes
  const handleAcknowledge = async () => {
    const activeMsg = queue[currentIndex]
    if (!activeMsg || isProcessing) return

    dismissedIds.current.add(activeMsg.id)
    setIsProcessing(true)
    await markAsRead(activeMsg.id)

    setQueue((prev) => prev.filter((m) => m.id !== activeMsg.id))

    if (queue.length <= 1) {
      setIsOpen(false)
      setCurrentIndex(0)
    } else {
      if (currentIndex >= queue.length - 1) {
        setCurrentIndex(Math.max(0, queue.length - 2))
      }
    }
    setIsProcessing(false)
  }

  // Dismiss / Close modal
  const handleDismiss = async () => {
    const activeMsg = queue[currentIndex]
    if (activeMsg) {
      dismissedIds.current.add(activeMsg.id)
      await markAsRead(activeMsg.id)
    }
    setIsOpen(false)
  }

  // Handle Mark All
  const handleMarkAll = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    queue.forEach((m) => dismissedIds.current.add(m.id))
    await markAllAsRead()
    setQueue([])
    setIsOpen(false)
    setCurrentIndex(0)
    setIsProcessing(false)
  }

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, queue, currentIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || queue.length === 0 || isNotificationsPage) {
    return null
  }

  const activeMsg = queue[currentIndex] || queue[0]
  if (!activeMsg) return null

  // Type-specific badge styling and iconography
  const typeConfig = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      badge: 'bg-red-100 text-red-700 border-red-200',
      iconBg: 'bg-red-600 text-white shadow-red-200',
      buttonBg: 'bg-red-600 hover:bg-red-700 text-white',
      accentGlow: 'shadow-[0_0_50px_-12px_rgba(239,68,68,0.35)]',
      label: 'Urgent Alert',
      Icon: AlertOctagon,
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-500 text-white shadow-amber-200',
      buttonBg: 'bg-amber-600 hover:bg-amber-700 text-white',
      accentGlow: 'shadow-[0_0_50px_-12px_rgba(245,158,11,0.35)]',
      label: 'Important Notice',
      Icon: AlertTriangle,
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-600 text-white shadow-emerald-200',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      accentGlow: 'shadow-[0_0_50px_-12px_rgba(16,185,129,0.35)]',
      label: 'Update',
      Icon: CheckCircle2,
    },
    info: {
      bg: 'bg-brand-50',
      border: 'border-brand-200',
      text: 'text-brand-800',
      badge: 'bg-brand-100 text-brand-700 border-brand-200',
      iconBg: 'bg-brand-600 text-white shadow-brand-200',
      buttonBg: 'bg-brand-600 hover:bg-brand-700 text-white',
      accentGlow: 'shadow-[0_0_50px_-12px_rgba(37,99,235,0.35)]',
      label: 'Announcement',
      Icon: Info,
    },
  }[activeMsg.type as 'error' | 'warning' | 'success' | 'info'] || {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    iconBg: 'bg-blue-600 text-white shadow-blue-200',
    buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white',
    accentGlow: 'shadow-[0_0_50px_-12px_rgba(59,130,246,0.35)]',
    label: 'Notice',
    Icon: Info,
  }

  const { Icon } = typeConfig

  const formattedDate = new Date(activeMsg.created_at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-notification-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden transition-all duration-300 transform scale-100 ${typeConfig.accentGlow}`}
      >
        {/* Top Accent Gradient Bar */}
        <div
          className={`h-2.5 w-full ${
            activeMsg.type === 'error'
              ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600'
              : activeMsg.type === 'warning'
              ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600'
              : activeMsg.type === 'success'
              ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600'
              : 'bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-600'
          }`}
        />

        {/* Modal Close Button */}
        <button
          onClick={handleDismiss}
          disabled={isProcessing}
          aria-label="Close notification"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Header Row: Icon + Type Badge + Pagination */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${typeConfig.iconBg}`}
              >
                <Icon className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${typeConfig.badge}`}
                  >
                    {typeConfig.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    From GymFlow Support
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {formattedDate}
                </p>
              </div>
            </div>

            {/* Pagination if multiple unread messages */}
            {queue.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl flex-shrink-0">
                <button
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 transition-colors"
                  title="Previous notice"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-700 px-1">
                  {currentIndex + 1} / {queue.length}
                </span>
                <button
                  onClick={() =>
                    setCurrentIndex((prev) => Math.min(queue.length - 1, prev + 1))
                  }
                  disabled={currentIndex === queue.length - 1}
                  className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 transition-colors"
                  title="Next notice"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Subject / Title */}
          <h2
            id="admin-notification-title"
            className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug mb-3"
          >
            {activeMsg.subject}
          </h2>

          {/* Body Content */}
          <div className="max-h-60 overflow-y-auto pr-1 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap rounded-xl bg-slate-50/80 p-4 border border-slate-100">
            {activeMsg.body}
          </div>

          {/* Action Row */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/account/notifications')
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors py-2 px-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View all notifications
            </button>

            <div className="w-full sm:w-auto flex items-center justify-end gap-2">
              {queue.length > 1 && (
                <button
                  onClick={handleMarkAll}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}

              <button
                onClick={handleAcknowledge}
                disabled={isProcessing}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 ${typeConfig.buttonBg}`}
              >
                {isProcessing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>{queue.length > 1 ? 'Got it (Next)' : 'I Understand'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
