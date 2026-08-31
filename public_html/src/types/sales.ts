/**
 * Sales module types — mirror the PHP models in api/models/Sales*.php.
 */

export type LeadTemperature = "hot" | "warm" | "cold";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "meeting_scheduled"
  | "proposal"
  | "onboarding"
  | "converted"
  | "lost";

export type CallOutcome =
  | "interested"
  | "follow_up_required"
  | "meeting_required"
  | "proposal_required"
  | "not_interested"
  | "no_response"
  | "call_back_later"
  | "converted"
  | "other";

export type FollowupBucket = "today" | "overdue" | "upcoming" | "completed";
export type FollowupStatus = "pending" | "completed" | "cancelled";

export type MeetingType = "physical" | "virtual";
export type MeetingStatus = "scheduled" | "completed" | "cancelled";
export type MeetingOutcome =
  | "positive"
  | "neutral"
  | "negative"
  | "rescheduled"
  | "no_show"
  | "other";

export type ChallengeStatus =
  | "available"
  | "accepted"
  | "in_progress"
  | "completed"
  | "expired"
  | "cancelled";

export type ChallengePriority = "low" | "normal" | "high" | "critical";

export interface SalesLead {
  id: number;
  lead_code: string;
  name: string;
  company: string;
  contact_person: string;
  phone: string;
  email: string;
  source: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  status: LeadStatus;
  temperature: LeadTemperature;
  next_followup_at: string | null;
  next_meeting_at: string | null;
  last_activity_at: string | null;
  last_outcome: string;
  notes: string | null;
  converted_client_id: number | null;
  converted_project_id: number | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SalesLeadDetail extends SalesLead {
  calls: SalesCall[];
  followups: SalesFollowup[];
  meetings: SalesMeeting[];
  timeline: SalesActivityEntry[];
  comments: SalesComment[];
  /** [entity_type][entity_id] -> comment count, so rows can show a badge. */
  comment_counts: Partial<Record<CommentEntityType, Record<number, number>>>;
}

export type CommentEntityType = "lead" | "call" | "followup" | "meeting" | "challenge";

export interface SalesComment {
  id: number;
  entity_type: CommentEntityType;
  entity_id: number;
  lead_id: number | null;
  challenge_id: number | null;
  lead_name?: string | null;
  lead_company?: string | null;
  challenge_title?: string | null;
  /** null once deleted — the slot stays, the text does not. */
  body: string | null;
  author_id: number | null;
  author_name: string;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
  deleted_at: string | null;
}

/** One entry in the merged live feed (lead activity + challenge activity). */
export interface SalesFeedEvent {
  key: string;
  source: "lead" | "challenge";
  type: string;
  title: string;
  description: string | null;
  actor_id: number | null;
  actor_name: string;
  subject: string | null;
  url: string;
  at: string;
}

export interface SalesCall {
  id: number;
  lead_id: number;
  lead_name?: string | null;
  lead_company?: string | null;
  lead_temperature?: LeadTemperature | null;
  called_by: number | null;
  called_by_name: string;
  call_date: string;
  call_time: string | null;
  duration_minutes: number;
  outcome: CallOutcome;
  notes: string | null;
  temperature_after: LeadTemperature | null;
  followup_id: number | null;
  comment_count?: number;
  created_at: string;
}

export interface SalesFollowup {
  id: number;
  lead_id: number;
  lead_name?: string | null;
  lead_company?: string | null;
  lead_phone?: string | null;
  lead_contact_person?: string | null;
  lead_temperature?: LeadTemperature | null;
  lead_last_outcome?: string | null;
  call_id: number | null;
  meeting_id: number | null;
  due_date: string;
  due_time: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  status: FollowupStatus;
  purpose: string;
  outcome_notes: string | null;
  completed_by: number | null;
  completed_at: string | null;
  comment_count?: number;
  created_at: string;
}

export interface SalesMeeting {
  id: number;
  lead_id: number;
  lead_name?: string | null;
  lead_company?: string | null;
  lead_temperature?: LeadTemperature | null;
  title: string;
  meeting_type: MeetingType;
  meeting_date: string;
  meeting_time: string | null;
  place: string;
  meeting_link: string;
  participants: string | null;
  notes: string | null;
  status: MeetingStatus;
  outcome: string;
  outcome_notes: string | null;
  requirements: string | null;
  decisions: string | null;
  next_action: string | null;
  next_meeting_date: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  comment_count?: number;
  created_at: string;
  updated_at: string | null;
}

export interface SalesActivityEntry {
  id: number;
  lead_id: number;
  lead_name?: string | null;
  lead_company?: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  reference_type: string;
  reference_id: number | null;
  metadata: Record<string, unknown> | null;
  actor_id: number | null;
  actor_name: string;
  occurred_at: string;
}

export interface SalesChallenge {
  id: number;
  challenge_code: string;
  title: string;
  description: string | null;
  lead_id: number | null;
  lead_name: string | null;
  lead_company: string | null;
  client_id: number | null;
  deadline: string;
  priority: ChallengePriority;
  status: ChallengeStatus;
  accepted_by: number | null;
  accepted_by_name: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_by: number | null;
  completed_by_name: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  expired_at: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string | null;
  /** Server clock, not the device clock — the countdown is seeded from these. */
  server_time: string;
  seconds_remaining: number;
  is_expired: boolean;
  is_actionable: boolean;
}

export interface ChallengeActivityEntry {
  id: number;
  action: string;
  notes: string | null;
  actor_id: number | null;
  actor_name: string;
  created_at: string;
}

/**
 * The destroyed-state report. Only the fields the backend can actually prove
 * are present — there is deliberately no fabricated streak, completion
 * percentage or witness notification.
 */
export interface ChallengeReport {
  contract: string;
  status: string;
  deadline: string;
  time_left?: string;
  accepted_by?: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  expired_at?: string | null;
  held_for?: string;
}

export interface SalesChallengeDetail extends SalesChallenge {
  assignees: { user_id: number; name: string | null; email: string | null }[];
  activity: ChallengeActivityEntry[];
  report: ChallengeReport;
  comments: SalesComment[];
  /** The board is open to the team; only the people it was offered to may accept. */
  is_offered_to_me: boolean;
  can_accept: boolean;
}

export interface SalesSummary {
  total_leads: number;
  hot: number;
  warm: number;
  cold: number;
  converted: number;
  followups_today: number;
  followups_overdue: number;
  followups_upcoming: number;
  meetings_today: number;
  meetings_upcoming: number;
  active_challenges: number;
}

export interface ChallengeCounts {
  available: number;
  accepted: number;
  in_progress: number;
  completed: number;
  expired: number;
}

export interface SalesDashboard {
  server_time: string;
  summary: SalesSummary;
  followups: { today: SalesFollowup[]; overdue: SalesFollowup[]; upcoming: SalesFollowup[] };
  meetings: { today: SalesMeeting[]; upcoming: SalesMeeting[] };
  hot_leads: SalesLead[];
  challenges: { counts: ChallengeCounts; active: SalesChallenge[]; available: SalesChallenge[] };
}

/** Why a salesperson lost access to the app, and when. */
export interface SalesLockoutInfo {
  id: number;
  user_id: number;
  user_name?: string | null;
  email?: string | null;
  challenge_id: number | null;
  challenge_title: string | null;
  challenge_code?: string | null;
  deadline?: string | null;
  reason: string;
  locked_at: string;
}

export interface SalesMe {
  user_id: number | null;
  name: string;
  email: string;
  staff_role: string | null;
  is_admin: boolean;
  permissions: string[];
  server_time: string;
  /** Set when a missed challenge destroyed this user's app access. */
  lockout: SalesLockoutInfo | null;
}

export interface SalesAccessUser {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  staff_role: string | null;
  is_admin: boolean;
  permissions: string[];
  granted: string[];
  lockout: SalesLockoutInfo | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
