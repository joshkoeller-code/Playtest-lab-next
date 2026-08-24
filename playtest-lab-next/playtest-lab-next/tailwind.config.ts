import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12161d",
        surface: "#1b212a",
        surfaceRaised: "#232a35",
        rule: "#323b48",
        parchment: "#EDE6D6",
        muted: "#8B93A1",
        amber: "#E3A33B",
        teal: "#4FA8A0",
        brick: "#D96C5F",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        graph:
          "linear-gradient(rgba(139,147,161,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139,147,161,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        graph: "24px 24px",
      },
    },
  },
  plugins: [],
};

export default config;
