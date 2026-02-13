 'use client'
import SkillsContent from '@/components/dashboard/skills-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function SkillsPage() {
   return (
     <ProtectedClientPage>
       {({ userId }) => <SkillsContent userId={userId} />}
     </ProtectedClientPage>
   )
 }
