/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0b1524', 900: '#111c2d', 800: '#1e2a3c', 700: '#334155', 600: '#475569',
          500: '#64748b', 400: '#94a3b8', 300: '#cbd5e1', 200: '#e2e8f0', 100: '#f1f5f9', 50: '#f8fafc',
        },
        brand: {
          50: '#effaf7', 100: '#d7f1ea', 200: '#afe2d5', 300: '#7ccbb9', 400: '#4aae9a',
          500: '#2a9180', 600: '#1d7568', 700: '#1a5e55', 800: '#184c46', 900: '#163f3b',
        },
        canvas: '#f6f7f9',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.05)',
        pop: '0 8px 24px -6px rgba(16, 24, 40, 0.18)',
      },
      borderRadius: { md: '6px', lg: '8px', xl: '10px' },
    },
  },
  plugins: [],
};
