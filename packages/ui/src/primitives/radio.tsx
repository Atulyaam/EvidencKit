import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface RadioGroupContextValue {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name: customName,
  value,
  onChange,
  children,
  className,
  disabled = false,
  "aria-label": ariaLabel
}) => {
  const autoName = React.useId();
  const name = customName || `rg-${autoName}`;

  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={twMerge(clsx("space-y-2", className))}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
};
RadioGroup.displayName = "RadioGroup";

export interface RadioProps {
  value: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Radio: React.FC<RadioProps> = ({
  value,
  label,
  description,
  disabled: itemDisabled,
  className,
  id: customId
}) => {
  const context = React.useContext(RadioGroupContext);
  if (!context) {
    throw new Error("Radio must be used within a RadioGroup");
  }

  const autoId = React.useId();
  const radioId = customId || `radio-${autoId}`;
  const isChecked = context.value === value;
  const isDisabled = context.disabled || itemDisabled;

  return (
    <div
      className={twMerge(
        clsx("flex items-start gap-2.5", isDisabled && "opacity-50 cursor-not-allowed", className)
      )}
    >
      <div className="relative flex items-center justify-center pt-0.5">
        <input
          id={radioId}
          type="radio"
          name={context.name}
          value={value}
          checked={isChecked}
          disabled={isDisabled}
          onChange={() => context.onChange(value)}
          className="peer sr-only"
        />
        <label
          htmlFor={radioId}
          className={twMerge(
            clsx(
              "h-4 w-4 rounded-full border flex items-center justify-center transition-colors cursor-pointer",
              "border-zinc-700 bg-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950",
              isChecked ? "border-blue-600 bg-zinc-900" : "hover:border-zinc-600",
              isDisabled && "cursor-not-allowed"
            )
          )}
        >
          {isChecked && <span className="h-2 w-2 rounded-full bg-blue-600" />}
        </label>
      </div>

      {(label || description) && (
        <div className="space-y-0.5">
          {label && (
            <label
              htmlFor={radioId}
              className={twMerge(
                clsx(
                  "text-xs font-medium text-zinc-200 cursor-pointer select-none block",
                  isDisabled && "cursor-not-allowed"
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
Radio.displayName = "Radio";
