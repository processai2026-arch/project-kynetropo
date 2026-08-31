import type { ChangeEvent } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceNoteRecorderProps {
  /** Whether the browser MediaRecorder is actively recording. */
  recording: boolean;
  /** Object-URL of the freshly recorded (or file-selected) audio, or null. */
  recordedUrl: string | null;
  /** Elapsed seconds since recording started (also shown in the playback label). */
  recordSeconds: number;
  /**
   * Server-relative path of an existing voice note (e.g. from an edit context).
   * Displayed only when no new recording/file has been chosen yet.
   * The component prepends "/api/" automatically.
   */
  existingPath?: string | null;
  /** Called when the user clicks "Record" to start a new in-browser recording. */
  onStartRecording: () => void;
  /** Called when the user clicks "Stop" to finish the recording. */
  onStopRecording: () => void;
  /** Called when the user clicks "Discard" to throw away the current recording. */
  onDiscard: () => void;
  /** Native file-input onChange — forwards the selected file to the parent. */
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceNoteRecorder({
  recording,
  recordedUrl,
  recordSeconds,
  existingPath,
  onStartRecording,
  onStopRecording,
  onDiscard,
  onFileChange,
}: VoiceNoteRecorderProps) {
  const existingAudioSrc = existingPath
    ? `/api/${existingPath.replace(/^\/api\//, '')}`
    : null;

  return (
    <div className="space-y-2">
      {/* ---- New recording / file-upload controls ---- */}
      {!recordedUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          {!recording ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartRecording}
              className="gap-1.5"
            >
              <Mic className="h-4 w-4 text-destructive" />
              Record
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStopRecording}
              className={cn(
                'gap-1.5 border-red-300 text-red-600 animate-pulse',
              )}
            >
              <Square className="h-3.5 w-3.5 fill-red-500" />
              Stop ({recordSeconds}s)
            </Button>
          )}

          <span className="text-xs text-muted-foreground">or upload:</span>

          <input
            type="file"
            accept="audio/*"
            onChange={onFileChange}
            className={cn(
              'text-xs text-card-foreground cursor-pointer',
              'file:mr-2 file:py-1 file:px-2 file:rounded',
              'file:border file:border-border file:text-xs',
              'file:bg-background file:text-card-foreground',
            )}
          />
        </div>
      ) : (
        /* ---- Playback + discard after a recording is captured ---- */
        <div className="space-y-2">
          <audio controls src={recordedUrl} className="h-8 w-full" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-600 font-medium">
              Recorded ({recordSeconds}s)
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onDiscard}
              className="h-6 text-xs px-2 text-destructive hover:text-destructive"
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* ---- Existing server-side recording (edit mode, no new file yet) ---- */}
      {existingAudioSrc && !recordedUrl && (
        <div className="flex items-center gap-3 pt-1">
          <audio controls src={existingAudioSrc} className="h-8 flex-1 min-w-0" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Existing recording
          </span>
        </div>
      )}
    </div>
  );
}

export default VoiceNoteRecorder;
