 'use client'
import PrayerLogsContent from '@/components/dashboard/prayer-logs-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function PrayerLogsPage() {
   return (
     <ProtectedClientPage requireAdmin>
       {({ userId }) => <PrayerLogsContent userId={userId} />}
     </ProtectedClientPage>
   )
 }
