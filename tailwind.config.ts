
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

        muted: "#9CA3AF",
      },

      fontFamily: {
        sans: ["var(--font-inter)"],
      },

      boxShadow: {
        glow:
          "0 0 30px rgba(0,210,255,0.35)",

        card:
          "0 10px 40px rgba(0,0,0,0.35)",
      },

      backgroundImage: {
        cinematic:
          "radial-gradient(circle at top left, rgba(0,210,255,0.15), transparent 30%), radial-gradient(circle at bottom right, rgba(0,124,240,0.12), transparent 30%)",
      },

      borderRadius: {
        xl2: "1.25rem",

        xl3: "1.75rem",
      },

      animation: {
        float:
          "float 4s ease-in-out infinite",

        glow:
          "glow 2s ease-in-out infinite",

        fadeIn:
          "fadeIn 0.4s ease forwards",
      },

      keyframes: {
        float: {
          "0%,100%": {
            transform: "translateY(0px)",
          },

          "50%": {
            transform:
              "translateY(-8px)",
          },
        },

        glow: {
          "0%,100%": {
            boxShadow:
              "0 0 20px rgba(0,210,255,0.2)",
          },

          "50%": {
            boxShadow:
              "0 0 40px rgba(0,210,255,0.45)",
          },
        },

        fadeIn: {
          from: {
            opacity: "0",
            transform:
              "translateY(10px)",
          },

          to: {
            opacity: "1",
            transform:
              "translateY(0px)",
          },
        },
      },
    },
  },

  plugins: [],
};

export default config;

