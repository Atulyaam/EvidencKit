import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(...inputs));
}

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  dense?: boolean;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, dense = false, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-xs text-left text-zinc-200 border-collapse",
          dense ? "[&_td]:py-2 [&_th]:py-2" : "[&_td]:py-3 [&_th]:py-3",
          className
        )}
        {...props}
      />
    </div>
  )
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-medium", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-zinc-800/50 [&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t border-zinc-800 bg-zinc-900/50 font-medium text-zinc-300", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isClickable?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, isClickable = false, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-zinc-800/40 transition-colors",
        "hover:bg-zinc-800/30",
        isClickable && "cursor-pointer active:bg-zinc-800/60",
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-9 px-4 text-left align-middle font-medium text-zinc-400 uppercase tracking-wider text-[11px]",
      "[&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 align-middle text-zinc-200 [&:has([role=checkbox])]:pr-0 font-normal",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-3 px-4 pb-3 text-xs text-zinc-500 text-left italic", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";
