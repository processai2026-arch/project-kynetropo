/**
 * Types for the Sales AI assistant.
 *
 * The server replies with one of a small set of shapes. `read` is resolved
 * entirely server-side and never reaches the client; it is listed so the union
 * matches the contract rather than only what usually arrives.
 */

export interface SalesAiChoice {
  label: string;
  value: string;
}

/** One proposed write, armed with a single-use confirm token. */
export interface SalesAiActionCard {
  preview: string;
  token: string;
  intent: { method: string; path: string; body: Record<string, unknown> };
}

/** Where to go and verify what was just saved. */
export interface SalesAiLink {
  label: string;
  /** A frontend route, e.g. "/sales/leads/5". */
  route: string;
}

export type SalesAiResponseType =
  | "text"
  | "question"
  | "choices"
  | "confirm"
  | "actions"
  | "read";

export interface SalesAiResponse {
  type: SalesAiResponseType;
  message: string;
  /** confirm: one-line summary the user approves. */
  preview?: string;
  /** confirm: the single-use token to execute. */
  token?: string;
  /** confirm: the proposed call, shown for transparency. */
  intent?: { method: string; path: string; body: Record<string, unknown> };
  /** actions: several confirm cards from one prompt. */
  actions?: SalesAiActionCard[];
  /** choices: pick one. */
  choices?: SalesAiChoice[];
  /** question/choices: send back on the next message to continue. */
  pending_intent?: Record<string, unknown> | null;
  /** The thread this reply belongs to. Send it back to continue the thread. */
  conversation_id?: number;
}

/** The result of confirming one action. */
export interface SalesAiExecuteResult {
  message: string;
  conversation_id: number | null;
  link?: SalesAiLink;
  refresh?: boolean;
}

/** One past thread, as it appears in the history list. */
export interface SalesAiConversation {
  id: number;
  title: string;
  message_count: number;
  /** How many writes this thread actually made. 0 = it only asked things. */
  write_count: number;
  last_message_at: string;
  created_at: string;
}

/** A thread reopened in full. */
export interface SalesAiTranscript extends Omit<SalesAiConversation, "last_message_at"> {
  messages: {
    id: number;
    role: "user" | "assistant";
    content: string;
    response: SalesAiResponse | null;
    created_at: string;
  }[];
}

/** A message as rendered in the chat window. */
export interface SalesAiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: SalesAiResponse;
}
