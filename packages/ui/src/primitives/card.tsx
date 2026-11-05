import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          "rounded-lg border border-zinc-800 bg-zinc-950/60 text-zinc-100 shadow-sm backdrop-blur-sm",
          className
        )
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx("flex flex-col space-y-1.5 p-5", className))} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        clsx("text-lg font-semibold leading-none tracking-tight text-zinc-100", className)
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={twMerge(clsx("text-sm text-zinc-400", className))} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx("p-5 pt-0", className))} {...props} />;
}
