// Mock API data for all Kynetropo Ops endpoints
// Used when VITE_USE_MOCK_API=true

const TODAY = new Date().toISOString().split("T")[0];
const MONTH = new Date().toISOString().slice(0, 7);

const CLIENTS = [
  { id: 1, name: "Cable TV CRM", phone: "9876543210", email: "cabletv@example.com", source: "YES Meet Kanchipuram", source_pitch_id: 1, owner: "Founder", health: "red", stage: "Bug Fixing", notes: "Phase 2 delayed", project_name: "Cable TV CRM Phase 2", project_id: 1, balance_due: 45000, days_since_contact: 3, next_followup: TODAY, created_at: "2025-01-10" },
  { id: 2, name: "Biomass ERP", phone: "9123456789", email: "biomass@example.com", source: "YES Meet Bangalore", source_pitch_id: 2, owner: "Founder", health: "yellow", stage: "Development", notes: null, project_name: "Biomass ERP v1", project_id: 2, balance_due: 80000, days_since_contact: 7, next_followup: null, created_at: "2025-02-15" },
  { id: 3, name: "VTT Gold", phone: "9988776655", email: "vtt@example.com", source: "Referral", source_pitch_id: null, owner: "Founder", health: "green", stage: "Full Payment", notes: "Happy client", project_name: "VTT Gold Portal", project_id: 3, balance_due: 0, days_since_contact: 1, next_followup: null, created_at: "2025-03-01" },
  { id: 4, name: "Agro Mart", phone: "9000011111", email: "agro@example.com", source: "YES Meet Chennai", source_pitch_id: 1, owner: "Founder", health: "green", stage: "Requirements", notes: null, project_name: null, project_id: null, balance_due: null, days_since_contact: 14, next_followup: TODAY, created_at: "2025-06-10" },
];

const PROJECTS = [
  { id: 1, client_id: 1, client_name: "Cable TV CRM", name: "Cable TV CRM Phase 2", stage: "Bug Fixing", owner: "Founder", start_date: "2025-01-15", deadline: "2025-04-30", health: "red", priority: "critical", quoted: 120000, received: 75000, balance: 45000, payment_status: "partial", next_collection_trigger: "After bug closure", collection_target_date: TODAY, current_work: "Fixing payment gateway integration issues reported in UAT", next_action: "Schedule call with client to demo fixes", next_deadline: TODAY, founder_note: "Client is frustrated — prioritise this week", blocker: "Need API credentials from client", created_at: "2025-01-15", updated_at: "2026-07-28" },
  { id: 2, client_id: 2, client_name: "Biomass ERP", name: "Biomass ERP v1", stage: "Development", owner: "Founder", start_date: "2025-02-20", deadline: "2026-09-30", health: "yellow", priority: "high", quoted: 200000, received: 120000, balance: 80000, payment_status: "partial", next_collection_trigger: "After delivery", collection_target_date: "2026-09-15", current_work: "Building inventory module", next_action: "Complete stock movement reports", next_deadline: "2026-08-15", founder_note: null, blocker: null, created_at: "2025-02-20", updated_at: "2026-07-20" },
  { id: 3, client_id: 3, client_name: "VTT Gold", name: "VTT Gold Portal", stage: "Delivered", owner: "Founder", start_date: "2024-11-01", deadline: "2025-03-31", health: "green", priority: "medium", quoted: 150000, received: 150000, balance: 0, payment_status: "paid", next_collection_trigger: null, collection_target_date: null, current_work: "AMC support phase", next_action: null, next_deadline: null, founder_note: null, blocker: null, created_at: "2024-11-01", updated_at: "2026-06-01" },
];

