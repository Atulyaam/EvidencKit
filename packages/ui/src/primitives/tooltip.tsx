import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(...inputs));
}

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactElement<any>;
  placement?: TooltipPlacement;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  placement = "top",
  delay = 150,
  className,
  disabled = false
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = React.useId();

  const showTooltip = React.useCallback(() => {
    if (disabled || !content) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled, content]);

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!children || !React.isValidElement(children)) {
    return null;
  }

  const placementClasses: Record<TooltipPlacement, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };

  const arrowClasses: Record<TooltipPlacement, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-zinc-800 border-x-transparent border-b-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-zinc-800 border-y-transparent border-r-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-zinc-800 border-y-transparent border-l-transparent"
  };

  // Clone child to attach accessible props and listeners
  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  const trigger = React.cloneElement(child, {
    "aria-describedby": isVisible ? id : undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      showTooltip();
      child.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      hideTooltip();
      child.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      showTooltip();
      child.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      hideTooltip();
      child.props.onBlur?.(e);
    }
  });

  return (
    <div className="relative inline-flex items-center">
      {trigger}
      {isVisible && !disabled && (
        <div
          id={id}
          role="tooltip"
          className={cn(
            "absolute z-50 px-2.5 py-1 text-xs font-medium text-zinc-100 bg-zinc-900 border border-zinc-700/80 rounded shadow-md whitespace-nowrap pointer-events-none transition-opacity duration-150 animate-in fade-in",
            placementClasses[placement],
            className
          )}
        >
          {content}
          <div
            aria-hidden="true"
            className={cn("absolute w-0 h-0 border-4", arrowClasses[placement])}
          />
        </div>
      )}
    </div>
  );
}
