 'use client'
import PlayersContent from '@/components/dashboard/players-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function PlayersPage() {
   return (
     <ProtectedClientPage>
       {({ userId }) => <PlayersContent userId={userId} />}
     </ProtectedClientPage>
   )
 }
