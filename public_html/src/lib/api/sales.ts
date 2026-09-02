import { apiFetch } from "@/lib/api/client";
import type {
  ChallengeCounts,
  CommentEntityType,
  FollowupBucket,
  LeadCallSummary,
  Pagination,
  SalesAccessUser,
  SalesActivityEntry,
  SalesCall,
  SalesChallenge,
  SalesChallengeDetail,
  SalesComment,
  SalesDashboard,
  SalesFeedEvent,
  SalesFollowup,
  SalesLead,
  SalesLeadDetail,
  SalesLockoutInfo,
  SalesMe,
  SalesMeeting,
  SalesMention,
  SalesTask,
  SalesTaskDetail,
  TaskBucket,
  TaskCounts,
  TaskStatus,
} from "@/types/sales";

/** The API returns `{ success, message, data }`; paginated lists add `pagination`. */
interface Envelope<T> { success: boolean; message?: string; data: T }
interface Paginated<T> { success: boolean; data: T[]; pagination: Pagination }

type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * The colleague whose work is being read, or null for your own.
 *
 * A module variable rather than an argument on ninety call sites: every read in
 * this file has to carry it, and one that forgets would quietly show the wrong
 * person's data. Writes never carry it — the server refuses a write that does,
 * so a mistake here surfaces immediately instead of acting as somebody else.
 */
let viewAsUserId: number | null = null;

export function setSalesViewAs(userId: number | null): void {
  viewAsUserId = userId && userId > 0 ? userId : null;
}

export function getSalesViewAs(): number | null {
  return viewAsUserId;
}

function qs(params: QueryParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") search.set(k, String(v));
  });
  if (viewAsUserId !== null) search.set("view_as", String(viewAsUserId));
  const s = search.toString();
  return s ? `?${s}` : "";
}

/** Appends the selection to a read that takes no other query parameters. */
function viewAsQs(existing = ""): string {
  if (viewAsUserId === null) return existing;
  return existing ? `${existing}&view_as=${viewAsUserId}` : `?view_as=${viewAsUserId}`;
}

// ─── Access ───────────────────────────────────────────────────────────────────

