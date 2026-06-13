/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f1a",
        panel: "#121826",
        border: "#1f2937",
        accent: "#38bdf8",
        up: "#22c55e",
        down: "#ef4444",
      },
    },
  },
  plugins: [],
};
