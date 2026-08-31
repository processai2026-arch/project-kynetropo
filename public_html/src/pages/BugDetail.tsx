import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { opsBugsApi } from "@/lib/api/ops";
import type { OpsBug, OpsBugComment } from "@/types/ops";
import {
  ArrowLeft, Bug, ImageIcon, MessageSquare, Clock,
  Send, Pencil, CheckCircle, AlertCircle, RefreshCw,
  User, Calendar, FolderKanban, Check, Upload, X, Plus,
} from "lucide-react";
import { toast } from "sonner";

const priorityStyles: Record<string, string> = {
  p0_critical: "bg-red-50 text-red-600 border-red-200",
  p1_high:     "bg-amber-50 text-amber-600 border-amber-200",
  p2_medium:   "bg-blue-50 text-blue-600 border-blue-200",
  p3_low:      "bg-gray-100 text-gray-500 border-gray-200",
};
const priorityLabels: Record<string, string> = {
  p0_critical: "P0 Critical", p1_high: "P1 High",
  p2_medium: "P2 Medium",    p3_low:  "P3 Low",
};
const statusStyles: Record<string, string> = {
  open:        "bg-red-50 text-red-600 border-red-200",
  in_progress: "bg-amber-50 text-amber-600 border-amber-200",
  fixed:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  retest:      "bg-blue-50 text-blue-600 border-blue-200",
  closed:      "bg-gray-100 text-gray-500 border-gray-200",
  wont_fix:    "bg-gray-100 text-gray-400 border-gray-200",
};
const statusOrder = ["open", "in_progress", "fixed", "retest", "closed"];

const statusIcon: Record<string, React.ReactNode> = {
  open:        <AlertCircle className="h-3.5 w-3.5" />,
  in_progress: <RefreshCw className="h-3.5 w-3.5" />,
  fixed:       <CheckCircle className="h-3.5 w-3.5" />,
  retest:      <RefreshCw className="h-3.5 w-3.5" />,
  closed:      <CheckCircle className="h-3.5 w-3.5" />,
  wont_fix:    <AlertCircle className="h-3.5 w-3.5" />,
};

type BugDetail = OpsBug & {
  screenshots: { id: number; file_path: string; uploaded_by?: string; created_at?: string }[];
  comments: (OpsBugComment & { status_at?: string })[];
  history: { id: number; action: string; description: string; done_by: string; created_at: string }[];
};

