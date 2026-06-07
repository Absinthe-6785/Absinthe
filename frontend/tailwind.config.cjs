/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-alt': 'var(--color-surface-alt)',
        foreground: 'var(--color-text)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          foreground: 'var(--color-primary-fg)',
        },
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        sidebar: {
          DEFAULT: 'var(--color-sidebar)',
          hover: 'var(--color-sidebar-hover)',
          muted: 'var(--color-sidebar-muted)',
        },
        input: {
          DEFAULT: 'var(--color-input)',
          border: 'var(--color-input-border)',
        },
        'accent-bg': 'var(--color-accent-bg)',
      },
      spacing: {
        'absinthe-xs': 'var(--spacing-xs)',
        'absinthe-sm': 'var(--spacing-sm)',
        'absinthe-md': 'var(--spacing-md)',
        'absinthe-lg': 'var(--spacing-lg)',
        'absinthe-xl': 'var(--spacing-xl)',
        'absinthe-2xl': 'var(--spacing-2xl)',
        page: 'var(--spacing-page)',
      },
      borderRadius: {
        'absinthe-sm': 'var(--radius-sm)',
        'absinthe-md': 'var(--radius-md)',
        'absinthe-lg': 'var(--radius-lg)',
        'absinthe-xl': 'var(--radius-xl)',
        'absinthe-2xl': 'var(--radius-2xl)',
        'absinthe-full': 'var(--radius-full)',
      },
      boxShadow: {
        'absinthe-sm': 'var(--shadow-sm)',
        'absinthe-md': 'var(--shadow-md)',
        'absinthe-lg': 'var(--shadow-lg)',
        'absinthe-xl': 'var(--shadow-xl)',
        'absinthe-menu': 'var(--shadow-menu)',
      },
      ringColor: {
        primary: 'var(--color-primary)',
      },
    },
  },
  plugins: [],
};
