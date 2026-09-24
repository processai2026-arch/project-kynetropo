import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Check, Loader2, Plus, Send, Sparkles, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { salesAiApi } from "@/lib/api/salesAi";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { cn } from "@/lib/utils";
import type {
  SalesAiChatMessage,
  SalesAiConversation,
  SalesAiResponse,
} from "@/types/salesAi";

/**
 * Sales AI Assistant — a write-capable chat over the whole Sales CRM.
 *
 * It answers questions from live data and proposes actions (add lead, log a
 * call, schedule a follow-up or meeting, create a task or challenge). Nothing
 * is written until the user taps Confirm on the card the assistant returns; a
 * single prompt may produce several cards, each confirmed on its own. Threads
 * are stored server-side, so history survives a refresh.
 */

const SUGGESTIONS = [
  "Add a lead: Acme Corp, contact Priya, phone 9876543210, hot",
  "Which follow-ups are overdue?",
  "Log a call with Acme — interested, and schedule a follow-up next Monday",
  "Show me my hot leads",
  "Book a virtual meeting with Acme tomorrow at 3pm",
];

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

export default function SalesAssistant() {
  const [messages, setMessages] = useState<SalesAiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [pendingIntent, setPendingIntent] = useState<Record<string, unknown> | null>(null);
  const [conversations, setConversations] = useState<SalesAiConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [doneTokens, setDoneTokens] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      setConversations(await salesAiApi.conversations());
    } catch {
      /* history is a convenience; a failure here is not worth a toast */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const startNew = () => {
    setMessages([]);
    setConversationId(null);
    setPendingIntent(null);
    setInput("");
  };

  const openConversation = async (id: number) => {
    try {
      const t = await salesAiApi.conversation(id);
      setConversationId(t.id);
      setPendingIntent(null);
      setMessages(
        t.messages.map((m) => ({
          id: `h${m.id}`,
          role: m.role,
          content: m.content,
          response: m.response ?? undefined,
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open that conversation");
    }
  };

  const removeConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await salesAiApi.removeConversation(id);
      if (conversationId === id) startNew();
      loadConversations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: message }]);
    setInput("");
    setSending(true);

    try {
      const res: SalesAiResponse = await salesAiApi.message({
        message,
        conversation_id: conversationId,
        pending_intent: pendingIntent,
      });

      if (res.conversation_id && res.conversation_id !== conversationId) {
        setConversationId(res.conversation_id);
        loadConversations();
      }
      setPendingIntent(res.pending_intent ?? null);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: res.message, response: res },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: e instanceof Error ? e.message : "The assistant is unavailable right now.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const confirmAction = async (token: string, preview: string) => {
    if (executing) return;
    setExecuting(token);
    try {
      const result = await salesAiApi.execute(token);
      setDoneTokens((prev) => new Set(prev).add(token));
      const link = result.link;
      toast.success(result.message || `${preview} — done.`, {
        action: link && link.route && link.label
          ? { label: link.label, onClick: () => navigate(link.route) }
          : undefined,
      });
      loadConversations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete that");
    } finally {
      setExecuting(null);
    }
  };

  return (
    <SalesLayout>
      <div className="flex h-[calc(100dvh-8rem)] gap-4">
        {/* History rail (desktop) */}
        <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border bg-card md:flex">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-semibold">Conversations</span>
            <Button size="sm" variant="ghost" onClick={startNew} className="h-8 gap-1">
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {loadingList ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : conversations.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No conversations yet.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                    conversationId === c.id && "bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{c.title || "Untitled"}</span>
                  {c.write_count > 0 && (
                    <span className="rounded bg-emerald-500/15 px-1.5 text-[10px] font-medium text-emerald-600">
                      {c.write_count}
                    </span>
                  )}
                  <Trash2
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => removeConversation(c.id, e)}
                  />
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Chat column */}
        <section className="flex min-w-0 flex-1 flex-col rounded-2xl border bg-card">
          <header className="flex items-center gap-2 border-b p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">Sales Assistant</h1>
              <p className="truncate text-xs text-muted-foreground">
                Ask anything, or tell me to add a lead, log a call, schedule a follow-up or meeting.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={startNew} className="ml-auto gap-1 md:hidden">
              <Plus className="h-4 w-4" /> New
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !sending && (
              <div className="mx-auto max-w-md space-y-4 py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="h-7 w-7" />
                </div>
                <p className="text-sm text-muted-foreground">
                  I can answer questions about your pipeline and do things for you. Try one of these:
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                executing={executing}
                doneTokens={doneTokens}
                onConfirm={confirmAction}
                onChoice={(value) => send(value)}
              />
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <footer className="border-t p-3">
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                placeholder="Message the Sales Assistant…"
                rows={1}
                className="max-h-32 min-h-[2.75rem] resize-none"
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()} className="h-11 w-11 shrink-0">
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
          </footer>
        </section>
      </div>
    </SalesLayout>
  );
}

function MessageBubble({
  message, executing, doneTokens, onConfirm, onChoice,
}: {
  message: SalesAiChatMessage;
  executing: string | null;
  doneTokens: Set<string>;
  onConfirm: (token: string, preview: string) => void;
  onChoice: (value: string) => void;
}) {
  const isUser = message.role === "user";
  const res = message.response;

  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        isUser ? "bg-muted" : "bg-primary/10 text-primary",
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className="min-w-0 max-w-[85%] space-y-2">
        {message.content && (
          <div className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          )}>
            {message.content}
          </div>
        )}

        {res?.type === "choices" && res.choices && (
          <div className="flex flex-wrap gap-2">
            {res.choices.map((c) => (
              <Button key={c.value} size="sm" variant="outline" onClick={() => onChoice(c.value)}>
                {c.label}
              </Button>
            ))}
          </div>
        )}

        {res?.type === "confirm" && res.token && (
          <ConfirmCard preview={res.preview || "Confirm this action"} token={res.token}
            executing={executing} done={doneTokens.has(res.token)} onConfirm={onConfirm} />
        )}

        {res?.type === "actions" && res.actions && (
          <div className="space-y-2">
            {res.actions.map((a) => (
              <ConfirmCard key={a.token} preview={a.preview} token={a.token}
                executing={executing} done={doneTokens.has(a.token)} onConfirm={onConfirm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmCard({
  preview, token, executing, done, onConfirm,
}: {
  preview: string;
  token: string;
  executing: string | null;
  done: boolean;
  onConfirm: (token: string, preview: string) => void;
}) {
  const busy = executing === token;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
      <span className="min-w-0 flex-1 truncate text-sm">{preview}</span>
      {done ? (
        <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
          <Check className="h-4 w-4" /> Done
        </span>
      ) : (
        <Button size="sm" disabled={busy || !!executing} onClick={() => onConfirm(token, preview)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
        </Button>
      )}
    </div>
  );
}
