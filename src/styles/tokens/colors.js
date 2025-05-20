// src/styles/tokens/colors.js

// Base palette
const palette = {
  // Primary brand colors
  indigo: {
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
  
  // Neutrals
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Semantic colors
  red: {
    100: '#fee2e2',
    500: '#ef4444',
    700: '#b91c1c',
  },
  
  yellow: {
    100: '#fef3c7',
    500: '#f59e0b',
    700: '#b45309',
  },
  
  green: {
    100: '#d1fae5',
    500: '#10b981',
    700: '#047857',
  },
  
  blue: {
    100: '#dbeafe',
    500: '#3b82f6',
    700: '#1d4ed8',
  },
};

// Semantic color assignments
const colors = {
  primary: palette.indigo,
  
  // UI state colors (using direct color names instead of semantic names)
  red: {
    light: palette.red[100],
    main: palette.red[500],
    dark: palette.red[700],
  },
  
  blue: {
    light: palette.blue[100],
    main: palette.blue[500],
    dark: palette.blue[700],
  },
  
  green: {
    light: palette.green[100],
    main: palette.green[500],
    dark: palette.green[700],
  },
  
  // Text colors
  text: {
    primary: palette.gray[900],
    secondary: palette.gray[600],
    disabled: palette.gray[400],
    white: '#ffffff'
  },
  
  // Background colors
  background: {
    default: '#ffffff',
    paper: palette.gray[50],
  },
  
  // Border colors
  border: {
    light: palette.gray[200],
    main: palette.gray[300],
  },
};

// Helper function to get Tailwind class names
export const getColorClass = (type, variant, element = 'bg') => {
  switch (type) {
    case 'background':
      if (variant === 'default') return 'bg-white';
      if (variant === 'paper') return 'bg-gray-50';
      return `${element}-gray-${variant}`;
    case 'primary':
      return `${element}-indigo-${variant}`;
    case 'red':
      if (variant === 'light') return `${element}-red-100`;
      if (variant === 'main') return `${element}-red-500`;
      if (variant === 'dark') return `${element}-red-700`;
      return `${element}-red-${variant}`;
    case 'blue':
      if (variant === 'light') return `${element}-blue-100`;
      if (variant === 'main') return `${element}-blue-500`;
      if (variant === 'dark') return `${element}-blue-700`;
      return `${element}-blue-${variant}`;
    case 'green':
      if (variant === 'light') return `${element}-green-100`;
      if (variant === 'main') return `${element}-green-500`;
      if (variant === 'dark') return `${element}-green-700`;
      return `${element}-green-${variant}`;
    case 'text':
      if (variant === 'primary') return 'text-gray-900';
      if (variant === 'secondary') return 'text-gray-600';
      if (variant === 'disabled') return 'text-gray-400';
      if (variant === 'white') return 'text-white';  
      return `${element}-gray-${variant}`;
    case 'border':
      if (variant === 'light') return 'border-gray-200';
      if (variant === 'main') return 'border-gray-300';
      return `${element}-gray-${variant}`;
    case 'gray':
    default:
      return `${element}-gray-${variant}`;
  }
};

export { palette, colors };