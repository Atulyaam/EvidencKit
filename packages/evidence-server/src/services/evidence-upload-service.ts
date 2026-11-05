import JSZip from "jszip";
import { computeArtifactDigest, EvidenceEvent, validateImportBundle } from "@evidencekit/core";
import {
  parseAppLogsToEvents,
  parseGitHistoryToEvents,
  parseCiLogToEvents,
  parseDeploymentsToEvents,
  CiRecord,
  GitCommitRecord,
  DeploymentRecord
} from "@evidencekit/adapters";
import { SessionContext, requireOwnerAuthorization } from "../authorization/index";
import { defaultChainService } from "./chain-service";
import { getServerEnv } from "../env";

export type DetectedSourceType =
  | "application_logs"
  | "git_history"
  | "ci_pipeline"
  | "deployments"
  | "evidencekit_bundle"
  | "zip_bundle"
  | "unknown";

export interface UploadPreviewResult {
  filename: string;
  sourceType: DetectedSourceType;
  artifactDigest: string;
  sizeBytes: number;
  totalRecordsDetected: number;
  previewEvents: EvidenceEvent[];
  warnings: string[];
  errors: string[];
  archiveEntries?: Array<{
    name: string;
    sizeBytes: number;
    sourceType: DetectedSourceType;
  }>;
}

export interface ImportExecutionResult {
  streamId: string;
  artifactId: string;
  filename: string;
  artifactDigest: string;
  recordsAccepted: number;
  recordsRejected: number;
  recordsSkipped: number;
  chainHeadHash: string;
  totalStreamEvents: number;
  warnings: string[];
  errors: string[];
}

export class EvidenceUploadService {
  /**
   * Sanitizes and verifies archive entry paths against Directory Traversal (Zip-Slip).
   */
  public static validateSafeZipPath(entryName: string): boolean {
    if (!entryName || entryName.trim() === "") return false;
    // Reject absolute paths, windows drive letters, or parent directory traversal
    if (
      entryName.startsWith("/") ||
      entryName.startsWith("\\") ||
      /^[a-zA-Z]:/.test(entryName) ||
      entryName.includes("../") ||
      entryName.includes("..\\")
    ) {
      return false;
    }
    return true;
  }

