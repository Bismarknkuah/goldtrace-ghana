/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false }, // MUI owns the base reset; Tailwind = utilities only
  theme: {
    extend: {
      colors: {
        ink: "#0C1813",
        moss: "#10261C",
        gold: "#C9A227",
        goldlight: "#E4B84C",
        parchment: "#F6F2E9",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
