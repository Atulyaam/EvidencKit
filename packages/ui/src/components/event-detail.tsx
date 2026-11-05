import { ChainedEvent } from "@evidencekit/core";

export interface EventDetailProps {
  item: ChainedEvent | null;
  onClose?: () => void;
}

export function EventDetail({ item, onClose }: EventDetailProps) {
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
        Select an event from the timeline to inspect evidence details and cryptographic
        verification.
      </div>
    );
  }

  const { event, stream_sequence, previous_hash, event_hash } = item;

  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto p-4 text-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h4 className="font-mono text-sm font-bold text-zinc-100">{event.event_name}</h4>
          <span className="text-xs text-zinc-500">ID: {event.event_id}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        )}
      </div>

      {/* Cryptographic Chain Metadata */}
      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
        <div className="font-semibold text-zinc-300">Hash-Chain Verification</div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Sequence:</span>
          <span className="font-mono font-medium">{stream_sequence}</span>
        </div>
        <div className="flex flex-col space-y-0.5">
          <span className="text-zinc-500">Previous Hash:</span>
          <span className="break-all font-mono text-[11px] text-zinc-400">{previous_hash}</span>
        </div>
        <div className="flex flex-col space-y-0.5">
          <span className="text-zinc-500">Event Hash:</span>
          <span className="break-all font-mono text-[11px] text-blue-400">{event_hash}</span>
        </div>
      </div>

      {/* Source & Provenance */}
      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
        <div className="font-semibold text-zinc-300">Source Provenance</div>
        <div className="flex justify-between">
          <span className="text-zinc-500">System:</span>
          <span>{event.source.system}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Adapter:</span>
          <span>
            {event.source.adapter} (v{event.source.adapter_version})
          </span>
        </div>
        {event.source.artifact_id && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Artifact:</span>
            <span className="font-mono">{event.source.artifact_id}</span>
          </div>
        )}
        {event.evidence_refs && event.evidence_refs.length > 0 && (
          <div className="mt-2 space-y-1">
            <span className="text-zinc-500">Evidence Locators:</span>
            {event.evidence_refs.map((ref, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-zinc-950 px-2 py-1 font-mono text-[11px]"
              >
                <span className="text-zinc-400">{ref.locator_type}</span>
                <span className="text-emerald-400">{ref.locator}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attributes */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-zinc-400">Attributes</div>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
          {JSON.stringify(event.attributes, null, 2)}
        </pre>
      </div>
    </div>
  );
}