const BUGS = [
  { id: 1, project_id: 1, project_name: "Cable TV CRM Phase 2", module: "Payment Gateway", description: "Payment fails silently when UPI times out — no error shown to user", type: "bug", priority: "p0_critical", reported_by: "QA Tester", developer_id: null, developer_name: null, qa_id: null, qa_name: null, status: "in_progress", target_date: TODAY, steps_to_repro: "1. Go to checkout\n2. Select UPI\n3. Let timer expire", parent_bug_id: null, created_at: "2026-07-25", updated_at: "2026-07-28" },
  { id: 2, project_id: 1, project_name: "Cable TV CRM Phase 2", module: "Reports", description: "Monthly revenue report shows wrong total when filters applied", type: "bug", priority: "p1_high", reported_by: "Client", developer_id: null, developer_name: null, qa_id: null, qa_name: null, status: "open", target_date: "2026-08-07", steps_to_repro: "Filter by month → totals wrong", parent_bug_id: null, created_at: "2026-07-26", updated_at: "2026-07-26" },
  { id: 3, project_id: 2, project_name: "Biomass ERP v1", module: "Inventory", description: "Stock quantity goes negative when multiple users update simultaneously", type: "bug", priority: "p1_high", reported_by: "QA Tester", developer_id: null, developer_name: null, qa_id: null, qa_name: null, status: "open", target_date: "2026-08-10", steps_to_repro: null, parent_bug_id: null, created_at: "2026-07-27", updated_at: "2026-07-27" },
  { id: 4, project_id: 1, project_name: "Cable TV CRM Phase 2", module: "Dashboard", description: "Add export to Excel button on main dashboard", type: "feature_request", priority: "p3_low", reported_by: "Client", developer_id: null, developer_name: null, qa_id: null, qa_name: null, status: "open", target_date: null, steps_to_repro: null, parent_bug_id: null, created_at: "2026-07-20", updated_at: "2026-07-20" },
];

const MEETINGS = [
  { id: 1, client_id: 1, client_name: "Cable TV CRM", project_id: 1, project_name: "Cable TV CRM Phase 2", date: TODAY + "T10:00:00", type: "google_meet", link: "https://meet.google.com/abc-defg-hij", attendees: "Founder, Client PM", agenda: "Review bug fixes, discuss timeline", outcome: null, next_action: "Send revised timeline doc", next_followup: "2026-08-10", booked_by: "Founder", created_at: TODAY },
  { id: 2, client_id: 2, client_name: "Biomass ERP", project_id: 2, project_name: "Biomass ERP v1", date: "2026-08-03T14:30:00", type: "google_meet", link: "https://meet.google.com/xyz-1234", attendees: "Founder", agenda: "Inventory module demo", outcome: "Client approved design, requested 2 changes", next_action: "Implement feedback", next_followup: "2026-08-12", booked_by: "Founder", created_at: "2026-08-03" },
  { id: 3, client_id: 3, client_name: "VTT Gold", project_id: 3, project_name: "VTT Gold Portal", date: "2026-07-20T11:00:00", type: "in_person", link: null, attendees: "Founder, Client CEO", agenda: "Post-delivery review", outcome: "Client happy, signed AMC agreement", next_action: "Send AMC invoice", next_followup: null, booked_by: "Founder", created_at: "2026-07-20" },
];

const PAYMENTS = [
  { id: 1, client_id: 1, client_name: "Cable TV CRM", project_id: 1, project_name: "Cable TV CRM Phase 2", amount: 40000, type: "advance", mode: "bank_transfer", reference: "UTR123456", recorded_by: "Founder", payment_date: "2025-01-20", notes: "Advance payment", created_at: "2025-01-20" },
  { id: 2, client_id: 1, client_name: "Cable TV CRM", project_id: 1, project_name: "Cable TV CRM Phase 2", amount: 35000, type: "mid", mode: "upi", reference: "UPI789012", recorded_by: "Founder", payment_date: "2025-03-15", notes: "Mid payment after scope freeze", created_at: "2025-03-15" },
  { id: 3, client_id: 2, client_name: "Biomass ERP", project_id: 2, project_name: "Biomass ERP v1", amount: 80000, type: "advance", mode: "bank_transfer", reference: "UTR345678", recorded_by: "Founder", payment_date: "2025-02-25", notes: null, created_at: "2025-02-25" },
  { id: 4, client_id: 2, client_name: "Biomass ERP", project_id: 2, project_name: "Biomass ERP v1", amount: 40000, type: "mid", mode: "upi", reference: "UPI901234", recorded_by: "Founder", payment_date: "2025-06-01", notes: null, created_at: "2025-06-01" },
  { id: 5, client_id: 3, client_name: "VTT Gold", project_id: 3, project_name: "VTT Gold Portal", amount: 150000, type: "final", mode: "bank_transfer", reference: "UTR567890", recorded_by: "Founder", payment_date: "2025-03-28", notes: "Full payment received", created_at: "2025-03-28" },
];

