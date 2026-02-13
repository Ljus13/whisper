 'use client'
import MapsContent from '@/components/dashboard/maps-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function MapsPage() {
   return (
     <ProtectedClientPage>
       {({ userId }) => <MapsContent userId={userId} />}
     </ProtectedClientPage>
   )
 }
