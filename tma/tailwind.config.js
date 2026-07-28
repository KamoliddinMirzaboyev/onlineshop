/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#16A34A",
          dark: "#15803D",
          light: "#BBF7D0",
        },
        tg: {
          bg: "var(--tg-bg, #ffffff)",
          text: "var(--tg-text, #000000)",
          hint: "var(--tg-hint, #999999)",
          card: "var(--tg-card, #f4f4f5)",
        },
      },
    },
  },
  plugins: [],
};
