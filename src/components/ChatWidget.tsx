import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, Sparkles, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatContext } from "@/contexts/ChatContext";
import { chatApi } from "@/lib/api/chat";
import { getCompanyProfile } from "@/lib/companyProfile";

interface Msg { role: "user" | "assistant"; content: string; }

const SESSION_KEY  = "erp_chat_session";
/** Where the old draggable widget saved its position; cleared on load. */
const OLD_POS_KEY  = "erp_chat_pos";

const GREETING: Msg = {
  role: "assistant",
  content: "Hi! I'm your assistant. Ask me anything about our products, services, or policies.",
};

export function ChatWidget() {
  const [open, setOpen]           = useState(false);
  const [input, setInput]         = useState("");
  const [busy, setBusy]           = useState(false);
  const [messages, setMessages]   = useState<Msg[]>([GREETING]);
  const [sessionId, setSessionId] = useState<string>(
    () => localStorage.getItem(SESSION_KEY) ?? ""
  );
  const { current } = useChatContext();
  const scrollRef   = useRef<HTMLDivElement>(null);

  // The widget stays pinned to the bottom-right corner; it used to be draggable
  // and remembered where it was left, which is dropped here.
  useEffect(() => {
    try { localStorage.removeItem(OLD_POS_KEY); } catch { /* storage blocked */ }
  }, []);

  // ─── Chat logic ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || messages.length > 1) return;
    const sid = localStorage.getItem(SESSION_KEY);
    if (!sid) return;
    chatApi.history(sid).then((history) => {
      if (history.length > 0) setMessages([GREETING, ...history]);
    }).catch(() => {});
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await chatApi.send(text, sessionId || undefined);
      if (res.session_id && res.session_id !== sessionId) {
        setSessionId(res.session_id);
        localStorage.setItem(SESSION_KEY, res.session_id);
      }
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't reach the server. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    // Above the floating table scrollbar (fixed at bottom: 6px, 16px tall).
    <div className="fixed bottom-8 right-5 z-[9999]">
      {/* Launcher button (closed state) */}
      {!open && (
        <button
          type="button"
          aria-label="Open assistant"
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6 pointer-events-none" />
        </button>
      )}

      {/* Chat panel (open state) */}
      {open && (
        <div className="w-[min(400px,calc(100vw-2rem))] h-[min(600px,calc(100vh-3rem))] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground select-none">
            <div className="flex items-center gap-2 pointer-events-none">
              <Sparkles className="h-5 w-5" />
              <div>
                <p className="font-semibold text-sm leading-tight">Ask {getCompanyProfile().name}</p>
                <p className="text-[11px] text-primary-foreground/80 leading-tight">
                  {current?.page ? `Context: ${current.page}` : "Powered by Groq AI"}
                </p>
              </div>
            </div>
            <Button
              size="icon" variant="ghost"
              className="h-8 w-8 text-primary-foreground hover:bg-white/10"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={send} className="border-t p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, pricing, services…"
              disabled={busy}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
