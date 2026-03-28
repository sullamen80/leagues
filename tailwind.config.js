// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // Primary brand color
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        error: {
          light: '#fee2e2', // red-100
          main: '#ef4444',  // red-500
          dark: '#b91c1c',  // red-700
        },
        warning: {
          light: '#fef3c7', // yellow-100
          main: '#f59e0b',  // yellow-500
          dark: '#b45309',  // yellow-700
        },
        success: {
          light: '#d1fae5', // green-100
          main: '#10b981',  // green-500
          dark: '#047857',  // green-700
        },
        info: {
          light: '#dbeafe', // blue-100
          main: '#3b82f6',  // blue-500
          dark: '#1d4ed8',  // blue-700
        },
      },
      // Add consistent spacing scale
      spacing: {
        // We already have Tailwind's default spacing
      },
      // Add custom animation durations
      animation: {
        'spin-fast': 'spin 0.5s linear infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      // Border radius consistency
      borderRadius: {
        // We already have Tailwind's default radii
      },
      // Shadows consistency
      boxShadow: {
        // We already have Tailwind's default shadows
      },
      // Z-index system
      zIndex: {
        'modal': 1000,
        'dropdown': 100,
        'tooltip': 500,
      }
    },
  },
  plugins: [],
};