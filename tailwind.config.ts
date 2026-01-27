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
      screens: {
        '3xl': '1920px',
        '4xl': '2560px',
        '5xl': '3840px',
        '6xl': '5120px',
      },
    },
  },
  plugins: [],
};

export default config;