const EXPENSES = [
  { id: 1, category: "hosting", amount: 2500, description: "AWS EC2 monthly billing", project_id: null, pitch_id: null, date: MONTH + "-01", added_by: "Founder", created_at: MONTH + "-01" },
  { id: 2, category: "tools", amount: 1200, description: "Linear + Figma subscriptions", project_id: null, pitch_id: null, date: MONTH + "-01", added_by: "Founder", created_at: MONTH + "-01" },
  { id: 3, category: "pitch", amount: 3500, description: "Pitch expense: YES Meet Kanchipuram", project_id: null, pitch_id: 1, date: "2026-07-15", added_by: "Founder", created_at: "2026-07-15" },
  { id: 4, category: "travel", amount: 1800, description: "Travel to VTT Gold client office", project_id: 3, pitch_id: null, date: "2026-07-20", added_by: "Founder", created_at: "2026-07-20" },
];

const AMC = [
  { id: 1, client_id: 3, client_name: "VTT Gold", project_id: 3, project_name: "VTT Gold Portal", amount: 18000, start_date: "2025-04-01", renewal_date: "2026-04-01", status: "overdue", payment_mode: "bank_transfer", notes: "Annual maintenance contract", days_until_renewal: -126 },
  { id: 2, client_id: 1, client_name: "Cable TV CRM", project_id: 1, project_name: "Cable TV CRM Phase 2", amount: 24000, start_date: "2026-05-01", renewal_date: "2027-05-01", status: "active", payment_mode: null, notes: null, days_until_renewal: 269 },
];

const PITCHES = [
  { id: 1, name: "YES Meet Kanchipuram", date: "2026-07-15", venue: "Hotel Tamil Nadu", city: "Kanchipuram", type: "yes_meeting", spend: 3500, description: "Monthly YES chapter meeting. Presented Kynetropo to 40+ business owners.", created_by: "Founder", created_at: "2026-07-15", leads_count: 6, converted: 2, conversion_pct: 33.3, revenue: 320000, roi: 9043 },
  { id: 2, name: "YES Meet Bangalore", date: "2026-06-20", venue: "The Lalit Ashok", city: "Bangalore", type: "yes_meeting", spend: 8500, description: "National YES meet. Good exposure but leads were from different city.", created_by: "Founder", created_at: "2026-06-20", leads_count: 3, converted: 1, conversion_pct: 33.3, revenue: 200000, roi: 2253 },
  { id: 3, name: "SME Business Forum Chennai", date: "2026-05-10", venue: "Chennai Trade Centre", city: "Chennai", type: "business_forum", spend: 5000, description: "SME digital transformation forum.", created_by: "Founder", created_at: "2026-05-10", leads_count: 2, converted: 0, conversion_pct: 0, revenue: 0, roi: -100 },
];

const EMPLOYEES = [
  { id: 1, name: "Founder", phone: "9876543210", email: "founder@kynetropo.com", role: "founder", access_level: "full", monthly_pay: 0, start_date: "2023-01-01", status: "active", notes: null, created_at: "2023-01-01" },
  { id: 2, name: "Priya QA", phone: "9111222333", email: "priya@kynetropo.com", role: "qa_tester", access_level: "bugs_only", monthly_pay: 15000, start_date: "2025-09-01", status: "active", notes: "Remote tester", created_at: "2025-09-01" },
  { id: 3, name: "Ravi Sales", phone: "9444555666", email: "ravi@kynetropo.com", role: "sales_caller", access_level: "clients_followups", monthly_pay: 12000, start_date: "2026-01-01", status: "active", notes: null, created_at: "2026-01-01" },
];

