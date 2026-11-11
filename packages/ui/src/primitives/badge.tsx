import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline" | "info" | "purple";
  size?: "sm" | "md";
}

export function Badge({ className, variant = "default", size = "md", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full font-semibold uppercase tracking-wider select-none";

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-0.5 text-xs"
  };

  const variants = {
    default: "bg-zinc-800 text-zinc-300 border border-zinc-700",
    success: "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60",
    warning: "bg-amber-950/80 text-amber-400 border border-amber-800/60",
    danger: "bg-rose-950/80 text-rose-400 border border-rose-800/60",
    outline: "border border-zinc-700 text-zinc-300",
    info: "bg-blue-950/80 text-blue-400 border border-blue-800/60",
    purple: "bg-purple-950/80 text-purple-400 border border-purple-800/60"
  };

  return (
    <span
      className={twMerge(clsx(base, sizeStyles[size], variants[variant], className))}
      {...props}
    />
  );
}

export interface StatusDotProps {
  status: "success" | "warning" | "danger" | "info" | "neutral";
  pulse?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function StatusDot({ status, pulse = false, size = "md", className }: StatusDotProps) {
  const statusColors = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-blue-500",
    neutral: "bg-zinc-500"
  };

  const sizeStyles = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2"
  };

  return (
    <span className="relative flex shrink-0 items-center justify-center">
      {pulse && (
        <span
          className={twMerge(
            clsx(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              statusColors[status]
            )
          )}
        />
      )}
      <span
        className={twMerge(
          clsx(
            "relative inline-flex rounded-full",
            sizeStyles[size],
            statusColors[status],
            className
          )
        )}
      />
    </span>
  );
}

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "verified" | "tampered" | "pending" | "failed" | "active" | "denied";
  label?: string;
  showDot?: boolean;
}

export function StatusIndicator({
  status,
  label,
  showDot = true,
  className,
  ...props
}: StatusIndicatorProps) {
  const mapping: Record<
    StatusIndicatorProps["status"],
    {
      variant: BadgeProps["variant"];
      dot: StatusDotProps["status"];
      pulse: boolean;
      defaultLabel: string;
    }
  > = {
    verified: { variant: "success", dot: "success", pulse: false, defaultLabel: "VERIFIED" },
    active: { variant: "success", dot: "success", pulse: true, defaultLabel: "ACTIVE" },
    pending: { variant: "warning", dot: "warning", pulse: true, defaultLabel: "PENDING" },
    tampered: { variant: "danger", dot: "danger", pulse: false, defaultLabel: "TAMPERED" },
    failed: { variant: "danger", dot: "danger", pulse: false, defaultLabel: "FAILED" },
    denied: { variant: "danger", dot: "danger", pulse: false, defaultLabel: "DENIED" }
  };

  const config = mapping[status];
  const displayText = label || config.defaultLabel;

  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono",
          config.variant === "success" &&
            "bg-emerald-950/60 border border-emerald-800/50 text-emerald-400",
          config.variant === "warning" &&
            "bg-amber-950/60 border border-amber-800/50 text-amber-400",
          config.variant === "danger" && "bg-rose-950/60 border border-rose-800/50 text-rose-400",
          className
        )
      )}
      {...props}
    >
      {showDot && <StatusDot status={config.dot} pulse={config.pulse} size="sm" />}
      <span>{displayText}</span>
    </span>
  );
}
