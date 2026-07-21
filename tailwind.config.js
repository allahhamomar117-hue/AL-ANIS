/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // مفعل الداكن
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        cairo: ["Cairo", "sans-serif"],
      },
      colors: {
        primary: {
          light: "#4ADE80",
          DEFAULT: "#16A34A",
          dark: "#166534",
        },
        white: {
          light: "#F9FAFB",
          DEFAULT: "#FFFFFF",
          dark: "#D4D4D4",
        },
        dark: {
          light: "#3A3A3A",
          DEFAULT: "#222222",
          dark: "#111111",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
