import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#060606",
        ink2: "#0e0d0c",
        panel: "#131211",
        gold: "#9c8a5f",
        gold2: "#cbbd93",
        parch: "#cbc5b7",
        dim: "#7c766a",
        faint: "#5a554c",
        wine: "#7a3038",
        line: "rgba(160,150,120,0.2)",
        line2: "rgba(180,168,120,0.42)",
      },
      fontFamily: {
        cinzel: ["Cinzel", "serif"],
        garamond: ["'EB Garamond'", "serif"],
        cormorant: ["'Cormorant Garamond'", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