const HIRING = [
  { id: 1, name: "Arjun Nair", email: "arjun@gmail.com", phone: "9700011111", assignment_sent: "2026-07-20", assignment_due: "2026-07-27", submitted: 1, workflow_bugs: 7, critical_bugs: 2, reporting_quality: 4, reasoning_quality: 3, score: 7.5, decision: "pending", rejection_reason: null, start_date: null, notes: "Strong on workflows, needs improvement on reasoning", created_at: "2026-07-18", updated_at: "2026-07-28" },
  { id: 2, name: "Sneha Patel", email: "sneha@outlook.com", phone: "9800022222", assignment_sent: "2026-07-15", assignment_due: "2026-07-22", submitted: 1, workflow_bugs: 5, critical_bugs: 1, reporting_quality: 5, reasoning_quality: 5, score: 9.0, decision: "selected", rejection_reason: null, start_date: "2026-08-01", notes: "Excellent candidate", created_at: "2026-07-14", updated_at: "2026-07-26" },
  { id: 3, name: "Kiran Dev", email: "kiran@yahoo.com", phone: "9900033333", assignment_sent: "2026-07-10", assignment_due: "2026-07-17", submitted: 0, workflow_bugs: 0, critical_bugs: 0, reporting_quality: 0, reasoning_quality: 0, score: 0, decision: "rejected", rejection_reason: "Did not submit assignment despite follow-up", start_date: null, notes: null, created_at: "2026-07-09", updated_at: "2026-07-20" },
];

const FINANCE_SUMMARY = {
  total_revenue_all_time: 345000,
  total_revenue_month: 0,
  total_collected_month: 0,
  total_pending: 125000,
  total_expenses_month: 9000,
  net_profit_month: -9000,
  by_project: [
    { id: 1, name: "Cable TV CRM Phase 2", client_name: "Cable TV CRM", quoted: 120000, received: 75000, balance: 45000, payment_status: "partial", pct_collected: 62.5 },
    { id: 2, name: "Biomass ERP v1",       client_name: "Biomass ERP",  quoted: 200000, received: 120000, balance: 80000, payment_status: "partial", pct_collected: 60 },
    { id: 3, name: "VTT Gold Portal",       client_name: "VTT Gold",    quoted: 150000, received: 150000, balance: 0,      payment_status: "paid",    pct_collected: 100 },
  ],
};

const DASHBOARD_STATS = {
  today_actions: {
    followups_today: [
      { client_id: 1, client_name: "Cable TV CRM", next_followup: TODAY },
      { client_id: 4, client_name: "Agro Mart",    next_followup: TODAY },
    ],
    amc_due_this_month: [],
    meetings_today: [MEETINGS[0]],
    payments_expected_today: [{ ...PROJECTS[0], client_name: "Cable TV CRM" }],
  },
  money: {
    total_quoted: 470000,
    total_received: 345000,
    total_balance: 125000,
    this_month_collected: 0,
    overdue_collections: [
      { ...PROJECTS[0], client_name: "Cable TV CRM" },
    ],
  },
  project_health: {
    red: 1,
    yellow: 1,
    green: 1,
    at_risk_projects: [
      { id: 1, name: "Cable TV CRM Phase 2", client_name: "Cable TV CRM", health: "red",    stage: "Bug Fixing",  next_action: "Schedule demo call" },
      { id: 2, name: "Biomass ERP v1",       client_name: "Biomass ERP",  health: "yellow", stage: "Development", next_action: "Complete stock reports" },
    ],
  },
  pipeline: {
    by_stage: [
      { stage: "First Meetup", cnt: 1 },
      { stage: "Requirements", cnt: 1 },
      { stage: "Development",  cnt: 1 },
      { stage: "Bug Fixing",   cnt: 1 },
      { stage: "Full Payment", cnt: 1 },
    ],
    overdue_followups: 2,
    proposals_sent: 1,
  },
  ai_recommendations: [
    "• ₹45,000 collectible from Cable TV CRM — bug fixes are done, send invoice today",
    "• Cable TV CRM Phase 2 has been in Bug Fixing for 8 days — escalate or set a hard deadline",
    "• VTT Gold AMC is 126 days overdue — call them before they cancel",
    "• Agro Mart follow-up is due today — they haven't been contacted in 14 days",
    "• YES Meet Kanchipuram generated 6 leads with ₹3,500 spend — best ROI pitch so far",
    "• 1 unassigned P0 bug in Cable TV CRM — assign to developer immediately",
  ],
};

