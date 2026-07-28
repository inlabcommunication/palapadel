/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        black: "#0A0C07",
        "green-deep": "#123008",
        "green-mid": "#1F4A15",
        "green-card": "#0A0B08",
        "green-brand": "#3B7A2A",
        lime: "#BBFF5E",
        "lime-dim": "#93D944",
        cream: "#FBF3DE",
        // alias mantenuto per compatibilità: ora punta al verde di brand, non più usato per sfondi bottone
        court: {
          DEFAULT: "#3B7A2A",
          light: "#142C0D",
        },
      },
      fontFamily: {
        display: ["Anton", "sans-serif"],
        body: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
