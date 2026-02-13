 'use client'
import ActionQuestContent from '@/components/dashboard/action-quest-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function ActionQuestPage() {
   return (
     <ProtectedClientPage requireAdmin>
       {({ userId, isAdmin }) => <ActionQuestContent userId={userId} isAdmin={!!isAdmin} />}
     </ProtectedClientPage>
   )
 }
