import colorsJson from "./colors.json";

export const colors = colorsJson as {
  primary: string;
  "primary-foreground": string;
  secondary: string;
  "secondary-foreground": string;
  tertiary: string;
  "tertiary-foreground": string;
  gray: string;
  blue: string;
  "blue-dark": string;
  "grey-light": string;
  "green-dark": string;
  green: string;
  "green-light": string;
  purple: string;
  bg: string;
  fg: string;
  surface: string;
  "surface-alt": string;
  muted: string;
  "muted-foreground": string;
  border: string;
};

export type Colors = typeof colors;
export default colors;
