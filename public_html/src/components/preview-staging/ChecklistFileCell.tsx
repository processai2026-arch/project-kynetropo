import React from "react";
import { Upload, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASE_URL } from "@/lib/api/client";
import type { Document } from "@/types/document";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a server-relative file path to a full URL, stripping the /api suffix
 *  that BASE_URL may carry (same logic used in PropertyDetail.tsx). */
function resolveHref(filePath: string | null | undefined): string {
  if (!filePath) return '';
  const base = (BASE_URL ?? '').replace(/\/api$/, '');
  return `${base}/${filePath}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChecklistFileCellProps {
  /** Linked document record, or null/undefined when no file is attached yet. */
  linkedDoc: Document | null | undefined;
  /** True while an upload request is in flight for this specific cell. */
  isUploading: boolean;
  /** Called when the user selects a file in the empty (no doc) state. */
  onUpload: React.ChangeEventHandler<HTMLInputElement>;
  /** Called when the user selects a replacement file in the filled state. */
  onReplace: React.ChangeEventHandler<HTMLInputElement>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ChecklistFileCell
 *
 * A compact table-cell control used inside the Legal Checklist table on
 * PropertyDetail.  Renders one of three states:
 *   1. Filled   — view/download link + replace icon
 *   2. Uploading — spinner (input disabled)
 *   3. Empty    — upload icon that opens the OS file picker
 */
export function ChecklistFileCell({
  linkedDoc,
  isUploading,
  onUpload,
  onReplace,
}: ChecklistFileCellProps) {
  // ── State: file already linked ──────────────────────────────────────────
  if (linkedDoc) {
    return (
      <div className="flex items-center justify-center gap-1">
        <a
          href={resolveHref(linkedDoc.file_path)}
          download={linkedDoc.file_name}
          title={linkedDoc.file_name}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          <Upload className="h-3 w-3 rotate-180" />
          View
        </a>
        <label className="cursor-pointer ml-1" title="Replace file">
          <input
            type="file"
            className="hidden"
            onChange={onReplace}
          />
          <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
        </label>
      </div>
    );
  }

  // ── State: empty / uploading ─────────────────────────────────────────────
  return (
    <label className={cn('cursor-pointer block', isUploading && 'opacity-50')}>
      <input
        type="file"
        className="hidden"
        disabled={isUploading}
        onChange={onUpload}
      />
      {isUploading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
      ) : (
        <Upload className="h-3.5 w-3.5 mx-auto text-muted-foreground hover:text-primary transition-colors" />
      )}
    </label>
  );
}

export default ChecklistFileCell;
