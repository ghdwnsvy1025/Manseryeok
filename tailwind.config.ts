import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        wood:  { DEFAULT: "#22c55e", light: "#dcfce7", dark: "#16a34a" },
        fire:  { DEFAULT: "#ef4444", light: "#fee2e2", dark: "#dc2626" },
        earth: { DEFAULT: "#f59e0b", light: "#fef3c7", dark: "#d97706" },
        metal: { DEFAULT: "#94a3b8", light: "#f1f5f9", dark: "#64748b" },
        water: { DEFAULT: "#3b82f6", light: "#dbeafe", dark: "#2563eb" },
      },
      fontFamily: {
        sans: ["Noto Sans KR", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
