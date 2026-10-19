/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#FFFFFF',
      black: '#000000',
      canvas: '#F6F2EA',
      surface: {
        DEFAULT: '#FFFCF7',
        muted: '#EDE7DD',
      },
      border: '#DDD4C6',
      ink: {
        DEFAULT: '#26241F',
        muted: '#666157',
      },
      header: '#2E2B25',
      primary: {
        DEFAULT: '#8C432E',
        hover: '#733524',
        soft: '#F5E5DE',
      },
      olive: {
        DEFAULT: '#5E6B45',
        soft: '#E7EBDC',
      },
      amber: {
        DEFAULT: '#8A5A36',
        soft: '#F2E7D9',
      },
      rust: {
        DEFAULT: '#96452F',
        soft: '#F4E4DE',
      },
      focus: '#A34E36',
    },
    borderColor: ({ theme }) => ({
      DEFAULT: theme('colors.border'),
      ...theme('colors'),
    }),
    ringColor: ({ theme }) => ({
      DEFAULT: theme('colors.focus'),
      ...theme('colors'),
    }),
    ringOffsetColor: ({ theme }) => theme('colors'),
    extend: {},
  },
  plugins: [],
};
