/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        nunito: ['Nunito', 'sans-serif'],
      },
      colors: {
        charcoal: '#181A18',
        slate: '#242724',
        matcha: '#8FA882',
        sage: '#757D6F',
        parchment: '#EEEAD7',
      },
    },
  },
  plugins: [],
};
