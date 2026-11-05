import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider";
  const variants = {
    default: "bg-zinc-800 text-zinc-300 border border-zinc-700",
    success: "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60",
    warning: "bg-amber-950/80 text-amber-400 border border-amber-800/60",
    danger: "bg-rose-950/80 text-rose-400 border border-rose-800/60",
    outline: "border border-zinc-700 text-zinc-300"
  };

  return <span className={twMerge(clsx(base, variants[variant], className))} {...props} />;
}
