/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Tahoma', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: '#122033',
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          500: '#1887d8',
          600: '#0d6fbb',
          700: '#0b568f',
          900: '#12324f',
        },
      },
      boxShadow: {
        soft: '0 20px 60px -30px rgba(15, 42, 69, 0.35)',
      },
    },
  },
  plugins: [],
};
