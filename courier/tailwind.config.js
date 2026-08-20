/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#16A34A",
          light: "#22C55E",
          dark: "#15803D",
        },
      },
    },
  },
  plugins: [],
};
