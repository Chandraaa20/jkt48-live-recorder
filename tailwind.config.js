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
        dark: {
          bg: '#0a0d14',
          card: '#111622',
          border: '#1f293d',
          hover: '#192236',
          muted: '#8b9bb4'
        },
        jkt: {
          red: '#e11d48',
          redDark: '#be123c',
          pink: '#f43f5e',
          accent: '#fb7185'
        },
        platform: {
          idn: '#ef4444',
          idnDark: '#b91c1c',
          showroom: '#06b6d4',
          showroomDark: '#0891b2'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
