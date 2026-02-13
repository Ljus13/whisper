 'use client'
import BioTemplatesContent from '@/components/dashboard/bio-templates-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function BioTemplatesPage() {
   return (
     <ProtectedClientPage>
       {() => <BioTemplatesContent />}
     </ProtectedClientPage>
   )
 }
