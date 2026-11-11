import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(...inputs));
}

interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
}

const DropdownContext = React.createContext<DropdownContextValue | undefined>(undefined);

export function useDropdown() {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error("Dropdown components must be used within a DropdownMenu");
  }
  return context;
}

export interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
}

export function DropdownMenu({ children, className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, close }}>
      <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ children, asChild, className }, ref) => {
    const { isOpen, setIsOpen } = useDropdown();

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
        onClick: (e: React.MouseEvent) => {
          children.props.onClick?.(e);
          setIsOpen((prev) => !prev);
        }
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn("inline-flex items-center justify-center select-none", className)}
      >
        {children}
      </button>
    );
  }
);
DropdownTrigger.displayName = "DropdownTrigger";

export interface DropdownContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "left" | "right";
  width?: "auto" | "sm" | "md" | "lg";
}

export const DropdownContent = React.forwardRef<HTMLDivElement, DropdownContentProps>(
  ({ align = "left", width = "md", className, children, ...props }, ref) => {
    const { isOpen } = useDropdown();

    if (!isOpen) return null;

    const widthClasses = {
      auto: "w-auto min-w-[8rem]",
      sm: "w-40",
      md: "w-56",
      lg: "w-72"
    };

    return (
      <div
        ref={ref}
        role="menu"
        aria-orientation="vertical"
        tabIndex={-1}
        className={cn(
          "absolute z-50 mt-1.5 origin-top-right rounded-lg bg-zinc-900 border border-zinc-800 p-1 text-zinc-200 shadow-xl shadow-black/40 focus:outline-none animate-in fade-in zoom-in-95 duration-100",
          align === "right" ? "right-0" : "left-0",
          widthClasses[width],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownContent.displayName = "DropdownContent";

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  shortcut?: string;
  variant?: "default" | "destructive";
  onSelect?: () => void;
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  (
    {
      className,
      icon,
      shortcut,
      variant = "default",
      onSelect,
      onClick,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const { close } = useDropdown();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onSelect?.();
      onClick?.(e);
      close();
    };

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left",
          "focus:outline-none select-none",
          disabled && "opacity-40 cursor-not-allowed pointer-events-none",
          variant === "default" &&
            "text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50",
          variant === "destructive" &&
            "text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 focus:bg-rose-950/40 focus:text-rose-300",
          className
        )}
        {...props}
      >
        {icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>}
        <span className="flex-1 truncate">{children}</span>
        {shortcut && (
          <span className="ml-auto text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
            {shortcut}
          </span>
        )}
      </button>
    );
  }
);
DropdownItem.displayName = "DropdownItem";

export function DropdownSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("-mx-1 my-1 h-px bg-zinc-800", className)} />;
}

export function DropdownHeader({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500",
        className
      )}
    >
      {children}
    </div>
  );
}
