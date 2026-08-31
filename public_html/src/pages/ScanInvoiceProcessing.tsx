import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { scanInvoicesApi } from "@/lib/api/scanInvoices";

const STAGE_LABELS: Record<string, string> = {
  starting:         "Starting…",
  reading_image:    "Reading image…",
  extracting_text:  "Extracting text…",
  analyzing_text:   "Analyzing with AI…",
  gemini_fallback:  "Trying fallback AI…",
  validating:       "Validating data…",
  complete:         "Complete",
  error:            "Error",
};

export default function ScanInvoiceProcessing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("starting");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    const poll = async () => {
      try {
        const status = await scanInvoicesApi.getStatus(Number(id));
        setProgress(status.progress);
        setStage(status.stage);
        if (status.status === "review" || status.status === "approved") {
          clearInterval(intervalRef.current!);
          navigate(`/scan-invoices/${id}/review`);
        } else if (status.status === "error") {
          clearInterval(intervalRef.current!);
          setError("AI extraction failed. You can still review and enter data manually.");
        } else if (status.status === "rejected") {
          clearInterval(intervalRef.current!);
          navigate(`/scan-invoices/${id}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Status check failed");
      }
    };
    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [id, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="bg-card rounded-xl border shadow-sm p-8 text-center w-full max-w-md">
        <div className="relative h-24 w-24 mx-auto mb-4">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke="var(--color-primary, #2ea0da)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground">{progress}%</span>
        </div>

        {error ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => navigate(`/scan-invoices/${id}/review`)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Review Manually</button>
              <button onClick={() => navigate("/scan-invoices")} className="px-4 py-2 border rounded-lg text-sm">Back to List</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-lg font-semibold text-foreground">{STAGE_LABELS[stage] ?? "Processing…"}</p>
            <p className="text-sm text-muted-foreground mt-1">AI is extracting invoice data. This may take up to 30 seconds.</p>
          </>
        )}
      </div>
    </div>
  );
}
