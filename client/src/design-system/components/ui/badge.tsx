import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Variantes de estilo/comportamento
const badgeVariants = cva(
  "inline-flex items-center gap-2 rounded-full px-3 py-0.5 min-h-7 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "",
        outline: "border bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const colorVariants = {
  default: {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-primary-foreground",
    tertiary: "bg-tertiary text-primary-foreground",
    green: "bg-green text-primary-foreground",
    "green-light": "bg-green-light text-black",
    purple: "bg-purple text-white",
    blue: "bg-blue text-white",
    "blue-dark": "bg-blue-dark text-white",
    gray: "bg-gray text-white",
    red: "bg-red-600 text-white",
    yellow: "bg-yellow-500 text-black",
    orange: "bg-orange-500 text-white",
  },
  outline: {
    primary: "border-primary text-primary",
    secondary: "border-secondary text-secondary",
    tertiary: "border-tertiary text-tertiary",
    green: "border-green text-green",
    "green-light": "border-green-light text-green-light",
    purple: "border-purple text-purple",
    blue: "border-blue text-blue",
    "blue-dark": "border-blue-dark text-blue-dark",
    gray: "border-gray text-gray",
    red: "border-red-600 text-red-600",
    yellow: "border-yellow-500 text-yellow-500",
    orange: "border-orange-500 text-orange-500",
  },
} as const;

type ColorKey = keyof typeof colorVariants.default;

function getColorClasses(
  variant: "default" | "outline",
  color?: ColorKey
): string {
  const selectedColor = (color || "primary") as ColorKey;
  return (
    colorVariants[variant]?.[selectedColor] || colorVariants.default.primary
  );
}

export interface BadgeProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "variant" | "color">,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  variant?: "default" | "outline";
  color?: ColorKey;
}

function Badge({
  className,
  variant = "default",
  color,
  ...props
}: BadgeProps) {
  const colorClasses = getColorClasses(variant, color);
  return (
    <div
      className={cn(badgeVariants({ variant }), colorClasses, className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