// ─── Route matcher ────────────────────────────────────────────────────────────

export function getMockResponse(path: string, method: string, body?: unknown): unknown {
  const url = path.replace(/\?.*$/, ""); // strip query params
  const ok = (data: unknown) => ({ success: true, data });

  // Dashboard
  if (url === "/admin/ops/dashboard-stats") return ok(DASHBOARD_STATS);

  // Clients
  if (url === "/admin/ops/clients" && method === "GET") return ok([...CLIENTS]);
  if (url.match(/^\/admin\/ops\/clients\/\d+$/) && method === "GET") {
    const id = Number(url.split("/").pop());
    const client = CLIENTS.find(c => c.id === id);
    if (!client) return { success: false, message: "Not found" };
    return ok({
      ...client,
      project: PROJECTS.find(p => p.client_id === id) ?? null,
      stage_history: [],
      timeline: [
        { id: 1, entity_type: "client", entity_id: id, action: "created", description: "Client created", done_by: "Founder", created_at: client.created_at },
        { id: 2, entity_type: "client", entity_id: id, action: "stage_changed", description: `Stage advanced to ${client.stage}`, done_by: "Founder", created_at: client.created_at },
      ],
      payments: PAYMENTS.filter(p => p.client_id === id),
      meetings: MEETINGS.filter(m => m.client_id === id),
      bugs: BUGS.filter(b => PROJECTS.find(p => p.client_id === id && p.id === b.project_id)),
      checklist: [
        { id: 1, client_id: id, item_name: "Requirement document sent",    is_done: 1, completed_date: "2025-02-01", file_path: null, completed_by: "Founder" },
        { id: 2, client_id: id, item_name: "Scope freeze document signed", is_done: 1, completed_date: "2025-02-10", file_path: null, completed_by: "Founder" },
        { id: 3, client_id: id, item_name: "Quotation sent",               is_done: 1, completed_date: "2025-02-05", file_path: null, completed_by: "Founder" },
        { id: 4, client_id: id, item_name: "Advance invoice sent",         is_done: 1, completed_date: "2025-02-15", file_path: null, completed_by: "Founder" },
        { id: 5, client_id: id, item_name: "Onboarding email sent",        is_done: 0, completed_date: null,         file_path: null, completed_by: null },
        { id: 6, client_id: id, item_name: "Training video sent",          is_done: 0, completed_date: null,         file_path: null, completed_by: null },
        { id: 7, client_id: id, item_name: "Final invoice sent",           is_done: 0, completed_date: null,         file_path: null, completed_by: null },
        { id: 8, client_id: id, item_name: "AMC agreement signed",         is_done: 0, completed_date: null,         file_path: null, completed_by: null },
      ],
    });
  }
  if (url === "/admin/ops/clients" && method === "POST") return ok({ ...(body as object), id: 99, health: "green", stage: "First Meetup", created_at: TODAY });
  if (url.match(/^\/admin\/ops\/clients\/\d+$/) && method === "PUT") return ok({ ...(body as object) });
  if (url.match(/^\/admin\/ops\/clients\/\d+\/stage$/)) return ok({ success: true });
  if (url.match(/^\/admin\/ops\/clients\/\d+\/checklist\/\d+$/)) return ok({ updated: true });

  // Projects
  if (url === "/admin/ops/projects" && method === "GET") return ok([...PROJECTS]);
  if (url.match(/^\/admin\/ops\/projects\/\d+$/) && method === "GET") {
    const id = Number(url.split("/").pop());
    const project = PROJECTS.find(p => p.id === id);
    if (!project) return { success: false, message: "Not found" };
    return ok({ ...project, stage_history: [], bugs: BUGS.filter(b => b.project_id === id), meetings: MEETINGS.filter(m => m.project_id === id), payments: PAYMENTS.filter(p => p.project_id === id), activity_log: [] });
  }
  if (url === "/admin/ops/projects" && method === "POST") return ok({ ...(body as object), id: 99, received: 0, balance: (body as any).quoted ?? 0, payment_status: "pending", created_at: TODAY });
  if (url.match(/^\/admin\/ops\/projects\/\d+$/) && method === "PUT") return ok({ ...(body as object) });

  // Bugs
  if (url === "/admin/ops/bugs" && method === "GET") return ok([...BUGS]);
  if (url.match(/^\/admin\/ops\/bugs\/\d+$/) && method === "GET") {
    const id = Number(url.split("/").pop());
    const bug = BUGS.find(b => b.id === id);
    if (!bug) return { success: false, message: "Not found" };
    return ok({
      ...bug,
      screenshots: id === 1 ? [
        { id: 1, file_path: "https://placehold.co/800x450/fee2e2/dc2626?text=Payment+Error+Screenshot", uploaded_by: "QA Tester", created_at: "2026-07-25T10:30:00" },
        { id: 2, file_path: "https://placehold.co/800x450/fef3c7/d97706?text=Console+Error+Log", uploaded_by: "QA Tester", created_at: "2026-07-25T10:31:00" },
      ] : [],
      comments: id === 1 ? [
        { id: 1, bug_id: 1, comment: "Reproduced on Chrome and Safari. The UPI timeout doesn't trigger the error handler — the promise just hangs. No toast shown to user.", added_by: "QA Tester", created_at: "2026-07-25T10:35:00" },
        { id: 2, bug_id: 1, comment: "Looking at the payment service code. The issue is in handleUpiCallback — it only handles success and failure, not timeout. Will fix.", added_by: "Developer", created_at: "2026-07-26T09:10:00" },
        { id: 3, bug_id: 1, comment: "Fix pushed to staging. Added a 30-second timeout with a user-facing error message. Please retest.", added_by: "Developer", created_at: "2026-07-27T14:22:00" },
        { id: 4, bug_id: 1, comment: "Retested on staging — timeout now shows correct error. However the retry button doesn't clear the previous order state. Raising as separate bug.", added_by: "QA Tester", created_at: "2026-07-28T11:05:00" },
      ] : id === 2 ? [
        { id: 5, bug_id: 2, comment: "The filter applies to the display but the SUM query still runs on the full dataset. SQL fix needed in the reports controller.", added_by: "Developer", created_at: "2026-07-27T16:00:00" },
      ] : [],
      history: id === 1 ? [
        { id: 1, action: "created",       description: "Bug reported by QA Tester",                       done_by: "QA Tester",  created_at: "2026-07-25T10:00:00" },
        { id: 2, action: "status_changed", description: "Status changed from open to in_progress",         done_by: "Developer",  created_at: "2026-07-26T09:00:00" },
      ] : id === 2 ? [
        { id: 3, action: "created",       description: "Bug reported by Client",                           done_by: "Client",     created_at: "2026-07-26T08:00:00" },
      ] : [
        { id: 4, action: "created",       description: "Bug reported by QA Tester",                       done_by: "QA Tester",  created_at: "2026-07-27T09:00:00" },
      ],
    });
  }
  if (url === "/admin/ops/bugs" && method === "POST") return ok({ ...(body as object), id: 99, status: "open", created_at: TODAY });
  if (url.match(/^\/admin\/ops\/bugs\/\d+$/) && method === "PUT") return ok({ ...(body as object) });
  if (url.match(/^\/admin\/ops\/bugs\/\d+\/comments$/)) return ok({ id: 99, comment: (body as any).comment, added_by: "", created_at: TODAY });

  // Meetings
  if (url === "/admin/ops/meetings" && method === "GET") return ok([...MEETINGS]);
  if (url === "/admin/ops/meetings" && method === "POST") return ok({ ...(body as object), id: 99, created_at: TODAY });
  if (url.match(/^\/admin\/ops\/meetings\/\d+$/) && method === "PUT") return ok({ ...(body as object) });

  // Finance
  if (url === "/admin/ops/finance/summary") return ok(FINANCE_SUMMARY);
  if (url === "/admin/ops/finance/payments" && method === "GET") return ok([...PAYMENTS]);
  if (url === "/admin/ops/finance/payments" && method === "POST") return ok({ ...(body as object), id: 99, created_at: TODAY });
  if (url === "/admin/ops/finance/expenses" && method === "GET") return ok([...EXPENSES]);
  if (url === "/admin/ops/finance/expenses" && method === "POST") return ok({ ...(body as object), id: 99, created_at: TODAY });
  if (url.match(/^\/admin\/ops\/finance\/(payments|expenses)\/\d+$/) && method === "DELETE") return ok({ message: "Deleted" });

  // AMC
  if (url === "/admin/ops/amc" && method === "GET") return ok([...AMC]);
  if (url === "/admin/ops/amc" && method === "POST") return ok({ ...(body as object), id: 99, status: "active", days_until_renewal: 365 });
  if (url.match(/^\/admin\/ops\/amc\/\d+$/) && method === "PUT") return ok({ ...(body as object) });

  // Pitches
  if (url === "/admin/ops/pitches" && method === "GET") return ok([...PITCHES]);
  if (url.match(/^\/admin\/ops\/pitches\/\d+$/) && method === "GET") {
    const id = Number(url.split("/").pop());
    const pitch = PITCHES.find(p => p.id === id);
    return ok({ ...pitch, leads: CLIENTS.filter(c => c.source_pitch_id === id) });
  }
  if (url === "/admin/ops/pitches" && method === "POST") return ok({ ...(body as object), id: 99, leads_count: 0, converted: 0, conversion_pct: 0, revenue: 0, roi: null, created_at: TODAY });
  if (url.match(/^\/admin\/ops\/pitches\/\d+$/) && method === "PUT") return ok({ ...(body as object) });

  // Hiring
  if (url === "/admin/ops/hiring" && method === "GET") return ok([...HIRING]);
  if (url === "/admin/ops/hiring" && method === "POST") return ok({ ...(body as object), id: 99, decision: "pending", created_at: TODAY });
  if (url.match(/^\/admin\/ops\/hiring\/\d+$/) && method === "PUT") return ok({ ...(body as object) });

  // Employees
  if (url === "/admin/ops/employees" && method === "GET") return ok([...EMPLOYEES]);
  if (url.match(/^\/admin\/ops\/employees\/\d+$/) && method === "GET") {
    const id = Number(url.split("/").pop());
    return ok({ ...EMPLOYEES.find(e => e.id === id), bugs_reported: 3, bugs_resolved: 1 });
  }
  if (url === "/admin/ops/employees" && method === "POST") return ok({ ...(body as object), id: 99, status: "active", created_at: TODAY });
  if (url.match(/^\/admin\/ops\/employees\/\d+$/) && method === "PUT") return ok({ ...(body as object) });

  // Auth (needed for login)
  if (url === "/auth/login") return { success: true, data: { token: "mock-token", refresh_token: "mock-refresh", user: { email: "admin@kynetropo.com", name: "Admin", company_name: "Kynetropo", user_type: "admin" } } };
  if (url === "/auth/logout") return { success: true };
  if (url === "/auth/me")    return { success: true, data: { email: "admin@kynetropo.com", name: "Admin", user_type: "admin" } };
  if (url === "/auth/refresh") return { success: true, data: { token: "mock-token", refresh_token: "mock-refresh" } };

  // Fallback
  return { success: true, data: [] };
}
