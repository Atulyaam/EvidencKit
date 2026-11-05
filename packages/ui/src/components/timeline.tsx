import { ChainedEvent } from "@evidencekit/core";
import { Badge } from "../primitives/badge";

export interface TimelineProps {
  events: ChainedEvent[];
  selectedEventId?: string;
  onSelectEvent?: (event: ChainedEvent) => void;
}

export function Timeline({ events, selectedEventId, onSelectEvent }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
        <p className="text-sm">No events found matching current criteria.</p>
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
      case "error":
        return <Badge variant="danger">{severity}</Badge>;
      case "warning":
        return <Badge variant="warning">{severity}</Badge>;
      case "info":
        return <Badge variant="default">{severity}</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="relative border-l border-zinc-800 ml-4 space-y-4 my-2">
      {events.map((item) => {
        const isSelected = selectedEventId === item.event.event_id;
        const timeDisplay = item.event.occurred_at
          ? new Date(item.event.occurred_at).toLocaleTimeString()
          : "N/A";

        return (
          <div
            key={item.event.event_id}
            onClick={() => onSelectEvent?.(item)}
            className={`relative pl-6 cursor-pointer transition-all ${
              isSelected ? "opacity-100" : "opacity-85 hover:opacity-100"
            }`}
          >
            {/* Timeline bullet marker */}
            <div
              className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border ${
                isSelected
                  ? "bg-blue-500 border-blue-400 ring-4 ring-blue-500/20"
                  : "bg-zinc-700 border-zinc-900"
              }`}
            />

            <div
              className={`rounded-md border p-3 transition-colors ${
                isSelected
                  ? "border-blue-500/60 bg-blue-950/20"
                  : "border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-zinc-200">
                  {item.event.event_name}
                </span>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(item.event.severity)}
                  <span className="font-mono text-[11px] text-zinc-500">{timeDisplay}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Source: <span className="text-zinc-300">{item.event.source.system}</span>
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  Seq #{item.stream_sequence}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
