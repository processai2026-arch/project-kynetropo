import { apiFetch } from "@/lib/api/client";
import type {
  SalesAiResponse,
  SalesAiExecuteResult,
  SalesAiConversation,
  SalesAiTranscript,
} from "@/types/salesAi";

/** The API returns `{ success, message, data }`. */
interface Envelope<T> { success: boolean; message?: string; data: T }

export const salesAiApi = {
  /**
   * Send a message and get a structured reply. `conversation_id` is the whole
   * thread — omit it on the first message and the server opens a new thread and
   * returns its id. `pending_intent` carries a half-collected action forward
   * when the assistant asked a follow-up question.
   */
  message: (payload: {
    message: string;
    conversation_id?: number | null;
    pending_intent?: Record<string, unknown> | null;
  }) =>
    apiFetch<Envelope<SalesAiResponse>>("/admin/sales-ai/message", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((r) => r.data),

  /** Run one confirmed action by its single-use token. */
  execute: (token: string) =>
    apiFetch<Envelope<SalesAiExecuteResult>>("/admin/sales-ai/execute", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((r) => r.data),

  /** This user's recent threads, newest first. */
  conversations: () =>
    apiFetch<Envelope<SalesAiConversation[]>>("/admin/sales-ai/conversations").then((r) => r.data),

  /** One thread, in full, to reopen it. */
  conversation: (id: number) =>
    apiFetch<Envelope<SalesAiTranscript>>(`/admin/sales-ai/conversations/${id}`).then((r) => r.data),

  /** Delete a thread. */
  removeConversation: (id: number) =>
    apiFetch<Envelope<{ message: string }>>(`/admin/sales-ai/conversations/${id}`, {
      method: "DELETE",
    }).then((r) => r.data),
};
