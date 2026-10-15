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
        earth: {
          bg: '#FAF8F2',
          card: '#FFFFFF',
          border: '#E8E1D5',
          borderLight: '#F1EBE1',
          primary: '#3D5E52',
          primaryHover: '#314D43',
          primaryLight: '#EAF1EE',
          primaryBorder: '#BED5CC',
          dark: '#2B2522',
          darkMuted: '#6D655F',
          sand: '#E6D8C6',
          sandLight: '#F7EFE4',
          sandDark: '#6E5844',
          teal: '#2F4855',
          tealLight: '#ECF2F6',
          live: '#C94A3D',
        },
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
