import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Check, Minus } from "lucide-react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, label, description, checked, indeterminate, disabled, id: customId, ...props },
    ref
  ) => {
    const autoId = React.useId();
    const checkboxId = customId || `chk-${autoId}`;
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => internalRef.current!);

    React.useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    return (
      <div
        className={twMerge(
          clsx("flex items-start gap-2.5", disabled && "opacity-50 cursor-not-allowed")
        )}
      >
        <div className="relative flex items-center justify-center pt-0.5">
          <input
            id={checkboxId}
            ref={internalRef}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <label
            htmlFor={checkboxId}
            className={twMerge(
              clsx(
                "h-4 w-4 rounded border flex items-center justify-center transition-colors cursor-pointer",
                "border-zinc-700 bg-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950",
                checked || indeterminate
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "hover:border-zinc-600",
                disabled && "cursor-not-allowed",
                className
              )
            )}
          >
            {indeterminate ? (
              <Minus className="h-3 w-3 stroke-[3]" aria-hidden="true" />
            ) : checked ? (
              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
            ) : null}
          </label>
        </div>
        {(label || description) && (
          <div className="space-y-0.5">
            {label && (
              <label
                htmlFor={checkboxId}
                className={twMerge(
                  clsx(
                    "text-xs font-medium text-zinc-200 cursor-pointer select-none",
                    disabled && "cursor-not-allowed"
                  )
                )}
              >
                {label}
              </label>
            )}
            {description && <p className="text-[11px] text-zinc-400">{description}</p>}
          </div>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";
