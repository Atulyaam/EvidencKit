import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(...inputs));
}

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant?: "line" | "pills";
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "line" | "pills";
  children?: React.ReactNode;
  className?: string;
}

export function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  variant = "line",
  children,
  className
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange, variant }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { variant } = useTabs();

    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(
          "flex items-center gap-1",
          variant === "line" && "border-b border-zinc-800 pb-px",
          variant === "pills" && "bg-zinc-900/80 p-1 rounded-lg border border-zinc-800",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, badge, icon, className, children, disabled, ...props }, ref) => {
    const { value: activeValue, onValueChange, variant } = useTabs();
    const isSelected = activeValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`tab-${value}`}
        aria-selected={isSelected}
        aria-controls={`panel-${value}`}
        tabIndex={isSelected ? 0 : -1}
        disabled={disabled}
        onClick={() => onValueChange(value)}
        className={cn(
          "inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium transition-all select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500",
          disabled && "opacity-40 cursor-not-allowed pointer-events-none",
          variant === "line" && [
            "-mb-px border-b-2",
            isSelected
              ? "border-sky-500 text-sky-400 font-semibold"
              : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          ],
          variant === "pills" && [
            "rounded-md",
            isSelected
              ? "bg-zinc-800 text-zinc-100 font-semibold shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          ],
          className
        )}
        {...props}
      >
        {icon && (
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">{icon}</span>
        )}
        <span>{children}</span>
        {badge && (
          <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {badge}
          </span>
        )}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, ...props }, ref) => {
    const { value: activeValue } = useTabs();
    const isSelected = activeValue === value;

    if (!isSelected) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`panel-${value}`}
        aria-labelledby={`tab-${value}`}
        tabIndex={0}
        className={cn("mt-4 focus:outline-none animate-in fade-in duration-150", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";
