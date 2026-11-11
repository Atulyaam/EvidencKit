import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
  id: customId
}) => {
  const autoId = React.useId();
  const switchId = customId || `switch-${autoId}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onCheckedChange?.(!checked);
    }
  };

  return (
    <div
      className={twMerge(
        clsx("flex items-start gap-3", disabled && "opacity-50 cursor-not-allowed", className)
      )}
    >
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        onKeyDown={handleKeyDown}
        className={twMerge(
          clsx(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
            checked ? "bg-blue-600" : "bg-zinc-800",
            disabled && "cursor-not-allowed"
          )
        )}
      >
        <span
          className={twMerge(
            clsx(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
              checked ? "translate-x-4" : "translate-x-0"
            )
          )}
          aria-hidden="true"
        />
      </button>

      {(label || description) && (
        <div className="space-y-0.5">
          {label && (
            <label
              htmlFor={switchId}
              onClick={() => !disabled && onCheckedChange?.(!checked)}
              className={twMerge(
                clsx(
                  "text-xs font-medium text-zinc-200 cursor-pointer select-none block",
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
};
Switch.displayName = "Switch";
