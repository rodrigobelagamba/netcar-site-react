import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Variantes de estilo/comportamento
const buttonVariants = cva(
  "inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        outline: "border bg-transparent",
        ghost: "bg-transparent",
        link: "bg-transparent underline-offset-4",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-full px-3",
        lg: "h-11 rounded-full px-8",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9",
        "icon-lg": "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Mapeamento completo de cores para cada variante
const colorVariants = {
  default: {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary",
    tertiary:
      "bg-tertiary text-tertiary-foreground hover:bg-tertiary/90 focus-visible:ring-tertiary",
    green:
      "bg-green text-tertiary-foreground hover:bg-green/90 focus-visible:ring-green",
    "green-light":
      "bg-green-light text-black hover:bg-green-light/90 focus-visible:ring-green-light",
    purple: "bg-purple text-white hover:bg-purple/90 focus-visible:ring-purple",
    blue: "bg-blue text-white hover:bg-blue/90 focus-visible:ring-blue",
    "blue-dark":
      "bg-blue-dark text-white hover:bg-blue-dark/80 focus-visible:ring-blue-dark",
    gray: "bg-gray text-white hover:bg-gray/90 focus-visible:ring-gray",
    red: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
    yellow:
      "bg-yellow-500 text-black hover:bg-yellow-600 focus-visible:ring-yellow-500",
    orange:
      "bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-500",
  },
  outline: {
    primary:
      "border-primary text-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-primary",
    secondary:
      "border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-secondary",
    tertiary:
      "border-tertiary text-tertiary hover:bg-tertiary hover:text-tertiary-foreground focus-visible:ring-tertiary",
    green:
      "border-green text-green hover:bg-green hover:text-tertiary-foreground focus-visible:ring-green",
    "green-light":
      "border-green-light text-green-light hover:bg-green-light hover:text-black focus-visible:ring-green-light",
    purple:
      "border-purple text-purple hover:bg-purple hover:text-white focus-visible:ring-purple",
    blue: "border-blue text-blue hover:bg-blue hover:text-white focus-visible:ring-blue",
    "blue-dark":
      "border-blue-dark text-blue-dark hover:bg-blue-dark hover:text-white focus-visible:ring-blue-dark",
    gray: "border-gray text-gray hover:bg-gray hover:text-white focus-visible:ring-gray",
    red: "border-red-600 text-red-600 hover:bg-red-600 hover:text-white focus-visible:ring-red-600",
    yellow:
      "border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black focus-visible:ring-yellow-500",
    orange:
      "border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white focus-visible:ring-orange-500",
  },
  ghost: {
    primary: "text-primary hover:bg-primary/10 focus-visible:ring-primary",
    secondary:
      "text-secondary hover:bg-secondary/10 focus-visible:ring-secondary",
    tertiary: "text-tertiary hover:bg-tertiary/10 focus-visible:ring-tertiary",
    green: "text-green hover:bg-green/10 focus-visible:ring-green",
    "green-light":
      "text-green-light hover:bg-green-light/10 focus-visible:ring-green-light",
    purple: "text-purple hover:bg-purple/10 focus-visible:ring-purple",
    blue: "text-blue hover:bg-blue/10 focus-visible:ring-blue",
    "blue-dark":
      "text-blue-dark hover:bg-blue-dark/10 focus-visible:ring-blue-dark",
    gray: "text-gray hover:bg-gray/10 focus-visible:ring-gray",
    red: "text-red-600 hover:bg-red-600/10 focus-visible:ring-red-600",
    yellow:
      "text-yellow-500 hover:bg-yellow-500/10 focus-visible:ring-yellow-500",
    orange:
      "text-orange-500 hover:bg-orange-500/10 focus-visible:ring-orange-500",
  },
  link: {
    primary: "text-primary hover:underline focus-visible:ring-primary",
    secondary: "text-secondary hover:underline focus-visible:ring-secondary",
    tertiary: "text-tertiary hover:underline focus-visible:ring-tertiary",
    green: "text-green hover:underline focus-visible:ring-green",
    "green-light":
      "text-green-light hover:underline focus-visible:ring-green-light",
    purple: "text-purple hover:underline focus-visible:ring-purple",
    blue: "text-blue hover:underline focus-visible:ring-blue",
    "blue-dark": "text-blue-dark hover:underline focus-visible:ring-blue-dark",
    gray: "text-gray hover:underline focus-visible:ring-gray",
    red: "text-red-600 hover:underline focus-visible:ring-red-600",
    yellow: "text-yellow-500 hover:underline focus-visible:ring-yellow-500",
    orange: "text-orange-500 hover:underline focus-visible:ring-orange-500",
  },
} as const;

type ColorKey = keyof typeof colorVariants.default;

function getColorClasses(
  variant: "default" | "outline" | "ghost" | "link",
  color?: ColorKey
): string {
  const selectedColor = (color || "primary") as ColorKey;
  return (
    colorVariants[variant]?.[selectedColor] || colorVariants.default.primary
  );
}

export interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "variant" | "color">,
    Omit<VariantProps<typeof buttonVariants>, "variant"> {
  variant?: "default" | "outline" | "ghost" | "link";
  color?: ColorKey;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size, color, asChild = false, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const colorClasses = getColorClasses(variant, color);
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          colorClasses,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
