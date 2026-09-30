import { createAdminClient } from '@/lib/supabase/admin'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const supabase = createAdminClient()

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const initialSettings = settings || {
    id: 1,
    upi_id: 'gymflow@upi',
    upi_name: 'GymFlow Platform',
    price_monthly: 2999,
    price_yearly: 29999,
  }

  return <SettingsClient initialSettings={initialSettings} />
}
