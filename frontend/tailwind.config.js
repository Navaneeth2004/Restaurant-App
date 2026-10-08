/** @type {import('tailwindcss').Config} */

// Colours that must change between dark and light mode are defined as CSS
// variables (see the :root / html[data-theme="light"] blocks in src/index.css)
// and referenced here. `<alpha-value>` keeps opacity modifiers working, so
// classes like bg-surface-card/50 or text-red-400/60 still behave normally.
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const ZINC_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

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
          DEFAULT: rgb('surface'),
          card:    rgb('surface-card'),
          raised:  rgb('surface-raised'),
          border:  rgb('surface-border'),
          muted:   rgb('surface-muted'),
        },
        // Neutral scale: flipped in light mode so text-zinc-300 (light grey on
        // dark) becomes dark grey on white, bg-zinc-800 becomes a light chip, etc.
        zinc: Object.fromEntries(ZINC_SHADES.map(n => [n, rgb(`zinc-${n}`)])),
        // Only the shades used as TEXT on surfaces need to darken in light mode.
        red:     { 300: rgb('red-300'),     400: rgb('red-400') },
        emerald: { 400: rgb('emerald-400') },
        amber:   { 400: rgb('amber-400') },
        blue:    { 400: rgb('blue-400') },
        indigo:  { 300: rgb('indigo-300'),  400: rgb('indigo-400') },
        purple:  { 400: rgb('purple-400') },
        green:   { 400: rgb('green-400') },
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