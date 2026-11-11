import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id: customId,
      disabled,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = customId || (label ? `input-${autoId}` : undefined);
    const errorId = error ? `err-${autoId}` : undefined;
    const helperId = helperText ? `help-${autoId}` : undefined;

    const inputElement = (
      <div className="relative w-full">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={twMerge(
            clsx(
              "flex h-9 w-full rounded-md border bg-zinc-900 px-3 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              error
                ? "border-rose-700/80 focus-visible:ring-rose-500 text-rose-100"
                : "border-zinc-800 hover:border-zinc-700",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              className
            )
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400">
            {rightIcon}
          </div>
        )}
      </div>
    );

    if (!label && !error && !helperText) {
      return inputElement;
    }

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-zinc-300">
            {label}
          </label>
        )}
        {inputElement}
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
Input.displayName = "Input";
