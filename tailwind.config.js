/** Tailwind is mapped to styles/tokens.css only. No default palette is exposed. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: {
        DEFAULT: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        elevated: 'var(--bg-elevated)',
      },
      ink: {
        DEFAULT: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
      },
      line: 'var(--border)',
      brand: { blue: 'var(--brand-blue)', gold: 'var(--brand-gold)' },
      success: 'var(--success)',
      warning: 'var(--warning)',
      danger: 'var(--danger)',
    },
    fontFamily: {
      sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    fontSize: {
      hero: ['var(--fs-hero)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
      h1: ['var(--fs-h1)', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
      h2: ['var(--fs-h2)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      body: ['var(--fs-body)', { lineHeight: '1.65' }],
      small: ['var(--fs-small)', { lineHeight: '1.5' }],
      label: ['var(--fs-label)', { lineHeight: '1.2', letterSpacing: '0.08em' }],
    },
    spacing: {
      0: '0',
      px: '1px',
      1: 'var(--space-1)',
      2: 'var(--space-2)',
      3: 'var(--space-3)',
      4: 'var(--space-4)',
      5: 'var(--space-5)',
      6: 'var(--space-6)',
      7: 'var(--space-7)',
      8: 'var(--space-8)',
      9: 'var(--space-9)',
    },
    borderRadius: { none: '0', sm: '2px', DEFAULT: '4px' },
    extend: {
      maxWidth: { page: 'var(--page-max)' },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
};
