 'use client'
import SkillLogsContent from '@/components/dashboard/skill-logs-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function SkillLogsPage() {
   return (
     <ProtectedClientPage>
       {() => <SkillLogsContent />}
     </ProtectedClientPage>
   )
 }
