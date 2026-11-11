import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  FileQuestion,
  RefreshCw
} from "lucide-react";

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(...inputs));
}

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-8 h-8"
  };

  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("animate-spin text-sky-500", sizeClasses[size], className)}
      {...props}
    />
  );
}

export interface LoadingStateProps {
  message?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingState({
  message = "Loading...",
  description,
  size = "md",
  className
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center space-y-3",
        className
      )}
    >
      <Spinner size={size} />
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-300">{message}</p>
        {description && <p className="text-xs text-zinc-500 max-w-sm">{description}</p>}
      </div>
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30",
        className
      )}
    >
      <div className="mb-3 rounded-full bg-zinc-800/80 p-3 text-zinc-400">
        {icon || <FileQuestion className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-zinc-400 max-w-sm text-balance">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  icon?: React.ReactNode;
  title?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  icon,
  title = "An error occurred",
  error,
  onRetry,
  retryLabel = "Retry",
  className
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-rose-900/50 bg-rose-950/20 text-rose-300",
        className
      )}
    >
      <div className="mb-3 rounded-full bg-rose-900/40 p-3 text-rose-400">
        {icon || <AlertCircle className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-semibold text-rose-200">{title}</h3>
      {errorMessage && (
        <p className="mt-1 text-xs text-rose-300/80 max-w-md font-mono bg-rose-950/40 p-2 rounded border border-rose-900/30">
          {errorMessage}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 border border-rose-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Alert({ variant = "info", title, icon, children, onClose, className }: AlertProps) {
  const variantStyles = {
    info: {
      container: "bg-sky-950/30 border-sky-800/60 text-sky-200",
      iconColor: "text-sky-400",
      defaultIcon: <Info className="w-4 h-4" />
    },
    success: {
      container: "bg-emerald-950/30 border-emerald-800/60 text-emerald-200",
      iconColor: "text-emerald-400",
      defaultIcon: <CheckCircle2 className="w-4 h-4" />
    },
    warning: {
      container: "bg-amber-950/30 border-amber-800/60 text-amber-200",
      iconColor: "text-amber-400",
      defaultIcon: <AlertTriangle className="w-4 h-4" />
    },
    danger: {
      container: "bg-rose-950/30 border-rose-800/60 text-rose-200",
      iconColor: "text-rose-400",
      defaultIcon: <AlertCircle className="w-4 h-4" />
    }
  };

  const style = variantStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 p-3.5 rounded-lg border text-xs leading-relaxed",
        style.container,
        className
      )}
    >
      <div className={cn("shrink-0 mt-0.5", style.iconColor)}>{icon || style.defaultIcon}</div>
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold text-xs mb-0.5">{title}</h5>}
        <div className="text-zinc-300 text-xs">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="shrink-0 p-1 -mr-1 -mt-1 text-zinc-400 hover:text-zinc-100 rounded focus:outline-none"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
