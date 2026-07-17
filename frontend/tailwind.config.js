/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Kanit', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f4faec',
          100: '#e6f4d5',
          200: '#cce9ac',
          300: '#aed979',
          400: '#94c84d',
          500: '#7cb333', // AIS-like Green
          600: '#608e23',
          700: '#4a6d1f',
          800: '#3d561d',
          900: '#35491c',
        },
      },
      keyframes: {
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        filterDropIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        scaleIn: 'scaleIn 0.2s ease-out forwards',
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        filterDropIn: 'filterDropIn 0.18s ease-out forwards',
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(124, 179, 51, 0.4)',
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