export const salesAccessApi = {
  me: async (): Promise<SalesMe> => (await apiFetch<Envelope<SalesMe>>("/admin/sales/me")).data,
  users: async (): Promise<SalesAccessUser[]> =>
    (await apiFetch<Envelope<SalesAccessUser[]>>("/admin/sales/users")).data,
  permissionCatalog: async (): Promise<{ catalog: Record<string, string[]>; all: string[]; admin_only: string[] }> =>
    (await apiFetch<Envelope<{ catalog: Record<string, string[]>; all: string[]; admin_only: string[] }>>(
      "/admin/sales/permissions",
    )).data,
  setPermissions: async (userId: number, permissions: string[]) =>
    (await apiFetch<Envelope<{ user_id: number; granted: string[]; permissions: string[] }>>(
      `/admin/sales/users/${userId}/permissions`,
      { method: "PUT", body: JSON.stringify({ permissions }) },
    )).data,
  createUser: async (body: {
    name: string;
    email: string;
    phone: string;
    password: string;
    staff_role?: string;
    permissions?: string[];
  }) =>
    (await apiFetch<Envelope<{ user_id: number; name: string; email: string; staff_role: string; permissions: string[] }>>(
      "/admin/sales/users",
      { method: "POST", body: JSON.stringify(body) },
    )).data,
  setRole: async (userId: number, staff_role: string) =>
    (await apiFetch<Envelope<{ user_id: number; staff_role: string; permissions: string[] }>>(
      `/admin/sales/users/${userId}/role`,
      { method: "PUT", body: JSON.stringify({ staff_role }) },
    )).data,
  lockouts: async (): Promise<SalesLockoutInfo[]> =>
    (await apiFetch<Envelope<SalesLockoutInfo[]>>("/admin/sales/lockouts", { skipCache: true })).data,
  restoreAccess: async (userId: number) =>
    (await apiFetch<Envelope<{ user_id: number; name: string | null }>>(
      `/admin/sales/users/${userId}/restore-access`,
      { method: "POST" },
    )).data,
  setPassword: async (userId: number, password: string) =>
    (await apiFetch<Envelope<{ user_id: number; email: string | null }>>(
      `/admin/sales/users/${userId}/password`,
      { method: "PUT", body: JSON.stringify({ password }) },
    )).data,
  setActive: async (userId: number, is_active: boolean) =>
    (await apiFetch<Envelope<{ user_id: number; is_active: boolean }>>(
      `/admin/sales/users/${userId}/active`,
      { method: "PUT", body: JSON.stringify({ is_active }) },
    )).data,
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface SalesNotification {
  key: string;
  type:
    | "followup_due"
    | "followup_overdue"
    | "meeting_soon"
    | "challenge_available"
    | "challenge_ending"
    | "challenge_expired"
    | "challenge_completed"
    | "task_due"
    | "task_overdue"
    | "task_completed"
    | "mention"
    | "comment_added";
  severity: "normal" | "urgent";
  title: string;
  body: string;
  url: string;
  at: string;
}

export const salesDashboardApi = {
  get: async (): Promise<SalesDashboard> =>
    (await apiFetch<Envelope<SalesDashboard>>(`/admin/sales/dashboard${viewAsQs()}`, { skipCache: true })).data,
  activity: async (limit = 50): Promise<SalesActivityEntry[]> =>
    (await apiFetch<Envelope<SalesActivityEntry[]>>(
      `/admin/sales/activity${viewAsQs(`?limit=${limit}`)}`,
    )).data,
  notifications: async (): Promise<{ server_time: string; items: SalesNotification[] }> =>
    (await apiFetch<Envelope<{ server_time: string; items: SalesNotification[] }>>(
      "/admin/sales/notifications",
      { skipCache: true },
    )).data,
  assignableUsers: async (): Promise<{ user_id: number; name: string; email?: string }[]> =>
    (await apiFetch<Envelope<{ user_id: number; name: string }[]>>("/admin/sales/assignable-users")).data,
  /**
   * The merged live feed. Pass the previous response's `server_time` as `since`
   * to fetch only what has happened since — that is what makes polling cheap
   * enough to run continuously on the desktop.
   */
  feed: async (opts: { limit?: number; since?: string } = {}): Promise<{
    server_time: string;
    items: SalesFeedEvent[];
  }> =>
    (await apiFetch<Envelope<{ server_time: string; items: SalesFeedEvent[] }>>(
      `/admin/sales/feed${qs({ limit: opts.limit, since: opts.since })}`,
      { skipCache: true },
    )).data,
};

// ─── Comments ─────────────────────────────────────────────────────────────────

export const salesCommentsApi = {
  list: async (entity_type: CommentEntityType, entity_id: number): Promise<SalesComment[]> =>
    (await apiFetch<Envelope<{ items: SalesComment[] }>>(
      `/admin/sales/comments${qs({ entity_type, entity_id })}`,
      { skipCache: true },
    )).data.items,
  /**
   * `mentions` carries the user ids the @ picker matched. The server re-checks
   * every one of them — a mention is a notification, so it is never taken on
   * the client's word alone.
   */
  create: async (
    entity_type: CommentEntityType,
    entity_id: number,
    body: string,
    mentions: number[] = [],
  ): Promise<SalesComment | null> =>
    (await apiFetch<Envelope<{ comment: SalesComment | null }>>("/admin/sales/comments", {
      method: "POST",
      body: JSON.stringify({ entity_type, entity_id, body, mentions }),
    })).data.comment,
  update: async (id: number, body: string, mentions: number[] = []): Promise<SalesComment | null> =>
    (await apiFetch<Envelope<{ comment: SalesComment | null }>>(`/admin/sales/comments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ body, mentions }),
    })).data.comment,
  remove: (id: number) => apiFetch<Envelope<{ id: number }>>(`/admin/sales/comments/${id}`, { method: "DELETE" }),
  restore: async (id: number): Promise<SalesComment | null> =>
    (await apiFetch<Envelope<{ comment: SalesComment | null }>>(`/admin/sales/comments/${id}/restore`, {
      method: "POST",
    })).data.comment,
};

// ─── Leads ────────────────────────────────────────────────────────────────────

// A type alias (not an interface) so it carries an implicit index signature and
// can be passed straight to qs().
export type LeadFilters = {
  search?: string;
  temperature?: string;
  status?: string;
  assigned_to?: number | string;
  source?: string;
  followup_from?: string;
  followup_to?: string;
  created_from?: string;
  created_to?: string;
  page?: number;
  limit?: number;
};

/**
 * What the conversion dialog collects. Everything is optional: leaving a field
 * out keeps whatever the lead already knows, so a quick conversion still works.
 */
export interface ConvertLeadBody {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  owner?: string;
  stage?: string;
  health?: "green" | "yellow" | "red";
  notes?: string;
  /** Link to a customer that already exists instead of creating one. */
  link_client_id?: number;
  /** Insist on a new customer even when phone/email match an existing one. */
  create_new?: boolean;
  /** Naming a project opens it against the new customer in the same step. */
  project_name?: string;
  project_quoted?: number;
  project_deadline?: string;
  project_priority?: "low" | "medium" | "high" | "critical";
}

export const salesLeadsApi = {
  list: (filters: LeadFilters = {}) =>
    apiFetch<Paginated<SalesLead>>(`/admin/sales/leads${qs(filters)}`),
  get: async (id: number): Promise<SalesLeadDetail> =>
    (await apiFetch<Envelope<SalesLeadDetail>>(`/admin/sales/leads/${id}${viewAsQs()}`, { skipCache: true })).data,
  create: async (body: Partial<SalesLead>): Promise<SalesLead> =>
    (await apiFetch<Envelope<SalesLead>>("/admin/sales/leads", { method: "POST", body: JSON.stringify(body) })).data,
  update: async (id: number, body: Partial<SalesLead>): Promise<SalesLead> =>
    (await apiFetch<Envelope<SalesLead>>(`/admin/sales/leads/${id}`, { method: "PUT", body: JSON.stringify(body) })).data,
  setTemperature: async (id: number, temperature: string): Promise<SalesLead> =>
    (await apiFetch<Envelope<SalesLead>>(`/admin/sales/leads/${id}/temperature`, {
      method: "PUT",
      body: JSON.stringify({ temperature }),
    })).data,
  assign: async (id: number, assigned_to: number | null): Promise<SalesLead> =>
    (await apiFetch<Envelope<SalesLead>>(`/admin/sales/leads/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify({ assigned_to }),
    })).data,
  startOnboarding: async (id: number, notes?: string): Promise<SalesLead> =>
    (await apiFetch<Envelope<SalesLead>>(`/admin/sales/leads/${id}/onboarding`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    })).data,
  convert: async (id: number, body: ConvertLeadBody = {}) =>
    (await apiFetch<Envelope<{
      lead_id: number;
      client_id: number;
      project_id: number | null;
      reused_existing_client: boolean;
    }>>(`/admin/sales/leads/${id}/convert`, { method: "POST", body: JSON.stringify(body) })).data,
  /**
   * Steps a lead back out of conversion or onboarding.
   *
   * Undoing a conversion removes the customer record it created from the CRM.
   * When it cannot — the customer already existed, or has real work attached
   * now — `kept_customer_id` and `kept_reason` say so, and the UI repeats the
   * reason rather than claiming a clean undo.
   */
  revert: async (id: number, reason?: string) =>
    (await apiFetch<Envelope<{
      lead: SalesLead;
      removed_client_id?: number | null;
      removed_project_id?: number | null;
      kept_customer_id?: number | null;
      kept_reason?: string | null;
    }>>(
      `/admin/sales/leads/${id}/revert`,
      { method: "POST", body: JSON.stringify({ reason }) },
    )).data,
  remove: (id: number) => apiFetch<Envelope<null>>(`/admin/sales/leads/${id}`, { method: "DELETE" }),
};

