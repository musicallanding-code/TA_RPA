import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Calendly-ish palette to mirror the existing booking page look
        brand: {
          DEFAULT: "#0069ff",
          dark: "#0050c9",
        },
      },
    },
  },
  plugins: [],
};

export default config;
