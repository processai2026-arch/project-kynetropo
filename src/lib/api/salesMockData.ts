/**
 * Sample data for the Sales module in mock mode (VITE_USE_MOCK_API=true), so its
 * screens — the phone app above all — can be opened and looked at without a server.
 * Shapes follow src/types/sales.ts; nothing here is used against the real API.
 */
import type {
  SalesChallenge, SalesDashboard, SalesFollowup, SalesLead, SalesMeeting, SalesMention, SalesTask,
} from "@/types/sales";

const d = (offset: number) => {
  const t = new Date();
  t.setDate(t.getDate() + offset);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
const NOW = `${d(0)} 10:30:00`;

const PERMISSIONS = [
  "sales.calls.create", "sales.calls.view", "sales.challenges.accept", "sales.challenges.complete", "sales.challenges.create",
  "sales.challenges.manage", "sales.challenges.view", "sales.comments.create", "sales.comments.view", "sales.dashboard.view",
  "sales.followups.complete", "sales.followups.create", "sales.followups.view", "sales.leads.assign", "sales.leads.convert",
  "sales.leads.create", "sales.leads.edit", "sales.leads.view", "sales.leads.view_all", "sales.meetings.create",
  "sales.meetings.edit", "sales.meetings.view", "sales.reports.view", "sales.tasks.complete", "sales.tasks.create",
  "sales.tasks.manage", "sales.tasks.view",
];

const lead = (id: number, company: string, person: string, phone: string, status: SalesLead["status"],
  temperature: SalesLead["temperature"], next: string | null, owner = "Naresh"): SalesLead => ({
  id, lead_code: `L-${String(id).padStart(4, "0")}`, name: person, company, contact_person: person, phone, email: "",
  source: "Referral", assigned_to: 1, assigned_to_name: owner, status, temperature, next_followup_at: next,
  next_meeting_at: null, last_activity_at: `${d(-1)} 16:10:00`, last_outcome: "interested", notes: null, acquired_on: d(-20),
  current_software: "Tally", switch_reason: null, converted_client_id: null, converted_project_id: null, converted_at: null,
  created_at: `${d(-20)} 09:00:00`, updated_at: null,
});

const LEADS: SalesLead[] = [
  lead(1, "Sri Murugan Textiles", "Murugan S", "9840011122", "qualified", "hot", `${d(0)} 11:00:00`),
  lead(2, "Anbu Hardware", "Anbu R", "9840033344", "contacted", "warm", `${d(0)} 15:30:00`, "Kaushik"),
  lead(3, "Kaveri Rice Mill", "Selvam K", "9840055566", "proposal", "hot", `${d(-1)} 12:00:00`),
  lead(4, "Lakshmi Jewellers", "Lakshmi P", "9840077788", "new", "cold", null, "Karthi"),
  lead(5, "Green Agro Pellets", "Ravi M", "9840099900", "meeting_scheduled", "warm", `${d(2)} 10:00:00`),
];

const followup = (id: number, l: SalesLead, due: string, time: string | null, purpose: string): SalesFollowup => ({
  id, lead_id: l.id, client_id: null, subject_type: "lead", subject_name: l.company, subject_phone: l.phone,
  lead_name: l.name, lead_company: l.company, lead_phone: l.phone, lead_contact_person: l.contact_person,
  lead_temperature: l.temperature, lead_last_outcome: "interested", call_id: null, meeting_id: null,
  due_date: due, due_time: time, assigned_to: 1, assigned_to_name: l.assigned_to_name, status: "pending", purpose,
  outcome: "", outcome_notes: null, completed_by: null, completed_at: null, comment_count: 0, created_at: `${d(-3)} 09:00:00`,
});

const FOLLOWUPS = {
  today: [followup(1, LEADS[0], d(0), "11:00:00", "Share the demo login"), followup(2, LEADS[1], d(0), "15:30:00", "Price follow-up")],
  overdue: [followup(3, LEADS[2], d(-1), "12:00:00", "Proposal decision")],
  upcoming: [followup(4, LEADS[4], d(2), "10:00:00", "Confirm meeting")],
};

const MEETINGS: SalesMeeting[] = [{
  id: 1, lead_id: 5, lead_name: "Ravi M", lead_company: "Green Agro Pellets", lead_temperature: "warm", title: "ERP demo",
  meeting_type: "physical", meeting_date: d(0), meeting_time: "16:00:00", place: "Kanchipuram office", meeting_link: "",
  participants: null, notes: null, status: "scheduled", outcome: "", outcome_notes: null, requirements: null, decisions: null,
  next_action: null, next_meeting_date: null, assigned_to: 1, assigned_to_name: "Naresh", completed_at: null, comment_count: 0,
  created_at: `${d(-2)} 09:00:00`, updated_at: null,
}];

const task = (id: number, title: string, due: string, priority: SalesTask["priority"], status: SalesTask["status"]): SalesTask => ({
  id, task_code: `T-${String(id).padStart(4, "0")}`, title, description: null, assigned_to: 1, assigned_to_name: "Naresh",
  assigned_by: 2, assigned_by_name: "Kaushik", lead_id: 1, lead_name: "Murugan S", lead_company: "Sri Murugan Textiles",
  due_date: due, due_time: null, priority, status, started_at: null, completed_at: null, completed_by: null,
  completion_notes: null, reviewed_at: null, reviewed_by: null, cancelled_at: null, created_at: `${d(-2)} 09:00:00`,
  updated_at: null, comment_count: 1, is_overdue: due < d(0), is_live: status === "in_progress", is_assignee: true,
  is_assigner: false, can_start: status === "open", can_complete: status !== "completed", can_edit: true, can_cancel: true,
  can_restore: false, can_reopen: false, can_acknowledge: false,
});
const TASKS = [
  task(1, "Send revised quotation", d(0), "high", "open"),
  task(2, "Collect GST certificate", d(-1), "normal", "in_progress"),
  task(3, "Plan Kaveri onboarding", d(3), "low", "open"),
];
const TASK_COUNTS = { mine: 3, given: 1, team: 4, live: 1, overdue: 1, completed: 5, cancelled: 0 };

const CHALLENGES: SalesChallenge[] = [{
  id: 1, challenge_code: "CH-0001", title: "Close Kaveri Rice Mill this week", description: "Get the signed proposal.",
  lead_id: 3, lead_name: "Selvam K", lead_company: "Kaveri Rice Mill", client_id: null, deadline: `${d(3)} 18:00:00`,
  priority: "high", status: "available", accepted_by: null, accepted_by_name: null, accepted_at: null, started_at: null,
  completed_by: null, completed_by_name: null, completed_at: null, completion_notes: null, expired_at: null, created_by: 2,
  created_by_name: "Kaushik", created_at: `${d(-1)} 09:00:00`, updated_at: null, server_time: NOW, seconds_remaining: 3 * 86400,
  is_expired: false, is_actionable: true, is_offered_to_me: true, i_created_it: false, can_accept: true,
}];
const CHALLENGE_COUNTS = { available: 1, accepted: 0, in_progress: 0, completed: 2, expired: 0 };

const MENTIONS: SalesMention[] = [{
  comment_id: 1, entity_type: "lead", entity_id: 1, body: "@Naresh can you share the demo today?", author_id: 2,
  author_name: "Kaushik", created_at: `${d(0)} 09:15:00`, edited_at: null, read_at: null, where: "Sri Murugan Textiles",
  url: "/sales/leads/1", lead_id: 1,
}];

const DASHBOARD: SalesDashboard = {
  server_time: NOW,
  summary: {
    total_leads: 5, hot: 2, warm: 2, cold: 1, converted: 3, followups_today: 2, followups_overdue: 1, followups_upcoming: 1,
    meetings_today: 1, meetings_upcoming: 0, active_challenges: 1, tasks_mine: 3, tasks_given: 1, tasks_overdue: 1,
  },
  followups: FOLLOWUPS,
  meetings: { today: MEETINGS, upcoming: [] },
  hot_leads: LEADS.filter((l) => l.temperature === "hot"),
  tasks: { counts: TASK_COUNTS, mine: TASKS, given: [] },
  challenges: { counts: CHALLENGE_COUNTS, active: [], available: CHALLENGES },
};

const page = (n: number) => ({ page: 1, limit: 50, total: n, total_pages: 1 });

export function getSalesMock(url: string, method: string, query: URLSearchParams): unknown {
  const ok = (data: unknown) => ({ success: true, data });
  if (method !== "GET") return ok({});

  if (url === "/admin/sales/me") {
    return ok({ user_id: 1, name: "Naresh", email: "admin@project.com", staff_role: "admin", is_admin: true,
      permissions: PERMISSIONS, server_time: NOW, lockout: null });
  }
  if (url === "/admin/sales/dashboard") return ok(DASHBOARD);
  if (url === "/admin/sales/notifications") return ok({ server_time: NOW, items: [] });
  if (url === "/admin/sales/feed") return ok({ server_time: NOW, items: [] });
  if (url === "/admin/sales/assignable-users") return ok([{ user_id: 1, name: "Naresh" }, { user_id: 2, name: "Kaushik" }, { user_id: 3, name: "Karthi" }]);
  if (url === "/admin/sales/leads") {
    const status = query.get("status");
    const rows = status === "converted" ? [] : LEADS;
    return { success: true, data: rows, pagination: page(rows.length) };
  }
  const leadMatch = url.match(/^\/admin\/sales\/leads\/(\d+)$/);
  if (leadMatch) {
    const l = LEADS.find((x) => x.id === Number(leadMatch[1])) ?? LEADS[0];
    return ok({ ...l, calls: [], followups: FOLLOWUPS.today.filter((f) => f.lead_id === l.id), meetings: [], timeline: [], comments: [], comment_counts: {} });
  }
  if (url === "/admin/sales/followups") {
    const bucket = (query.get("bucket") || "today") as keyof typeof FOLLOWUPS | "completed";
    const items = bucket === "completed" ? [] : FOLLOWUPS[bucket] ?? [];
    return ok({ items, pagination: page(items.length), counts: { today: 2, overdue: 1, upcoming: 1, completed: 4 } });
  }
  if (url === "/admin/sales/meetings") return ok({ items: MEETINGS, pagination: page(1), counts: { today: 1, upcoming: 0 } });
  if (url === "/admin/sales/tasks") return ok({ items: TASKS, pagination: page(TASKS.length), counts: TASK_COUNTS, can_manage: true, me: 1 });
  if (url === "/admin/sales/challenges") return ok({ items: CHALLENGES, pagination: page(1), counts: CHALLENGE_COUNTS, server_time: NOW, can_manage: true });
  if (url === "/admin/sales/mentions") return ok({ items: MENTIONS, unread: 1 });
  if (url === "/admin/sales/calls") return { success: true, data: [], pagination: page(0) };
  if (url === "/admin/sales/calls/meta") return ok({ outcomes: [], temperatures: ["hot", "warm", "cold"] });
  if (url === "/admin/sales/activity") return ok([]);
  return ok([]);
}