// ─── Calls ────────────────────────────────────────────────────────────────────

export interface LogCallPayload {
  lead_id: number;
  call_date: string;
  call_time?: string;
  duration_minutes?: number;
  outcome: string;
  notes?: string;
  temperature_after?: string;
  next_followup_date?: string;
  next_followup_time?: string;
  next_followup_purpose?: string;
}

export const salesCallsApi = {
  /** Call history collapsed to one entry per lead. */
  byLead: async (): Promise<LeadCallSummary[]> =>
    (await apiFetch<Envelope<{ items: LeadCallSummary[] }>>(
      `/admin/sales/calls/leads${viewAsQs()}`,
      { skipCache: true },
    )).data.items ?? [],
  list: (
    filters: { lead_id?: number; outcome?: string; date_from?: string; date_to?: string; page?: number; limit?: number } = {},
  ) =>
    apiFetch<Paginated<SalesCall>>(`/admin/sales/calls${qs(filters)}`),
  meta: async (): Promise<{ outcomes: string[]; temperatures: string[] }> =>
    (await apiFetch<Envelope<{ outcomes: string[]; temperatures: string[] }>>("/admin/sales/calls/meta")).data,
  log: async (body: LogCallPayload) =>
    (await apiFetch<Envelope<{ call: SalesCall | null; followup_id: number | null; lead: SalesLead }>>(
      "/admin/sales/calls",
      { method: "POST", body: JSON.stringify(body) },
    )).data,
};

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export interface FollowupListResult {
  items: SalesFollowup[];
  pagination: Pagination;
  counts: Record<FollowupBucket, number>;
}

