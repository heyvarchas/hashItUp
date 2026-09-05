/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'command-blue': 'var(--color-command-blue)',
        'readiness-green': 'var(--color-readiness-green)',
        field: {
          bg: 'var(--color-field-bg)',
          surface: 'var(--color-field-surface)',
          'surface-subtle': 'var(--color-field-surface-subtle)',
          'surface-elevated': 'var(--color-field-surface-elevated)',
          border: 'var(--color-field-border)',
          'border-muted': 'var(--color-field-border-muted)',
          'border-light': 'var(--color-field-border-light)',
          primary: 'var(--color-field-primary)',
          muted: 'var(--color-field-muted)',
          faint: 'var(--color-field-faint)',
        },
        triage: {
          red: 'var(--color-triage-red)',
          'red-bg': 'var(--color-triage-red-bg)',
          'red-border': 'var(--color-triage-red-border)',
          amber: 'var(--color-triage-amber)',
          'amber-bg': 'var(--color-triage-amber-bg)',
          'amber-border': 'var(--color-triage-amber-border)',
          green: 'var(--color-triage-green)',
          'green-bg': 'var(--color-triage-green-bg)',
          'green-border': 'var(--color-triage-green-border)',
          blue: 'var(--color-triage-blue)',
          'blue-bg': 'var(--color-triage-blue-bg)',
          'blue-border': 'var(--color-triage-blue-border)',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
