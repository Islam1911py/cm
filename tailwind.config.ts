import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
      fontFamily: {
        sans: ['Cairo', 'IBM Plex Sans Arabic', 'sans-serif'],
      },
  		colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: '#18181b',
          foreground: '#fafafa'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: '#10b981',
          foreground: '#ffffff'
        },
        secondary: {
          DEFAULT: '#3b82f6',
          foreground: '#ffffff'
        },
        muted: {
          DEFAULT: '#71717a',
          foreground: '#a1a1aa'
        },
        accent: {
          DEFAULT: '#10b981',
          foreground: '#ffffff'
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff'
        },
        border: '#27272a',
        input: '#27272a',
        ring: '#10b981',
        chart: {
          '1': '#10b981',
          '2': '#ef4444',
          '3': '#f59e0b',
          '4': '#3b82f6',
          '5': '#8b5cf6'
        },
        paid: '#10b981',
        pending: '#ef4444',
        balance: '#f59e0b',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
  		},
      spacing: {
        'xs': '0.25rem',
        'sm': '0.5rem',
        'base': '1rem',
        'lg': '1.5rem',
        'xl': '2rem',
        '2xl': '2.5rem',
        '3xl': '3rem',
        '4xl': '4rem',
      }
  	}
  },
  plugins: [tailwindcssAnimate],
};
export default config;
