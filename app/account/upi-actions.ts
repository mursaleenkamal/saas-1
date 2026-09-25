'use server'

import { createClient } from '@/lib/supabase/server'
import { invalidateGymCache } from './actions'

export interface UPIConfig {
  id: string
  gym_id: string
  upi_id: string
  merchant_name: string
  merchant_code: string | null
  currency: string
  raw_params: Record<string, any>
  created_at: string
  updated_at: string
}

export type OnlinePaymentProvider = 'jazzcash' | 'easypaisa' | 'raast' | 'bank'

export interface PakistanPaymentConfig {
  default_provider: OnlinePaymentProvider
  jazzcash_number?: string
  jazzcash_title?: string
  easypaisa_number?: string
  easypaisa_title?: string
  raast_id?: string
  raast_title?: string
  bank_name?: string
  bank_account?: string
  bank_title?: string
}

/**
 * Fetch the payment merchant config for the authenticated user's gym.
 * Returns null if not configured yet.
 */
export async function getUPIConfig(): Promise<UPIConfig | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, onboarding_data')
    .eq('owner_id', session.user.id)
    .single()
  if (!gym) return null

  const { data } = await supabase
    .from('gym_upi_config')
    .select('*')
    .eq('gym_id', gym.id)
    .maybeSingle()

  if (data) {
    return data as UPIConfig
  }

  // Fallback: check onboarding_data.payment_config
  const ob = (gym.onboarding_data as Record<string, any>) ?? {}
  if (ob.payment_config) {
    return {
      id: '',
      gym_id: gym.id,
      upi_id: ob.payment_config.jazzcash_number || ob.payment_config.easypaisa_number || ob.payment_config.raast_id || '',
      merchant_name: ob.payment_config.jazzcash_title || ob.payment_config.easypaisa_title || '',
      merchant_code: null,
      currency: 'PKR',
      raw_params: ob.payment_config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return null
}

/**
 * Save Pakistani payment config (JazzCash, EasyPaisa, Raast, Bank)
 */
export async function savePakistanPaymentConfig(
  config: PakistanPaymentConfig
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false, error: 'Unauthorized' }

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name, onboarding_data')
    .eq('owner_id', session.user.id)
    .single()
  if (!gym) return { success: false, error: 'Gym not found' }

  const primaryNumber =
    (config.default_provider === 'jazzcash' && config.jazzcash_number) ||
    (config.default_provider === 'easypaisa' && config.easypaisa_number) ||
    (config.default_provider === 'raast' && config.raast_id) ||
    config.jazzcash_number ||
    config.easypaisa_number ||
    config.raast_id ||
    config.bank_account ||
    ''

  const primaryTitle =
    (config.default_provider === 'jazzcash' && config.jazzcash_title) ||
    (config.default_provider === 'easypaisa' && config.easypaisa_title) ||
    (config.default_provider === 'raast' && config.raast_title) ||
    config.jazzcash_title ||
    config.easypaisa_title ||
    config.raast_title ||
    config.bank_title ||
    gym.name ||
    'GymFlow Merchant'

  const row = {
    gym_id: gym.id,
    upi_id: primaryNumber || 'pk_online_pay',
    merchant_name: primaryTitle,
    merchant_code: null,
    currency: 'PKR',
    raw_params: {
      ...config,
      is_pakistan: true,
    },
    updated_at: new Date().toISOString(),
  }

  // Upsert to gym_upi_config
  const { error } = await supabase
    .from('gym_upi_config')
    .upsert(row, { onConflict: 'gym_id' })

  if (error) {
    return { success: false, error: error.message }
  }

  // Also update gym onboarding_data cache
  try {
    const ob = (gym.onboarding_data as Record<string, any>) ?? {}
    const updatedOb = { ...ob, payment_config: config }
    await supabase.from('gyms').update({ onboarding_data: updatedOb }).eq('id', gym.id)
    await invalidateGymCache()
  } catch (e) {
    // Non-critical cache update failure
  }

  return { success: true }
}

/**
 * Backward-compatible save for UPI / raw params
 */
export async function saveUPIConfig(params: {
  upiId: string
  merchantName: string
  merchantCode?: string | null
  currency?: string
  rawParams: Record<string, any>
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false, error: 'Unauthorized' }

  const { data: gym } = await supabase
    .from('gyms')
    .select('id')
    .eq('owner_id', session.user.id)
    .single()
  if (!gym) return { success: false, error: 'Gym not found' }

  const row = {
    gym_id: gym.id,
    upi_id: params.upiId,
    merchant_name: params.merchantName,
    merchant_code: params.merchantCode ?? null,
    currency: params.currency ?? 'PKR',
    raw_params: params.rawParams,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('gym_upi_config')
    .upsert(row, { onConflict: 'gym_id' })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Delete the merchant config
 */
export async function deleteUPIConfig(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { success: false, error: 'Unauthorized' }

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, onboarding_data')
    .eq('owner_id', session.user.id)
    .single()
  if (!gym) return { success: false, error: 'Gym not found' }

  const { error } = await supabase
    .from('gym_upi_config')
    .delete()
    .eq('gym_id', gym.id)

  if (error) {
    return { success: false, error: error.message }
  }

  try {
    const ob = (gym.onboarding_data as Record<string, any>) ?? {}
    delete ob.payment_config
    await supabase.from('gyms').update({ onboarding_data: ob }).eq('id', gym.id)
    await invalidateGymCache()
  } catch (e) {}

  return { success: true }
}
