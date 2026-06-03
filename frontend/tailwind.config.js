/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "system-ui", "sans-serif"],
        body:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'DM Mono'", "monospace"],
      },
      colors: {
        brand: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea6c10",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        surface: {
          DEFAULT: "#18181b",
          card:    "#1f1f23",
          raised:  "#27272a",
          border:  "#3f3f46",
          muted:   "#52525b",
        },
      },
    },
  },
  plugins: [],
  // Safelist ensures these dynamic classes are always generated
  safelist: [
    { pattern: /bg-brand-\d+\/(8|10|15|20|25|30)/ },
    { pattern: /bg-emerald-\d+\/(8|10|15|20)/ },
    { pattern: /bg-red-\d+\/(8|10|15|20)/ },
    { pattern: /border-brand-\d+\/(25|30|60)/ },
    { pattern: /border-emerald-\d+\/(25|30|60)/ },
    { pattern: /text-brand-\d+/ },
    { pattern: /ring-brand-\d+/ },
    { pattern: /shadow-brand-\d+\/(10|20|30)/ },
    'ring-offset-surface-card',
    'animate-slide-up',
    'animate-fade-in',
    'gradient-brand',
    'no-scrollbar',
  ],
};
