import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Plus, X, Loader2, CheckCircle2, XCircle, FolderKanban, Users, Bug, CalendarDays, Zap, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { opsAiChatApi, opsAiCommandApi } from "@/lib/api/ops";
import type { AiChatMessage, AiChatContextEntity, AiChatResponse, AiChatIntent } from "@/types/ops";
import { toast } from "sonner";
import AiEditFormManager from "@/pages/AiEditFormManager";

const ENTITY_ICONS: Record<string, typeof FolderKanban> = {
  project: FolderKanban,
  client:  Users,
  bug:     Bug,
  meeting: CalendarDays,
};

const ENTITY_COLORS: Record<string, string> = {
  project: "bg-sky-50 text-sky-700 border-sky-200",
  client:  "bg-purple-50 text-purple-700 border-purple-200",
  bug:     "bg-red-50 text-red-700 border-red-200",
  meeting: "bg-amber-50 text-amber-700 border-amber-200",
};

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <span key={i} className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

// Context picker modal
function ContextPicker({ onAdd, onClose }: { onAdd: (e: AiChatContextEntity) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AiChatContextEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await opsAiChatApi.entities(q);
        setResults((res as any).data ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-card rounded-xl border shadow-lg z-50 overflow-hidden">
      <div className="p-3 border-b flex items-center gap-2">
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search projects, clients, bugs…"
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {results.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">No results</p>
        )}
        {results.map(r => {
          const Icon = ENTITY_ICONS[r.type] ?? FolderKanban;
          return (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => { onAdd(r); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-card-foreground truncate">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Single assistant message bubble
function AssistantBubble({
  msg,
  onChoiceSelect,
  onConfirm,
  onDeny,
  executing,
  mode,
}: {
  msg: AiChatMessage;
  onChoiceSelect: (value: string, label: string) => void;
  onConfirm: (token: string, preview: string, intent?: AiChatIntent) => void;
  onDeny: () => void;
  executing: boolean;
  mode: "auto" | "edit";
}) {
  const r = msg.response;
  if (!r) return null;

  return (
    <div className="flex items-start gap-3 group">
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {/* Main message text */}
        <div className="bg-muted/40 rounded-2xl rounded-tl-sm px-4 py-3 max-w-xl">
          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{r.message}</p>
        </div>

        {/* Choices */}
        {r.type === "choices" && r.choices && r.choices.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {r.choices.map(c => (
              <button
                key={c.value}
                onClick={() => onChoiceSelect(c.value, c.label)}
                className="text-sm px-3 py-1.5 rounded-full border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Confirm card */}
        {r.type === "confirm" && r.token && (
          <div className="bg-card border rounded-xl p-4 max-w-sm space-y-3">
            <p className="text-sm font-medium text-card-foreground">{r.preview}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={executing}
                onClick={() => onConfirm(r.token!, r.preview ?? "", r.intent)}
              >
                {executing
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Executing…</>
                  : mode === "edit"
                    ? <><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit &amp; Save</>
                    : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Confirm</>}
              </Button>
              <Button size="sm" variant="outline" onClick={onDeny}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiChat() {
  const [messages, setMessages]         = useState<AiChatMessage[]>([]);
  const [input, setInput]               = useState("");
  const [sending, setSending]           = useState(false);
  const [executing, setExecuting]       = useState(false);
  const [context, setContext]           = useState<AiChatContextEntity[]>([]);
  const [showPicker, setShowPicker]     = useState(false);
  const [pendingIntent, setPendingIntent] = useState<Record<string, unknown> | null>(null);
  const [mode, setMode]                 = useState<"auto" | "edit">("auto");
  const [pendingEdit, setPendingEdit]   = useState<{ method: string; path: string; body: Record<string, unknown>; token?: string } | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  const addUserMessage = (text: string): AiChatMessage => {
    const msg: AiChatMessage = {
      id: nanoid(), role: "user", content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  const addAssistantMessage = (response: AiChatResponse) => {
    setMessages(prev => [...prev, {
      id: nanoid(), role: "assistant",
      content: response.message,
      response,
      timestamp: new Date().toISOString(),
    }]);
    if (response.pending_intent) setPendingIntent(response.pending_intent as Record<string, unknown>);
    else if (response.type === "confirm" || response.type === "text") setPendingIntent(null);
  };

  const buildHistory = useCallback(() => {
    return messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setPendingIntent(null);
    addUserMessage(trimmed);
    setSending(true);

    // Add typing indicator
    const typingId = nanoid();
    setMessages(prev => [...prev, {
      id: typingId, role: "assistant", content: "", timestamp: new Date().toISOString(),
    }]);

    try {
      const res = await opsAiChatApi.message({
        message: trimmed,
        history: buildHistory(),
        context: context.map(c => ({ type: c.type, id: c.id })),
        pending_intent: pendingIntent,
      });
      // Remove typing indicator
      setMessages(prev => prev.filter(m => m.id !== typingId));
      const data: AiChatResponse = (res as any).data ?? res;
      addAssistantMessage(data);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== typingId));
      addAssistantMessage({ type: "text", message: "Sorry, something went wrong. Please try again." });
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleChoiceSelect = (value: string, label: string) => {
    send(label);
  };

  const handleConfirm = async (token: string, preview: string, intent?: AiChatIntent) => {
    if (mode === "edit" && intent?.method && intent?.path) {
      setPendingEdit({
        method: intent.method,
        path:   intent.path,
        body:   (intent.body ?? {}) as Record<string, unknown>,
        token,
      });
      return;
    }
    setExecuting(true);
    try {
      const res = await opsAiCommandApi.execute(token);
      const data = (res as any).data ?? res;
      toast.success(data.message ?? "Done!");
      addAssistantMessage({ type: "text", message: "✓ " + (data.message ?? "Done!") });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed.";
      toast.error(msg);
      addAssistantMessage({ type: "text", message: "Failed: " + msg });
    } finally {
      setExecuting(false);
    }
  };

  const handleDeny = () => {
    addAssistantMessage({ type: "text", message: "Got it — cancelled. What else can I help with?" });
    setPendingIntent(null);
  };

  const removeContext = (idx: number) => {
    setContext(prev => prev.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 pb-4">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">Kynetropo AI</h1>
          <p className="text-xs text-muted-foreground">
            {mode === "edit"
              ? "Edit mode — AI fills the form, you review and save"
              : "Ask me anything about your projects, clients, meetings, or bugs"}
          </p>
        </div>
        <div className="ml-auto flex rounded-lg border overflow-hidden text-xs">
          <button
            onClick={() => setMode("auto")}
            className={cn(
              "px-3 py-1.5 flex items-center gap-1.5 transition-colors",
              mode === "auto"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground bg-muted/30"
            )}
          >
            <Zap className="h-3 w-3" /> Auto
          </button>
          <button
            onClick={() => setMode("edit")}
            className={cn(
              "px-3 py-1.5 flex items-center gap-1.5 transition-colors",
              mode === "edit"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground bg-muted/30"
            )}
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-card-foreground">What can I help you with?</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Update projects, log payments, schedule meetings, or ask about your pipeline — all in plain English.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {[
                "Set VTT Gold health to red",
                "Log ₹50,000 payment for Stabilus",
                "Schedule meeting with Varam on Aug 12",
                "What's overdue this week?",
              ].map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-md text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          // Typing indicator (empty content, no response)
          if (!msg.content && !msg.response) {
            return (
              <div key={msg.id} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <TypingDots />
              </div>
            );
          }

          return (
            <AssistantBubble
              key={msg.id}
              msg={msg}
              onChoiceSelect={handleChoiceSelect}
              onConfirm={handleConfirm}
              onDeny={handleDeny}
              executing={executing}
              mode={mode}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="pt-4">
        {/* Context chips */}
        {context.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {context.map((c, i) => {
              const Icon = ENTITY_ICONS[c.type] ?? FolderKanban;
              return (
                <span key={i} className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", ENTITY_COLORS[c.type])}>
                  <Icon className="h-3 w-3" />
                  {c.label}
                  <button onClick={() => removeContext(i)} className="ml-0.5 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="relative bg-card border rounded-2xl shadow-sm">
          {/* Context picker */}
          {showPicker && (
            <ContextPicker
              onAdd={e => setContext(prev => prev.find(x => x.type === e.type && x.id === e.id) ? prev : [...prev, e])}
              onClose={() => setShowPicker(false)}
            />
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={sending}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-4 pt-3 pb-2 pr-24 min-h-[44px] max-h-[140px]"
          />

          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button
              onClick={() => setShowPicker(v => !v)}
              title="Attach context"
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                showPicker ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || sending}
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                input.trim() && !sending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Powered by Groq · Llama 3.3 70B · Actions are confirmed before executing
        </p>
      </div>

      <AiEditFormManager
        pendingEdit={pendingEdit}
        onClose={() => setPendingEdit(null)}
        onSuccess={(msg) => {
          setPendingEdit(null);
          addAssistantMessage({ type: "text", message: "✓ " + msg });
        }}
      />
    </div>
  );
}
