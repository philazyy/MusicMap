/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: '#1DB954',
        dark: {
          900: '#050508',
          800: '#0e0e15',
          700: '#161622',
          600: '#222230',
          500: '#323246'
        },
        accent: {
          purple: '#8B5CF6',
          pink: '#D946EF',
          cyan: '#06B6D4'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      boxShadow: {
        'glow-spotify': '0 0 20px rgba(29, 185, 84, 0.15)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.15)',
        'glow-pink': '0 0 20px rgba(217, 70, 239, 0.15)',
      }
    },
  },
  plugins: [],
}