export default function BugDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bug, setBug]           = useState<BugDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [comment, setComment]   = useState("");
  const [author, setAuthor]     = useState("");
  const [sending, setSending]   = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // Steps to reproduce editing
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsValue, setStepsValue]     = useState("");
  const [savingSteps, setSavingSteps]   = useState(false);
  // Screenshot upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localScreenshots, setLocalScreenshots] = useState<{ id: number; file_path: string; name: string }[]>([]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await opsBugsApi.get(Number(id));
      const data = (res as any).data as BugDetail;
      setBug(data);
      setNewStatus(data.status);
      setStepsValue(data.steps_to_repro ?? "");
      setLocalScreenshots(
        (data.screenshots ?? []).map(s => ({ id: s.id, file_path: s.file_path, name: s.uploaded_by ?? "Screenshot" }))
      );
    } catch { toast.error("Failed to load bug"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSendComment = async () => {
    if (!comment.trim() || !bug) return;
    setSending(true);
    try {
      await opsBugsApi.addComment(bug.id, comment.trim(), author || "Anonymous");
      toast.success("Comment added");
      setComment("");
      load();
    } catch { toast.error("Failed to add comment"); }
    finally   { setSending(false); }
  };

  const handleStatusChange = async (status: string) => {
    if (!bug || status === bug.status) return;
    setUpdatingStatus(true);
    try {
      await opsBugsApi.update(bug.id, { status: status as OpsBug["status"] });
      toast.success(`Status → ${status.replace("_", " ")}`);
      load();
    } catch { toast.error("Failed to update status"); }
    finally   { setUpdatingStatus(false); }
  };

  const handleSaveSteps = async () => {
    if (!bug) return;
    setSavingSteps(true);
    try {
      await opsBugsApi.update(bug.id, { steps_to_repro: stepsValue });
      toast.success("Steps saved");
      setEditingSteps(false);
      load();
    } catch { toast.error("Failed to save"); }
    finally   { setSavingSteps(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // In mock mode: create object URLs so images render immediately
    const newScreenshots = files.map((file, i) => ({
      id: Date.now() + i,
      file_path: URL.createObjectURL(file),
      name: file.name,
    }));
    setLocalScreenshots(prev => [...prev, ...newScreenshots]);
    toast.success(`${files.length} screenshot${files.length > 1 ? "s" : ""} added`);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleRemoveScreenshot = (id: number) => {
    setLocalScreenshots(prev => prev.filter(s => s.id !== id));
    toast.success("Screenshot removed");
  };

  // Merge history entries and comments into a single chronological timeline
  const timeline = bug ? [
    ...(bug.history ?? []).map(h => ({
      type: "status" as const,
      id: "h-" + h.id,
      text: h.description,
      by: h.done_by,
      at: h.created_at,
    })),
    ...(bug.comments ?? []).map(c => ({
      type: "comment" as const,
      id: "c-" + c.id,
      text: c.comment,
      by: c.added_by,
      at: c.created_at,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()) : [];

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );

  if (!bug) return <div className="p-8 text-muted-foreground">Bug not found</div>;

  const currentStatusIdx = statusOrder.indexOf(bug.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">#{bug.id}</span>
            <Badge className={cn("border text-xs", priorityStyles[bug.priority])}>
              {priorityLabels[bug.priority]}
            </Badge>
            <Badge className={cn("border capitalize text-xs flex items-center gap-1", statusStyles[bug.status])}>
              {statusIcon[bug.status]}
              {bug.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {bug.type.replace("_", " ")}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-foreground leading-snug">{bug.description}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              <Link to={`/projects/${bug.project_id}`} className="hover:underline text-primary">
                {bug.project_name ?? "Unknown project"}
              </Link>
            </span>
            {bug.module && (
              <span className="flex items-center gap-1">
                <Bug className="h-3 w-3" />{bug.module}
              </span>
            )}
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />Reported by {bug.reported_by || "—"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(bug.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            {bug.target_date && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />Target: {bug.target_date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status progress bar */}
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-1">
          {statusOrder.map((s, idx) => {
            const done    = idx < currentStatusIdx;
            const current = idx === currentStatusIdx;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  "w-full h-2 rounded-full transition-colors",
                  done    ? "bg-emerald-500" :
                  current ? "bg-primary" :
                            "bg-muted",
                )} />
                <span className={cn(
                  "text-xs capitalize hidden sm:block",
                  current ? "text-primary font-medium" : "text-muted-foreground",
                )}>{s.replace("_", " ")}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Steps to reproduce */}
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" />Steps to Reproduce
              </h2>
              {!editingSteps
                ? <Button size="sm" variant="outline" onClick={() => setEditingSteps(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                : <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveSteps} disabled={savingSteps}>
                      <Check className="h-3.5 w-3.5 mr-1" />{savingSteps ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingSteps(false); setStepsValue(bug.steps_to_repro ?? ""); }} disabled={savingSteps}>
                      Cancel
                    </Button>
                  </div>
              }
            </div>
            {editingSteps ? (
              <Textarea
                value={stepsValue}
                onChange={e => setStepsValue(e.target.value)}
                rows={6}
                placeholder={"1. Go to checkout\n2. Select UPI\n3. Let timer expire\n4. Expected: error shown — Actual: silent failure"}
                className="font-mono text-sm"
                autoFocus
              />
            ) : stepsValue ? (
              <pre className="text-sm text-card-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {stepsValue}
              </pre>
            ) : (
              <div className="flex items-center justify-between text-sm text-muted-foreground py-2">
                <span>No steps added yet</span>
                <Button size="sm" variant="outline" onClick={() => setEditingSteps(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Steps
                </Button>
              </div>
            )}
          </div>

          {/* Screenshots */}
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                Screenshots ({localScreenshots.length})
              </h2>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" />Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {localScreenshots.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition-colors">
                <Upload className="h-6 w-6 mb-1 opacity-40" />
                Click to upload screenshots
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {localScreenshots.map(s => (
                  <div key={s.id} className="group relative aspect-video rounded-lg overflow-hidden border bg-muted">
                    <img src={s.file_path} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveScreenshot(s.id)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Remove">
                      <X className="h-3 w-3" />
                    </button>
                    {/* Name on hover */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {s.name}
                    </div>
                  </div>
                ))}
                {/* Add more tile */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-video rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors text-xs gap-1">
                  <Upload className="h-5 w-5" />
                  Add more
                </button>
              </div>
            )}
          </div>

          {/* Comments + Timeline */}
          <div className="bg-card rounded-xl border shadow-sm">
            <div className="p-4 border-b flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-card-foreground">
                Activity &amp; Comments ({timeline.length})
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {timeline.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              )}
              {timeline.map(entry => (
                <div key={entry.id} className="flex gap-3">
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5",
                    entry.type === "comment" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    {entry.type === "comment"
                      ? <MessageSquare className="h-3.5 w-3.5" />
                      : <Clock className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {entry.type === "comment" ? (
                      <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-card-foreground">{entry.by || "Anonymous"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{" "}
                            {new Date(entry.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm text-card-foreground whitespace-pre-wrap">{entry.text}</p>
                      </div>
                    ) : (
                      <div className="pt-0.5">
                        <p className="text-sm text-card-foreground">{entry.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.by || "System"} · {new Date(entry.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add comment box */}
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Your name</Label>
                  <input
                    className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Founder / QA / Client"
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Add a comment</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe what you found, what was done, or ask a question…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendComment();
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Ctrl+Enter to submit</p>
                </div>
                <Button onClick={handleSendComment} disabled={sending || !comment.trim()} className="w-full">
                  <Send className="h-3.5 w-3.5 mr-2" />
                  {sending ? "Adding…" : "Add Comment"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right — metadata + actions */}
        <div className="space-y-4">
          {/* Update status */}
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Update Status</h3>
            <div className="space-y-3">
              <Select value={newStatus} onValueChange={handleStatusChange} disabled={updatingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["open","in_progress","fixed","retest","closed","wont_fix"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Changing status logs it to the activity timeline.</p>
            </div>
          </div>

          {/* Bug details */}
          <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-card-foreground">Details</h3>
            {[
              ["Project",    <Link to={`/projects/${bug.project_id}`} className="text-primary hover:underline">{bug.project_name ?? "—"}</Link>],
              ["Module",     bug.module || "—"],
              ["Type",       <span className="capitalize">{bug.type.replace("_", " ")}</span>],
              ["Priority",   <Badge className={cn("border text-xs", priorityStyles[bug.priority])}>{priorityLabels[bug.priority]}</Badge>],
              ["Reported by",bug.reported_by || "—"],
              ["Developer",  bug.developer_name || "Unassigned"],
              ["QA",         bug.qa_name        || "Unassigned"],
              ["Target date",bug.target_date    || "—"],
              ["Opened",     new Date(bug.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
            ].map(([label, val]) => (
              <div key={String(label)} className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="text-card-foreground text-right">{val as React.ReactNode}</span>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="bg-card rounded-xl border shadow-sm p-4 space-y-2">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Quick Actions</h3>
            <Button
              variant="outline" size="sm" className="w-full justify-start"
              onClick={() => navigate(`/bugs?project_id=${bug.project_id}`)}
            >
              <Bug className="h-3.5 w-3.5 mr-2" />All bugs in this project
            </Button>
            <Button
              variant="outline" size="sm" className="w-full justify-start"
              onClick={() => navigate(`/projects/${bug.project_id}`)}
            >
              <FolderKanban className="h-3.5 w-3.5 mr-2" />Go to project
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
