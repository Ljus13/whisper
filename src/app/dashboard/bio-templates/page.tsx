import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BioTemplatesContent from '@/components/dashboard/bio-templates-content'

export default async function BioTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <BioTemplatesContent />
}
