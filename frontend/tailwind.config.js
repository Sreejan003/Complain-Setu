/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aicte: {
          navy: {
            50: '#f0f4f9',
            100: '#dce5f1',
            200: '#bdcfe3',
            300: '#8eb3d1',
            400: '#5891bc',
            500: '#3473a5',
            600: '#265b87',
            700: '#1e486d',
            800: '#193957',
            900: '#0f2942',
            950: '#0a1a2c',
          },
          gold: {
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
          },
          teal: {
            500: '#0d9488',
            600: '#0f766e',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
