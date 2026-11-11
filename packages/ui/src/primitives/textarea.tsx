import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id: customId, disabled, rows = 4, ...props }, ref) => {
    const autoId = React.useId();
    const textareaId = customId || (label ? `textarea-${autoId}` : undefined);
    const errorId = error ? `err-${autoId}` : undefined;
    const helperId = helperText ? `help-${autoId}` : undefined;

    const textareaElement = (
      <textarea
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={twMerge(
          clsx(
            "w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            error
              ? "border-rose-700/80 focus-visible:ring-rose-500 text-rose-100"
              : "border-zinc-800 hover:border-zinc-700",
            className
          )
        )}
        ref={ref}
        {...props}
      />
    );

    if (!label && !error && !helperText) {
      return textareaElement;
    }

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-zinc-300">
            {label}
          </label>
        )}
        {textareaElement}
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
Textarea.displayName = "Textarea";
