import { Badge } from "../primitives/badge";

export interface IntegrityStatusProps {
  status: "verified" | "failed" | "unanchored" | "incomplete";
  totalEvents: number;
  headHash?: string;
}

export function IntegrityStatus({ status, totalEvents, headHash }: IntegrityStatusProps) {
  const getBadgeVariant = () => {
    switch (status) {
      case "verified":
        return "success";
      case "failed":
        return "danger";
      case "incomplete":
        return "warning";
      case "unanchored":
      default:
        return "default";
    }
  };

  return (
    <div className="flex items-center space-x-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <Badge variant={getBadgeVariant()}>{status}</Badge>
      <div className="text-xs text-zinc-400">
        <span className="font-medium text-zinc-200">{totalEvents}</span> events captured
        {headHash && (
          <span className="ml-2 font-mono text-[10px] text-zinc-500">
            Head: {headHash.slice(0, 8)}...{headHash.slice(-8)}
          </span>
        )}
      </div>
    </div>
  );
}
