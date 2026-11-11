import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outline" | "interactive";
}

export function Card({ className, variant = "default", ...props }: CardProps) {
  const variantStyles = {
    default: "border-zinc-800 bg-zinc-950/60 text-zinc-100 shadow-sm backdrop-blur-sm",
    elevated: "border-zinc-700/80 bg-zinc-900/80 text-zinc-100 shadow-md",
    outline: "border-zinc-800 bg-transparent text-zinc-100 shadow-none",
    interactive:
      "border-zinc-800 bg-zinc-950/60 text-zinc-100 shadow-sm hover:border-zinc-700 hover:bg-zinc-900/60 cursor-pointer transition-colors"
  };

  return (
    <div
      className={twMerge(clsx("rounded-lg border", variantStyles[variant], className))}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx("flex flex-col space-y-1.5 p-5", className))} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        clsx("text-lg font-semibold leading-none tracking-tight text-zinc-100", className)
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={twMerge(clsx("text-sm text-zinc-400", className))} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx("p-5 pt-0", className))} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          "flex items-center justify-between p-5 pt-0 border-t border-zinc-800/60 mt-4",
          className
        )
      )}
      {...props}
    />
  );
}

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "danger" | "info";
}

export function Panel({ className, variant = "default", ...props }: PanelProps) {
  const variantStyles = {
    default: "border-zinc-800 bg-zinc-900/40 text-zinc-200",
    subtle: "border-zinc-800/60 bg-zinc-950/40 text-zinc-300",
    danger: "border-rose-900/60 bg-rose-950/20 text-rose-300",
    info: "border-blue-900/60 bg-blue-950/20 text-blue-300"
  };

  return (
    <div
      className={twMerge(clsx("rounded-lg border p-4 text-xs", variantStyles[variant], className))}
      {...props}
    />
  );
}
