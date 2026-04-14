/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     'var(--color-bg-base)',
          surface:  'var(--color-bg-surface)',
          elevated: 'var(--color-bg-elevated)',
          overlay:  'var(--color-bg-overlay)',
        },
        'border-subtle':  'var(--color-border-subtle)',
        'border-default': 'var(--color-border-default)',
        'border-strong':  'var(--color-border-strong)',
        text: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted:     'var(--color-text-muted)',
          inverted:  'var(--color-text-inverted)',
        },
        brand: {
          primary:   'var(--color-brand-primary)',
          secondary: 'var(--color-brand-secondary)',
        },
        status: {
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          danger:  'var(--color-status-danger)',
          info:    'var(--color-status-info)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm:   '4px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl':'24px',
      },
      boxShadow: {
        'elevation-0': 'none',
        'elevation-1': '0 1px 2px rgba(0,0,0,0.2)',
        'elevation-2': '0 4px 8px rgba(0,0,0,0.25)',
        'elevation-3': '0 8px 24px rgba(0,0,0,0.3)',
        'elevation-4': '0 16px 48px rgba(0,0,0,0.4)',
        'elevation-5': '0 24px 64px rgba(0,0,0,0.5)',
      },
      animation: {
        shimmer:      'shimmer 1.5s infinite',
        'ai-pulse':   'ai-pulse 2s infinite',
        'bounce-dot': 'bounce-dot 1.4s infinite',
        'fade-in':    'fade-in 200ms ease-out',
        'slide-up':   'slide-up 300ms cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'ai-pulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(139,92,246,0.4)' },
          '50%':  { boxShadow: '0 0 0 8px rgba(139,92,246,0.1)' },
          '100%': { boxShadow: '0 0 0 0 rgba(139,92,246,0)' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'translateY(0)',    opacity: '0.4' },
          '40%':           { transform: 'translateY(-6px)', opacity: '1'   },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34,1.56,0.64,1)',
        snappy: 'cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
}

