import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mercamio: {
          50: "#eff9f7",
          100: "#d7f0ea",
          200: "#b2e1d6",
          300: "#7bcbb9",
          400: "#3cad98",
          500: "#2a8f7c",
          600: "#1f7264",
          700: "#1b5c52",
          800: "#184a43",
          900: "#143c37",
        },
      },
    },
  },
  plugins: [],
};

export default config;
