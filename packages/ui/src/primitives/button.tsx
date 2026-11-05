import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

    const variantStyles = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
      secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:ring-zinc-600",
      destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
      outline:
        "border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800 focus-visible:ring-zinc-600",
      ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800 focus-visible:ring-zinc-600"
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4 text-sm",
      lg: "h-11 px-6 text-base"
    };

    return (
      <button
        ref={ref}
        className={twMerge(clsx(baseStyles, variantStyles[variant], sizeStyles[size], className))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
