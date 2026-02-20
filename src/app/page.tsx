import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/auth/login-form'

export default async function HomePage() {
  // If already logged in, redirect to dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[800px] h-[800px] rounded-full
                        bg-gold-400/[0.02] blur-3xl" />
        
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-64 h-64 opacity-5">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <path d="M0 0 C80 0, 200 80, 200 200" stroke="#D4AF37" strokeWidth="0.5" />
            <path d="M0 30 C60 30, 170 80, 170 200" stroke="#D4AF37" strokeWidth="0.3" />
            <path d="M30 0 C30 60, 80 170, 200 170" stroke="#D4AF37" strokeWidth="0.3" />
          </svg>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-5 rotate-180">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <path d="M0 0 C80 0, 200 80, 200 200" stroke="#D4AF37" strokeWidth="0.5" />
            <path d="M0 30 C60 30, 170 80, 170 200" stroke="#D4AF37" strokeWidth="0.3" />
            <path d="M30 0 C30 60, 80 170, 200 170" stroke="#D4AF37" strokeWidth="0.3" />
          </svg>
        </div>

        {/* Faint grid lines */}
        <div className="absolute inset-0 opacity-[0.015]"
             style={{
               backgroundImage: `
                 linear-gradient(rgba(212,175,55,1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)
               `,
               backgroundSize: '100px 100px',
             }} />
      </div>

      {/* Login form */}
      <div className="relative z-10 animate-fade-in">
        <LoginForm />
      </div>

      {/* Bottom attribution */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-victorian-600 text-sm font-body tracking-widest uppercase">
          Whisper — Campaign Companion
        </p>
      </div>
    </main>
  )
}
