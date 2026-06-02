/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "system-ui", "sans-serif"],
        body:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'DM Mono'", "'Courier New'", "monospace"],
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
      animation: {
        "slide-up":  "slideUp 0.2s ease-out",
        "fade-in":   "fadeIn 0.15s ease-out",
      },
      keyframes: {
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      backgroundOpacity: { 8: "0.08" },
      opacity: { 8: "0.08" },
    },
  },
  plugins: [],
  safelist: [
    // Ensure these dynamic classes are always included
    "bg-brand-500/8",
    "bg-emerald-500/8",
    "shadow-brand-500/10",
    "shadow-brand-500/20",
    "shadow-brand-500/30",
    "ring-offset-surface-card",
  ],
};
