import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F1E7',
        surface: '#FFFFFF',
        ivory: '#FAF6EC',
        ink: '#1A1A1A',
        muted: '#6B6B6B',
        line: '#E5DDC9',
        forest: '#1F3A2D',
        'forest-soft': '#2C5240',
        terracotta: '#C45A2C',
        'terracotta-soft': '#D77548',
        easy: { bg: '#E8F0E9', fg: '#2E5C3E' },
        moderate: { bg: '#FBF1DC', fg: '#8B6914' },
        hard: { bg: '#F8E0D9', fg: '#9B3D2C' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        paper: '0 1px 3px rgba(31, 58, 45, 0.04), 0 8px 24px rgba(31, 58, 45, 0.06)',
        card: '0 1px 2px rgba(31, 58, 45, 0.04), 0 2px 8px rgba(31, 58, 45, 0.04)',
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
