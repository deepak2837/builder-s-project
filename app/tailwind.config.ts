import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#ebedf1',
          200: '#d3d8e0',
          300: '#adb6c5',
          400: '#808ea5',
          500: '#60708a',
          600: '#4b5a72',
          700: '#3e495d',
          800: '#363e4e',
          900: '#303743',
          950: '#1f242d',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bcdcff',
          300: '#8ec7ff',
          400: '#59a8ff',
          500: '#3386fc',
          600: '#1d67f1',
          700: '#1652de',
          800: '#1944b4',
          900: '#1a3d8e',
          950: '#152756',
        },
        gain: '#0f8a5f',
        loss: '#c2410c',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        doc: '0 1px 3px rgba(16,24,40,0.08), 0 8px 24px -8px rgba(16,24,40,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
