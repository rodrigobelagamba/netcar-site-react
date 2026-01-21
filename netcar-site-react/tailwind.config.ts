import type { Config } from "tailwindcss";
import colors from "./src/design-system/tokens/colors.json";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ...colors,
      },
    },
  },
  plugins: [],
};

export default config;