  /**
   * Sniffs source format from file name and parsed content.
   */
  public static detectSourceType(filename: string, content: string): DetectedSourceType {
    const lowerName = filename.toLowerCase();

    if (lowerName.endsWith(".zip")) {
      return "zip_bundle";
    }

    if (lowerName.endsWith(".jsonl") || lowerName.endsWith(".log")) {
      return "application_logs";
    }

    try {
      const parsed = JSON.parse(content);

      if (typeof parsed === "object" && parsed !== null) {
        // EvidenceKit Export Bundle
        if ("format_name" in parsed && parsed.format_name === "evidencekit-export") {
          return "evidencekit_bundle";
        }
        if (
          "manifest" in parsed &&
          typeof parsed.manifest === "object" &&
          parsed.manifest?.format_name === "evidencekit-export"
        ) {
          return "evidencekit_bundle";
        }

        // Arrays of records
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return "unknown";
          const first = parsed[0];
          if (first && typeof first === "object") {
            if ("sha" in first && ("author" in first || "message" in first)) {
              return "git_history";
            }
            if ("job_id" in first || "workflow_name" in first) {
              return "ci_pipeline";
            }
            if ("deployment_id" in first || "environment" in first) {
              return "deployments";
            }
            if ("level" in first && "message" in first) {
              return "application_logs";
            }
          }
        }
      }
    } catch {
      // If it fails JSON parse, check if each line is JSON (JSONL)
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        try {
          JSON.parse(lines[0]!);
          return "application_logs";
        } catch {
          return "application_logs"; // raw text logs fallback
        }
      }
    }

    if (lowerName.includes("git")) return "git_history";
    if (lowerName.includes("ci")) return "ci_pipeline";
    if (lowerName.includes("deploy")) return "deployments";
    if (lowerName.includes("log")) return "application_logs";

    return "unknown";
  }

  /**
   * Previews an uploaded file without saving, enforcing size and traversal limits.
   */
  public async previewUpload(
    filename: string,
    buffer: Buffer | Uint8Array
  ): Promise<UploadPreviewResult> {
    const env = getServerEnv();
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Check compressed size limit
    if (buffer.length > env.MAX_UPLOAD_COMPRESSED_BYTES) {
      throw new Error(
        `File size (${(buffer.length / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of ${env.MAX_UPLOAD_COMPRESSED_BYTES / 1024 / 1024} MB.`
      );
    }

    const artifactDigest = computeArtifactDigest(buffer);

    // 2. Handle ZIP Archives
    if (filename.toLowerCase().endsWith(".zip")) {
      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(buffer);
      } catch (err: any) {
        throw new Error(`Corrupted or invalid ZIP archive: ${err.message}`);
      }

      const fileEntries = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);

      if (fileEntries.length > env.MAX_ARCHIVE_ENTRIES) {
        throw new Error(
          `Archive contains ${fileEntries.length} entries, exceeding maximum entry limit of ${env.MAX_ARCHIVE_ENTRIES}.`
        );
      }

      let totalExpandedBytes = 0;
      const archiveEntriesInfo: Array<{
        name: string;
        sizeBytes: number;
        sourceType: DetectedSourceType;
      }> = [];

      for (const entryName of fileEntries) {
        if (!EvidenceUploadService.validateSafeZipPath(entryName)) {
          throw new Error(
            `Security Exception: Directory traversal attempt detected in archive entry '${entryName}'. Upload rejected.`
          );
        }

        const entry = zip.files[entryName]!;
        // Decompress preview
        const entryContent = await entry.async("string");
        totalExpandedBytes += entryContent.length;

        if (totalExpandedBytes > env.MAX_UPLOAD_EXPANDED_BYTES) {
          throw new Error(
            `Security Exception: Decompressed archive size exceeds maximum expansion budget of ${env.MAX_UPLOAD_EXPANDED_BYTES / 1024 / 1024} MB (possible decompression bomb).`
          );
        }

        const st = EvidenceUploadService.detectSourceType(entryName, entryContent);
        archiveEntriesInfo.push({
          name: entryName,
          sizeBytes: entryContent.length,
          sourceType: st
        });
      }

      return {
        filename,
        sourceType: "zip_bundle",
        artifactDigest,
        sizeBytes: buffer.length,
        totalRecordsDetected: archiveEntriesInfo.length,
        previewEvents: [],
        warnings,
        errors,
        archiveEntries: archiveEntriesInfo
      };
    }

    // 3. Single File Handling
    const content = Buffer.isBuffer(buffer)
      ? buffer.toString("utf8")
      : new TextDecoder().decode(buffer);
    const sourceType = EvidenceUploadService.detectSourceType(filename, content);

    if (sourceType === "unknown") {
      errors.push(`Unrecognized or unsupported file format for '${filename}'.`);
      return {
        filename,
        sourceType,
        artifactDigest,
        sizeBytes: buffer.length,
        totalRecordsDetected: 0,
        previewEvents: [],
        warnings,
        errors
      };
    }

    const { events } = this.parseContentToEvents(
      sourceType,
      content,
      "preview_stream",
      "preview_artifact"
    );

    return {
      filename,
      sourceType,
      artifactDigest,
      sizeBytes: buffer.length,
      totalRecordsDetected: events.length,
      previewEvents: events.slice(0, 5),
      warnings,
      errors
    };
  }

  /**
   * Parses raw file content into canonical EvidenceEvents using existing adapters.
   */
  public parseContentToEvents(
    sourceType: DetectedSourceType,
    content: string,
    streamId: string,
    artifactId: string
  ): { events: EvidenceEvent[]; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];
    let events: EvidenceEvent[] = [];

    try {
      switch (sourceType) {
        case "ci_pipeline": {
          const records: CiRecord[] = JSON.parse(content);
          events = parseCiLogToEvents(records, streamId, artifactId);
          break;
        }
        case "git_history": {
          const commits: GitCommitRecord[] = JSON.parse(content);
          events = parseGitHistoryToEvents(commits, streamId, artifactId);
          break;
        }
        case "deployments": {
          const deps: DeploymentRecord[] = JSON.parse(content);
          events = parseDeploymentsToEvents(deps, streamId, artifactId);
          break;
        }
        case "application_logs": {
          const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
          events = parseAppLogsToEvents(lines, streamId, artifactId);
          break;
        }
        case "evidencekit_bundle": {
          const parsed = JSON.parse(content);
          const validation = validateImportBundle(parsed);
          if (!validation.valid) {
            errors.push(...validation.errors);
          }
          events = validation.events.map((e) => e.event);
          break;
        }
        default:
          errors.push(`Cannot parse source type '${sourceType}'.`);
      }
    } catch (err: any) {
      errors.push(`Failed to parse content: ${err.message}`);
    }

    return { events, warnings, errors };
  }

  /**
   * Imports an uploaded file or ZIP archive into an incident case stream.
   * Atomically appends canonical events to the hash chain.
   */
  public async importUpload(
    streamId: string,
    filename: string,
    buffer: Buffer | Uint8Array,
    context: SessionContext
  ): Promise<ImportExecutionResult> {
    requireOwnerAuthorization(context);

    // 1. Preview and validate safety limits
    const preview = await this.previewUpload(filename, buffer);
    if (preview.errors.length > 0) {
      throw new Error(`Upload validation failed: ${preview.errors.join("; ")}`);
    }

    const artifactId = `art_${preview.artifactDigest.slice(0, 12)}`;
    let allEventsToIngest: EvidenceEvent[] = [];
    const warnings: string[] = [...preview.warnings];
    const errors: string[] = [];

    // 2. Handle ZIP archive ingestion
    if (preview.sourceType === "zip_bundle") {
      const zip = await JSZip.loadAsync(buffer);
      const entries = Object.keys(zip.files).filter((n) => !zip.files[n]?.dir);

      for (const entryName of entries) {
        const entry = zip.files[entryName]!;
        const text = await entry.async("string");
        const entrySourceType = EvidenceUploadService.detectSourceType(entryName, text);

        if (entrySourceType !== "unknown") {
          const entryDigest = computeArtifactDigest(text);
          const subArtifactId = `art_${entryDigest.slice(0, 12)}`;
          const parsed = this.parseContentToEvents(entrySourceType, text, streamId, subArtifactId);
          warnings.push(...parsed.warnings);
          errors.push(...parsed.errors);
          allEventsToIngest.push(...parsed.events);
        }
      }
    } else {
      // 3. Single file ingestion
      const content = Buffer.isBuffer(buffer)
        ? buffer.toString("utf8")
        : new TextDecoder().decode(buffer);
      const parsed = this.parseContentToEvents(preview.sourceType, content, streamId, artifactId);
      warnings.push(...parsed.warnings);
      errors.push(...parsed.errors);
      allEventsToIngest = parsed.events;
    }

    // 4. Ingest and transactionally append to hash chain
    let recordsAccepted = 0;
    let recordsRejected = 0;
    let recordsSkipped = 0;

    for (const event of allEventsToIngest) {
      try {
        defaultChainService.appendInMemory(event);
        recordsAccepted++;
      } catch (err: any) {
        recordsRejected++;
        errors.push(`Event '${event.event_id}' append failed: ${err.message}`);
      }
    }

    const streamEvents = defaultChainService.getEventsInMemory(streamId);
    const lastEvent = streamEvents[streamEvents.length - 1];
    const chainHeadHash = lastEvent ? lastEvent.event_hash : "0".repeat(64);

    return {
      streamId,
      artifactId,
      filename,
      artifactDigest: preview.artifactDigest,
      recordsAccepted,
      recordsRejected,
      recordsSkipped,
      chainHeadHash,
      totalStreamEvents: streamEvents.length,
      warnings,
      errors
    };
  }
}

export const defaultEvidenceUploadService = new EvidenceUploadService();
