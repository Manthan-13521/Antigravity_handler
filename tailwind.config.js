/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#141414",
        surfaceElevated: "#1a1a1a",
        border: "#2a2a2a",
        textPrimary: "#fafafa",
        textSecondary: "#a3a3a3",
        textMuted: "#737373",
        accent: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
        focus: "#3b82f6",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
}