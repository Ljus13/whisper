import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BioTemplatesContent from '@/components/dashboard/bio-templates-content'

export default async function BioTemplatesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  return <BioTemplatesContent />
}
