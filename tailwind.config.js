/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'zinc-950': '#08090d',
        'zinc-900': '#0f1117',
        'zinc-800': '#161a22',
      },
      fontFamily: {
        'bebas': ['"Bebas Neue"', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
