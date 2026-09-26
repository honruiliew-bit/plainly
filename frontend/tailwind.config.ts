import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F0E6",
        card: "#FBF8F1",
        ink: "#16130E",
        mute: "#6B6558",
        line: "#DDD5C4",
        marker: "#F6D94E",
        vermilion: "#E5432A",
        good: "#2F7D4F",
        bad: "#C2362B",
        mixed: "#B7791F",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
