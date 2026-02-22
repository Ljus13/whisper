'use client'

import { LogIn, LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'

export function AuthButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter()

  if (isLoggedIn) {
    return (
      <button
        onClick={async () => { await signOut() }}
        className="flex items-center gap-1.5 text-sm text-victorian-400 hover:text-gold-300 transition-colors cursor-pointer"
        title="ออกจากระบบ"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">ออกจากระบบ</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => router.push('/auth')}
      className="flex items-center gap-1.5 text-sm text-victorian-400 hover:text-gold-300 transition-colors cursor-pointer"
      title="เข้าสู่ระบบ"
    >
      <LogIn className="w-4 h-4" />
      <span className="hidden sm:inline">เข้าสู่ระบบ</span>
    </button>
  )
}
