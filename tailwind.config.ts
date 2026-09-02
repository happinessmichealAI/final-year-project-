import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#14161A",
        panel: "#1B1E23",
        panelBorder: "#2A2E35",
        ink: "#EDEEF0",
        inkDim: "#9AA0AA",
        amber: "#E8962B",
        cyan: "#4FC3D9",
        fault: "#D9524A",
        ok: "#5FBF7A",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "2px",
        none: "0px",
      },
    },
  },
  plugins: [],
};
export default config;
