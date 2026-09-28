import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, ROUTE_LIMITS } from '@/lib/rateLimit'

interface MembershipPlan {
  planName: string
  category: 'strength' | 'cardio' | 'both'
  duration: 'monthly' | 'quarterly' | 'annual' | 'custom'
  price: number
  joiningFee: number
  hasDiscount: boolean
  discountPercent: number
  hasFreezeOption: boolean
  customDurationMonths?: number
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const { allowed } = await checkRateLimit(user.id, '/api/onboarding/complete', ROUTE_LIMITS.DEFAULT)
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' } },
        { status: 429 }
      )
    }

    let body: {
      gymId?: string
      gymName?: string
      gymType?: string
      branchCount?: number
      address?: string
      openingYear?: number
      phone?: string
      city?: string
      plans?: any
      metrics?: any
      operations?: any
      paymentSettings?: any
      marketing?: any
      aiPersonalization?: any
    }
    try { body = await req.json() } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
        { status: 400 }
      )
    }

    const { gymId, gymName, gymType, branchCount, address, openingYear, phone, city,
            plans, metrics, operations, paymentSettings, marketing, aiPersonalization } = body

    if (!gymName?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'gymName is required' } },
        { status: 400 }
      )
    }

    const onboardingData = {
      gymType, branchCount, address, openingYear,
      city, phone,                          // stored in JSONB — always safe
      plans, metrics, operations, marketing, aiPersonalization,
      payment_config: paymentSettings || null,
      completedAt: new Date().toISOString(),
    }

    const adminClient = createAdminClient()

    // Determine target gym ID — if not passed, find if user already has a gym record
    let targetGymId = gymId
    if (!targetGymId) {
      const { data: existingGym } = await adminClient
        .from('gyms')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (existingGym?.id) {
        targetGymId = existingGym.id
      }
    }

    if (targetGymId) {
      const { error: updateError } = await adminClient
        .from('gyms')
        .update({
          name: gymName.trim(),
          onboarding_completed: true,
          onboarding_data: onboardingData,
        })
        .eq('id', targetGymId)
        .eq('owner_id', user.id)

      if (updateError) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: updateError.message } },
          { status: 500 }
        )
      }

      // Upsert plan prices — including joining fees per plan
      if (Array.isArray(plans) && plans.length > 0) {
        const monthly        = (plans as MembershipPlan[]).find(p => p.duration === 'monthly')?.price      ?? 1500
        const quarterly      = (plans as MembershipPlan[]).find(p => p.duration === 'quarterly')?.price   ?? 4000
        const annual         = (plans as MembershipPlan[]).find(p => p.duration === 'annual')?.price      ?? 10000
        const joining_fee_monthly   = (plans as MembershipPlan[]).find(p => p.duration === 'monthly')?.joiningFee   ?? 0
        const joining_fee_quarterly = (plans as MembershipPlan[]).find(p => p.duration === 'quarterly')?.joiningFee ?? 0
        const joining_fee_annual    = (plans as MembershipPlan[]).find(p => p.duration === 'annual')?.joiningFee    ?? 0
        await adminClient.from('gym_plan_prices').upsert(
          { gym_id: targetGymId, monthly, quarterly, annual,
            joining_fee_monthly, joining_fee_quarterly, joining_fee_annual,
            updated_at: new Date().toISOString() },
          { onConflict: 'gym_id' }
        )
      }
    } else {
      // Create gym record for first-time users — start their 14-day trial
      const TRIAL_DURATION_DAYS = parseInt(process.env.TRIAL_DURATION_DAYS ?? '14', 10)
      const now = new Date()
      const trialEndsAt = new Date(now)
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

      const { data: newGym, error: insertError } = await adminClient
        .from('gyms')
        .insert({
          name: gymName.trim(),
          owner_id: user.id,
          onboarding_completed: true,
          onboarding_data: onboardingData,
          // Subscription trial fields
          subscription_status: 'trial',
          plan_type: 'trial',
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !newGym) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: insertError?.message ?? 'Failed to create gym' } },
          { status: 500 }
        )
      }

      targetGymId = newGym.id

      if (Array.isArray(plans) && plans.length > 0) {
        const monthly        = (plans as MembershipPlan[]).find(p => p.duration === 'monthly')?.price      ?? 1500
        const quarterly      = (plans as MembershipPlan[]).find(p => p.duration === 'quarterly')?.price   ?? 4000
        const annual         = (plans as MembershipPlan[]).find(p => p.duration === 'annual')?.price      ?? 10000
        const joining_fee_monthly   = (plans as MembershipPlan[]).find(p => p.duration === 'monthly')?.joiningFee   ?? 0
        const joining_fee_quarterly = (plans as MembershipPlan[]).find(p => p.duration === 'quarterly')?.joiningFee ?? 0
        const joining_fee_annual    = (plans as MembershipPlan[]).find(p => p.duration === 'annual')?.joiningFee    ?? 0
        await adminClient.from('gym_plan_prices').upsert(
          { gym_id: newGym.id, monthly, quarterly, annual,
            joining_fee_monthly, joining_fee_quarterly, joining_fee_annual },
          { onConflict: 'gym_id' }
        )
      }
    }

    // Upsert Online Payment (JazzCash / EasyPaisa / Raast) configuration if provided
    if (targetGymId && paymentSettings) {
      const primaryNumber =
        paymentSettings.jazzcashNumber?.trim() ||
        paymentSettings.easypaisaNumber?.trim() ||
        paymentSettings.raastId?.trim() ||
        ''
      const primaryTitle =
        paymentSettings.jazzcashTitle?.trim() ||
        paymentSettings.easypaisaTitle?.trim() ||
        paymentSettings.raastTitle?.trim() ||
        gymName.trim()

      if (primaryNumber) {
        const defaultProvider = paymentSettings.jazzcashNumber?.trim()
          ? 'jazzcash'
          : paymentSettings.easypaisaNumber?.trim()
          ? 'easypaisa'
          : 'raast'

        await adminClient.from('gym_upi_config').upsert(
          {
            gym_id: targetGymId,
            upi_id: primaryNumber,
            merchant_name: primaryTitle,
            merchant_code: null,
            currency: 'PKR',
            raw_params: {
              is_pakistan: true,
              default_provider: defaultProvider,
              jazzcash_number: paymentSettings.jazzcashNumber?.trim() || '',
              jazzcash_title: paymentSettings.jazzcashTitle?.trim() || primaryTitle,
              easypaisa_number: paymentSettings.easypaisaNumber?.trim() || '',
              easypaisa_title: paymentSettings.easypaisaTitle?.trim() || primaryTitle,
              raast_id: paymentSettings.raastId?.trim() || '',
              raast_title: paymentSettings.raastTitle?.trim() || primaryTitle,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'gym_id' }
        )
      }
    }

    // Bust the gym identity cache so getGym() returns the fresh name and
    // onboarding_completed = true on the next request.
    const { invalidateGymIdentityCache } = await import('@/lib/cache')
    await invalidateGymIdentityCache(user.id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: (err instanceof Error ? err.message : String(err)) } },
      { status: 500 }
    )
  }
}
