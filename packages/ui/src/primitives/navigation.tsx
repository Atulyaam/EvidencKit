import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronRight } from "lucide-react";

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(...inputs));
}

export interface BreadcrumbsProps extends React.ComponentPropsWithoutRef<"nav"> {
  separator?: React.ReactNode;
  children: React.ReactNode;
}

export function Breadcrumbs({
  separator = <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" aria-hidden="true" />,
  children,
  className,
  ...props
}: BreadcrumbsProps) {
  const items = React.Children.toArray(children);

  return (
    <nav aria-label="Breadcrumb" className={cn("flex", className)} {...props}>
      <ol className="flex items-center space-x-1.5 text-xs text-zinc-400">
        {items.map((child, index) => (
          <React.Fragment key={index}>
            {index > 0 && <li className="flex items-center">{separator}</li>}
            {child}
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}

export interface BreadcrumbItemProps extends React.ComponentPropsWithoutRef<"li"> {
  href?: string;
  isCurrentPage?: boolean;
}

export const BreadcrumbItem = React.forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ href, isCurrentPage = false, className, children, ...props }, ref) => {
    return (
      <li ref={ref} className={cn("inline-flex items-center", className)} {...props}>
        {isCurrentPage ? (
          <span
            aria-current="page"
            className="font-semibold text-zinc-100 select-none truncate max-w-xs"
          >
            {children}
          </span>
        ) : href ? (
          <a
            href={href}
            className="text-zinc-400 hover:text-zinc-200 transition-colors truncate max-w-xs focus:outline-none focus:underline"
          >
            {children}
          </a>
        ) : (
          <span className="text-zinc-400 select-none truncate max-w-xs">{children}</span>
        )}
      </li>
    );
  }
);
BreadcrumbItem.displayName = "BreadcrumbItem";

export interface NavPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "blue" | "purple" | "neutral";
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const NavPill = React.forwardRef<HTMLButtonElement, NavPillProps>(
  (
    { active = false, variant = "neutral", icon, badge, className, children, disabled, ...props },
    ref
  ) => {
    const activeVariantStyles = {
      blue: "bg-sky-500/15 text-sky-400 border-sky-500/40 font-semibold",
      purple: "bg-purple-500/15 text-purple-400 border-purple-500/40 font-semibold",
      neutral: "bg-zinc-800 text-zinc-100 border-zinc-700 font-semibold"
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 select-none",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500",
          disabled && "opacity-40 cursor-not-allowed pointer-events-none",
          active
            ? activeVariantStyles[variant]
            : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60",
          className
        )}
        {...props}
      >
        {icon && (
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">{icon}</span>
        )}
        <span>{children}</span>
        {badge && (
          <span
            className={cn(
              "ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-mono",
              active ? "bg-zinc-800/80 text-zinc-200" : "bg-zinc-800 text-zinc-400"
            )}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }
);
NavPill.displayName = "NavPill";
