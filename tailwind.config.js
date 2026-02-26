/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'val-red': '#ff4655',
        'val-red-dark': '#e84150',
        'val-black': '#0f1923',
        'val-dark-grey': '#1c2734',
        'val-light-grey': '#e0e0e0',
        'val-blue': '#009FE3',
      },
      fontFamily: {
        'valorant': ['Valorant', 'sans-serif'],
      }
    },
  },
  plugins: [],
}