import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        background: "#050816",

        card: "#0B1120",

        primary: "#00D2FF",

        secondary: "#007CF0",
      },

      fontFamily: {
        sans: ["var(--font-inter)"],
      },

      boxShadow: {
        glow:
          "0 0 30px rgba(0,210,255,0.35)",
      },
    },
  },

  plugins: [],
};

export default config;