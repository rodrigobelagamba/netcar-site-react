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
        // Laptops curtos tipo 1600×900 — cards desktop mais baixos só nesse caso
        short1600: {
          raw: "(min-width: 1280px) and (max-height: 920px)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
