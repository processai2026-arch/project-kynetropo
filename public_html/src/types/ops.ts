// ─── Kynetropo Ops — TypeScript Types ────────────────────────────────────────

export interface OpsClient {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  source_pitch_id: number | null;
  owner: string;
  health: "green" | "yellow" | "red";
  stage: string;
  notes: string | null;
  /** What they ran before us, and why they moved. Both optional. */
  current_software: string;
  switch_reason: string | null;
  project_name: string | null;
  project_id: number | null;
  balance_due: number | null;
  days_since_contact: number | null;
  next_followup: string | null;
  created_at: string;
}

export interface OpsClientDetail extends OpsClient {
  project: OpsProject | null;
  stage_history: OpsProjectStage[];
  timeline: OpsActivityEntry[];
  payments: OpsPayment[];
  meetings: OpsMeeting[];
  bugs: OpsBug[];
  checklist: OpsChecklistItem[];
}

export interface OpsProject {
  id: number;
  client_id: number;
  client_name: string | null;
  name: string;
  stage: string;
  owner: string;
  start_date: string | null;
  deadline: string | null;
  health: "green" | "yellow" | "red";
  priority: "low" | "medium" | "high" | "critical";
  quoted: number;
  received: number;
  balance: number;
  payment_status: "pending" | "partial" | "paid" | "overdue";
  next_collection_trigger: string | null;
  collection_target_date: string | null;
  current_work: string | null;
  current_work_due: string | null;
  next_action: string | null;
  next_action_due: string | null;
  next_deadline: string | null;
  founder_note: string | null;
  blocker: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsProjectStage {
  id: number;
  project_id: number;
  stage_name: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
}

export interface OpsActivityEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  description: string | null;
  done_by: string;
  created_at: string;
  comments?: string | null;
}

export interface OpsChecklistItem {
  id: number;
  client_id: number;
  item_name: string;
  is_done: number;
  completed_date: string | null;
  file_path: string | null;
  completed_by: string | null;
}

export interface OpsMeeting {
  id: number;
  client_id: number | null;
  client_name: string | null;
  project_id: number | null;
  project_name: string | null;
  date: string;
  type: "google_meet" | "in_person" | "phone_call" | "whatsapp_call";
  link: string | null;
  attendees: string | null;
  agenda: string | null;
  outcome: string | null;
  next_action: string | null;
  next_followup: string | null;
  booked_by: string;
  created_at: string;
}

export interface OpsBug {
  id: number;
  project_id: number;
  project_name: string | null;
  module: string;
  description: string;
  type: "bug" | "feature_request" | "change_request";
  priority: "p0_critical" | "p1_high" | "p2_medium" | "p3_low";
  reported_by: string;
  reported_date: string | null;
  developer_id: number | null;
  developer_name: string | null;
  qa_id: number | null;
  qa_name: string | null;
  status: "open" | "in_progress" | "fixed" | "retest" | "closed" | "wont_fix";
  target_date: string | null;
  steps_to_repro: string | null;
  parent_bug_id: number | null;
  created_at: string;
  updated_at: string;
  screenshots?: { id: number; file_path: string }[];
  comments?: OpsBugComment[];
  history?: OpsActivityEntry[];
}

export interface OpsBugComment {
  id: number;
  bug_id: number;
  comment: string;
  added_by: string;
  due_date: string | null;
  created_at: string;
}

