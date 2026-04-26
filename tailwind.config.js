/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        arctic: {
          lightest: '#F7F8FD',
          light: '#D6E6EF',
          medium: '#7FA6B8',
          dark: '#2A3E4B',
        },
      },
      backgroundImage: {
        'gradient-arctic': 'linear-gradient(to right, #7FA6B8, #D6E6EF)',
        'gradient-arctic-dark': 'linear-gradient(135deg, #7FA6B8, #2A3E4B)',
      },
    },
  },
  plugins: [],
};