export const salesFollowupsApi = {
  list: async (bucket: FollowupBucket | "" = "", extra: { lead_id?: number } = {}): Promise<FollowupListResult> =>
    (await apiFetch<Envelope<FollowupListResult>>(
      `/admin/sales/followups${qs({ bucket, ...extra })}`,
      { skipCache: true },
    )).data,
  create: async (body: { lead_id: number; due_date: string; due_time?: string; purpose?: string }) =>
    (await apiFetch<Envelope<{ id: number; lead: SalesLead }>>("/admin/sales/followups", {
      method: "POST",
      body: JSON.stringify(body),
    })).data,
  /**
   * Editing is the owner's alone, and `edit_reason` is required — the team is
   * shown why a follow-up moved, so a reschedule can never pass for a miss.
   */
  update: async (
    id: number,
    body: { due_date?: string; due_time?: string; purpose?: string; edit_reason: string },
  ) =>
    (await apiFetch<Envelope<{ followup: SalesFollowup | null }>>(`/admin/sales/followups/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })).data,
  complete: async (
    id: number,
    body: {
      outcome_notes?: string;
      next_followup_date?: string;
      next_followup_time?: string;
      next_followup_purpose?: string;
    } = {},
  ) =>
    (await apiFetch<Envelope<{ next_followup_id: number | null }>>(`/admin/sales/followups/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(body),
    })).data,
  cancel: (id: number) => apiFetch<Envelope<null>>(`/admin/sales/followups/${id}/cancel`, { method: "POST" }),
};

// ─── Meetings ─────────────────────────────────────────────────────────────────

export interface MeetingListResult {
  items: SalesMeeting[];
  pagination: Pagination;
  counts: { today: number; upcoming: number };
}

export interface ScheduleMeetingPayload {
  lead_id: number;
  title: string;
  meeting_type: string;
  meeting_date: string;
  meeting_time?: string;
  place?: string;
  meeting_link?: string;
  participants?: string;
  notes?: string;
}

