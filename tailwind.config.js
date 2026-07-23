/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          DEFAULT: "#0F3B36",
          light: "#EAF3EF",
        },
        ball: "#C4F135",
      },
    },
  },
  plugins: [],
};
