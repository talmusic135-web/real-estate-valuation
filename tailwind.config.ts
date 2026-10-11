import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-heebo)", "system-ui", "sans-serif"] },
      colors: {
        brand: { 50: "#eef6ff", 100: "#d9eaff", 500: "#2563eb", 600: "#1d4ed8", 700: "#1e40af", 900: "#172554" },
      },
    },
  },
  plugins: [],
} satisfies Config;