export const salesMeetingsApi = {
  list: async (
    filters: { status?: string; meeting_type?: string; lead_id?: number; date_from?: string; date_to?: string } = {},
  ): Promise<MeetingListResult> =>
    (await apiFetch<Envelope<MeetingListResult>>(`/admin/sales/meetings${qs(filters)}`, {
      skipCache: true,
    })).data,
  get: async (id: number): Promise<SalesMeeting> =>
    (await apiFetch<Envelope<SalesMeeting>>(`/admin/sales/meetings/${id}${viewAsQs()}`)).data,
  create: async (body: ScheduleMeetingPayload): Promise<SalesMeeting> =>
    (await apiFetch<Envelope<SalesMeeting>>("/admin/sales/meetings", { method: "POST", body: JSON.stringify(body) })).data,
  update: async (id: number, body: Partial<ScheduleMeetingPayload>): Promise<SalesMeeting> =>
    (await apiFetch<Envelope<SalesMeeting>>(`/admin/sales/meetings/${id}`, { method: "PUT", body: JSON.stringify(body) })).data,
  complete: async (
    id: number,
    body: {
      outcome: string;
      outcome_notes?: string;
      requirements?: string;
      decisions?: string;
      next_action?: string;
      next_meeting_date?: string;
      next_meeting_time?: string;
      next_followup_date?: string;
      next_followup_time?: string;
    },
  ) =>
    (await apiFetch<Envelope<{ next_meeting_id: number | null; next_followup_id: number | null }>>(
      `/admin/sales/meetings/${id}/complete`,
      { method: "POST", body: JSON.stringify(body) },
    )).data,
  cancel: (id: number, reason?: string) =>
    apiFetch<Envelope<null>>(`/admin/sales/meetings/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? "" }),
    }),
};

// ─── Mentions ─────────────────────────────────────────────────────────────────

export interface MentionListResult {
  items: SalesMention[];
  unread: number;
}

export const salesMentionsApi = {
  list: async (opts: { unread?: boolean; limit?: number } = {}): Promise<MentionListResult> =>
    (await apiFetch<Envelope<MentionListResult>>(
      `/admin/sales/mentions${qs({ unread: opts.unread ? 1 : undefined, limit: opts.limit })}`,
      { skipCache: true },
    )).data,
  /** Omit the ids to mark everything read. */
  markRead: async (commentIds?: number[]): Promise<{ unread: number }> =>
    (await apiFetch<Envelope<{ unread: number }>>("/admin/sales/mentions/read", {
      method: "POST",
      body: JSON.stringify(commentIds ? { comment_ids: commentIds } : {}),
    })).data,
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface TaskListResult {
  items: SalesTask[];
  pagination: Pagination;
  counts: TaskCounts;
  can_manage: boolean;
  me: number;
}

export interface TaskPayload {
  title: string;
  description?: string;
  assigned_to: number;
  due_date?: string;
  due_time?: string;
  priority?: string;
  lead_id?: number | null;
}

export const salesTasksApi = {
  list: async (
    filters: { bucket?: TaskBucket | ""; status?: TaskStatus | ""; search?: string; lead_id?: number } = {},
  ): Promise<TaskListResult> =>
    (await apiFetch<Envelope<TaskListResult>>(`/admin/sales/tasks${qs(filters)}`, { skipCache: true })).data,
  get: async (id: number): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}${viewAsQs()}`, { skipCache: true })).data,
  create: async (body: TaskPayload): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>("/admin/sales/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    })).data,
  update: async (id: number, body: Partial<TaskPayload>): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })).data,
  start: async (id: number): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}/start`, { method: "POST" })).data,
  complete: async (id: number, completion_notes?: string): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ completion_notes }),
    })).data,
  /** The assigner hands it back — the reason is the message to the assignee. */
  reopen: async (id: number, reason?: string): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}/reopen`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })).data,
  acknowledge: async (id: number): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}/acknowledge`, { method: "POST" })).data,
  cancel: async (id: number, reason?: string): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })).data,
  restore: async (id: number): Promise<SalesTaskDetail> =>
    (await apiFetch<Envelope<SalesTaskDetail>>(`/admin/sales/tasks/${id}/restore`, { method: "POST" })).data,
};

// ─── Challenges ───────────────────────────────────────────────────────────────

export interface ChallengeListResult {
  items: SalesChallenge[];
  pagination: Pagination;
  counts: ChallengeCounts;
  server_time: string;
  can_manage: boolean;
}

export const salesChallengesApi = {
  list: async (status = ""): Promise<ChallengeListResult> =>
    (await apiFetch<Envelope<ChallengeListResult>>(`/admin/sales/challenges${qs({ status })}`, { skipCache: true })).data,
  get: async (id: number): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>(
      `/admin/sales/challenges/${id}${viewAsQs()}`,
      { skipCache: true },
    )).data,
  create: async (body: {
    title: string;
    description?: string;
    deadline: string;
    priority?: string;
    lead_id?: number | null;
    assignees?: number[];
  }): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>("/admin/sales/challenges", {
      method: "POST",
      body: JSON.stringify(body),
    })).data,
  update: async (id: number, body: Record<string, unknown>): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>(`/admin/sales/challenges/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })).data,
  accept: async (id: number): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>(`/admin/sales/challenges/${id}/accept`, { method: "POST" })).data,
  start: async (id: number): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>(`/admin/sales/challenges/${id}/start`, { method: "POST" })).data,
  complete: async (id: number, completion_notes?: string): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>(`/admin/sales/challenges/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ completion_notes }),
    })).data,
  expire: async (id: number): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>(`/admin/sales/challenges/${id}/expire`, { method: "POST" })).data,
  cancel: async (id: number): Promise<SalesChallengeDetail> =>
    (await apiFetch<Envelope<SalesChallengeDetail>>(`/admin/sales/challenges/${id}/cancel`, { method: "POST" })).data,
};
