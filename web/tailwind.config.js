/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        field: {
          bg: '#0B0F13',
          surface: '#131A21',
          'surface-subtle': '#0E1419',
          'surface-elevated': '#18222B',
          border: '#222D37',
          'border-muted': '#192229',
          'border-light': '#2E3D4A',
          primary: '#E3E8ED',
          muted: '#8294A2',
          faint: '#4E5E6C',
        },
        triage: {
          red: '#D6453D',
          'red-bg': '#261214',
          'red-border': '#591C1E',
          amber: '#C97A1E',
          'amber-bg': '#261C0F',
          'amber-border': '#593B16',
          green: '#2E8B68',
          'green-bg': '#0F241C',
          'green-border': '#1A4D39',
          blue: '#2965A8',
          'blue-bg': '#0F1D2C',
          'blue-border': '#1E3E61',
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

