/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./App.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: 'hsl(var(--color-background-light))',
          DEFAULT: 'hsl(var(--color-background))',
          dark: 'hsl(var(--color-background-dark))',
        },
        text: {
          light: 'hsl(var(--color-text-light))',
          DEFAULT: 'hsl(var(--color-text))',
          dark: 'hsl(var(--color-text-dark))',
        },
        primary: {
          light: 'hsl(var(--color-primary-light))',
          DEFAULT: 'hsl(var(--color-primary))',
          dark: 'hsl(var(--color-primary-dark))',
        },
        accent: {
          light: 'hsl(var(--color-accent-light))',
          DEFAULT: 'hsl(var(--color-accent))',
          dark: 'hsl(var(--color-accent-dark))',
        },
      },
      animation: {
        'typing': 'typing 1.2s ease-in-out infinite',
      },
      keyframes: {
        typing: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
} 