export interface OpsProjectCredential {
  id: number;
  project_id: number;
  label: string;
  role: string;
  username: string;
  password: string;
  url: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OpsPayment {
  id: number;
  client_id: number;
  client_name?: string | null;
  project_id: number;
  project_name?: string | null;
  amount: number;
  type: "advance" | "mid" | "final" | "amc" | "other";
  mode: "cash" | "bank_transfer" | "upi" | "cheque" | "other";
  reference: string | null;
  recorded_by: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface OpsExpense {
  id: number;
  category: "hosting" | "tools" | "travel" | "marketing" | "salary" | "pitch" | "other";
  amount: number;
  description: string | null;
  project_id: number | null;
  pitch_id: number | null;
  date: string;
  added_by: string;
  created_at: string;
}

export interface OpsAmcRecord {
  id: number;
  client_id: number;
  client_name: string | null;
  project_id: number;
  project_name: string | null;
  amount: number;
  start_date: string;
  renewal_date: string;
  status: "active" | "due" | "overdue" | "paid";
  payment_mode: string | null;
  notes: string | null;
  days_until_renewal: number | null;
}

export interface OpsPitch {
  id: number;
  name: string;
  date: string;
  venue: string | null;
  city: string | null;
  type: "yes_meeting" | "business_forum" | "cold_outreach" | "referral_event" | "online" | "other";
  spend: number;
  description: string | null;
  created_by: string;
  created_at: string;
  leads_count: number;
  converted: number;
  conversion_pct: number;
  revenue: number;
  roi: number | null;
  leads?: OpsClient[];
}

export interface OpsEmployee {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: "founder" | "qa_tester" | "sales_caller" | "trainer" | "developer" | "other";
  access_level: "full" | "bugs_only" | "clients_readonly" | "clients_followups";
  monthly_pay: number;
  start_date: string | null;
  status: "active" | "inactive";
  notes: string | null;
  bugs_reported?: number;
  bugs_resolved?: number;
  created_at: string;
}

export interface OpsHiringCandidate {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  assignment_sent: string | null;
  assignment_due: string | null;
  submitted: number;
  workflow_bugs: number;
  critical_bugs: number;
  reporting_quality: number;
  reasoning_quality: number;
  score: number;
  decision: "pending" | "selected" | "rejected";
  rejection_reason: string | null;
  start_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsDashboardStats {
  today_actions: {
    followups_today: { client_name: string; client_id: number; next_followup: string }[];
    amc_due_this_month: (OpsAmcRecord & { client_name: string; project_name: string })[];
    meetings_today: OpsMeeting[];
    payments_expected_today: OpsProject[];
    due_comments_today: {
      id: number; comment: string; added_by: string; due_date: string;
      bug_id: number; bug_description: string;
      project_id: number; project_name: string; entity_type: string;
    }[];
    project_actions_due_today: {
      project_id: number; project_name: string; client_name: string; client_id: number;
      current_work: string | null; current_work_due: string | null;
      next_action: string | null; next_action_due: string | null;
    }[];
  };
  money: {
    total_quoted: number;
    total_received: number;
    total_balance: number;
    this_month_collected: number;
    overdue_collections: (OpsProject & { client_name: string })[];
  };
  project_health: {
    red: number;
    yellow: number;
    green: number;
    at_risk_projects: { id: number; name: string; client_name: string; health: string; stage: string; next_action: string | null }[];
  };
  pipeline: {
    by_stage: { stage: string; cnt: number }[];
    overdue_followups: number;
    proposals_sent: number;
  };
  upcoming_tasks: {
    bugs: { id: number; description: string; priority: string; status: string; target_date: string; project_id: number; project_name: string }[];
    project_actions: {
      project_id: number; project_name: string; client_name: string;
      current_work: string | null; current_work_due: string | null;
      next_action: string | null; next_action_due: string | null;
    }[];
    window_end: string;
  };
  ai_recommendations: string[];
}

// ─── SOP Module ───────────────────────────────────────────────────────────────

export interface OpsSopModule {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  sop_count: number;
}

export interface OpsSop {
  id: number;
  tenant_id: number;
  module_id: number;
  module_name?: string | null;
  title: string;
  content: string | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  versions?: OpsSopVersion[];
}

export interface OpsSopVersion {
  id: number;
  sop_id: number;
  version_no: number;
  title: string;
  content: string | null;
  saved_by: string;
  saved_at: string;
}

// ─── Process Page ─────────────────────────────────────────────────────────────

export interface OpsProcessSubStep {
  id: number;
  step_id: number;
  parent_substep_id: number | null;
  title: string;
  datetime: string | null;
  status: "not_started" | "in_progress" | "done";
  position: number;
  children?: OpsProcessSubStep[];
}

export interface OpsProcessStep {
  id: number;
  title: string;
  datetime: string | null;
  status: "not_started" | "in_progress" | "done";
  position: number;
  substeps: OpsProcessSubStep[];
}

// ─── Meeting Follow-ups ────────────────────────────────────────────────────────

export interface OpsMeetingFollowup {
  id: number;
  meeting_id: number;
  date: string;
  outcome: string;
  notes: string | null;
  added_by: string;
  created_at: string;
}

export interface OpsMeetingDetail extends OpsMeeting {
  followups: OpsMeetingFollowup[];
}

// ─── Checklist File Version ────────────────────────────────────────────────────

export interface OpsChecklistFileVersion {
  id: number;
  checklist_id: number;
  file_path: string;
  file_name: string;
  version_no: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface OpsFinanceSummary {
  total_revenue_all_time: number;
  total_revenue_month: number;
  total_collected_month: number;
  total_pending: number;
  total_expenses_month: number;
  net_profit_month: number;
  by_project: { id: number; name: string; client_name: string; quoted: number; received: number; balance: number; payment_status: string; pct_collected: number }[];
}

// ─── AI Command Bar ───────────────────────────────────────────────────────────

export interface AiCommandParseResult {
  success: boolean;
  token?: string;
  intent_type: string;
  entity_name?: string | null;
  fields?: Record<string, string>;
  preview: string;
  confidence?: "high" | "medium" | "low";
  clarification_needed?: string | null;
}

export interface AiCommandExecuteResult {
  message: string;
  refreshDashboard: boolean;
}

export interface AiCommandLogEntry {
  id: number;
  raw_prompt: string;
  intent_type: string | null;
  executed: number;
  error: string | null;
  executed_by: string;
  created_at: string;
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────

export interface AiChatChoice {
  label: string;
  value: string;
}

export interface AiChatIntent {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

export type AiChatResponseType = "text" | "question" | "choices" | "confirm";

export interface AiChatResponse {
  type: AiChatResponseType;
  message: string;
  choices?: AiChatChoice[];
  preview?: string;
  intent?: AiChatIntent;
  token?: string;
  pending_intent?: Record<string, unknown>;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: AiChatResponse;
  timestamp: string;
}

export interface AiChatContextEntity {
  type: "project" | "client" | "bug" | "meeting";
  id: number;
  label: string;
  sub: string;
}
