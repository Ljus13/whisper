import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Victorian Gold Palette ── */
        gold: {
          50:  '#FDF8E8',
          100: '#FAF0CC',
          200: '#F5E199',
          300: '#E8C84D',
          400: '#D4AF37',
          500: '#C5A55A',
          600: '#A68B2E',
          700: '#8B7425',
          800: '#705D1C',
          900: '#4A3E13',
          950: '#2D2509',
        },
        /* ── Dark Victorian Backgrounds ── */
        victorian: {
          50:  '#F5F0EB',
          100: '#E8DFD4',
          200: '#C9B8A2',
          300: '#A89070',
          400: '#8A7053',
          500: '#6B5639',
          600: '#4A3A26',
          700: '#352A1C',
          800: '#231C14',
          900: '#1A1612',
          950: '#0F0D0A',
        },
        /* ── Metallic Accent ── */
        metal: {
          bronze: '#CD7F32',
          copper: '#B87333',
          iron:   '#48494B',
          steel:  '#71797E',
          silver: '#AAA9AD',
        },
        /* ── Art Nouveau Accent ── */
        nouveau: {
          emerald: '#2E5B3C',
          ruby:    '#8B1A2B',
          sapphire:'#1B3A5C',
          ivory:   '#FFFFF0',
          cream:   '#F5F0E1',
        },
      },
      fontFamily: {
        display: ['var(--font-kanit)', 'Kanit', 'sans-serif'],
        body:    ['var(--font-kanit)', 'Kanit', 'sans-serif'],
        ui:      ['var(--font-kanit)', 'Kanit', 'sans-serif'],
      },
      backgroundImage: {
        'victorian-gradient': 'linear-gradient(135deg, #1A1612 0%, #231C14 40%, #2D2509 100%)',
        'gold-gradient':     'linear-gradient(135deg, #C5A55A 0%, #D4AF37 50%, #E8C84D 100%)',
        'metal-gradient':    'linear-gradient(180deg, #48494B 0%, #71797E 50%, #AAA9AD 100%)',
      },
      boxShadow: {
        'gold':      '0 0 15px rgba(212, 175, 55, 0.3)',
        'gold-lg':   '0 0 30px rgba(212, 175, 55, 0.4)',
        'inner-gold':'inset 0 0 20px rgba(212, 175, 55, 0.1)',
      },
      borderColor: {
        'gold-subtle': 'rgba(212, 175, 55, 0.3)',
      },
      animation: {
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'float':   'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
