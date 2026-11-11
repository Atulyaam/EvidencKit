import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, helperText, options, children, id: customId, disabled, ...props },
    ref
  ) => {
    const autoId = React.useId();
    const selectId = customId || (label ? `select-${autoId}` : undefined);
    const errorId = error ? `err-${autoId}` : undefined;
    const helperId = helperText ? `help-${autoId}` : undefined;

    const selectElement = (
      <div className="relative w-full">
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={twMerge(
            clsx(
              "flex h-9 w-full appearance-none rounded-md border bg-zinc-900 px-3 py-1 pr-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              error
                ? "border-rose-700/80 focus-visible:ring-rose-500 text-rose-100"
                : "border-zinc-800 hover:border-zinc-700",
              className
            )
          )}
          ref={ref}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    );

    if (!label && !error && !helperText) {
      return selectElement;
    }

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-zinc-300">
            {label}
          </label>
        )}
        {selectElement}
        {error && (
          <p id={errorId} className="text-[11px] text-rose-400 font-medium">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-[11px] text-zinc-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
