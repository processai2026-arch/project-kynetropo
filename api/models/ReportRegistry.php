<?php
declare(strict_types=1);

/**
 * Every report the system can run, and the only SQL it will run for them.
 *
 * A report is a fixed, named query. Nothing from the request reaches the SQL:
 * the id selects a definition from this list, and the only values bound are the
 * tenant and an optional date range. A report id that is not in this list does
 * not run — there is no path from a URL to a query this file does not contain.
 *
 * Each definition carries its own columns, so the viewer, the column picker and
 * the export all describe the same report without any of them being told twice.
 *
 * `date_column` is the column a From/To range filters on. A report without a
 * sensible date to filter (a current-state list rather than a period of
 * activity) leaves it null and the range controls disappear.
 */
final class ReportRegistry
{
    /** Column types the viewer formats: text, number, money, date, datetime, badge. */
    private static function col(string $key, string $label, string $type = 'text'): array
    {
        return ['key' => $key, 'label' => $label, 'type' => $type];
    }

    /** @return array<string, array<string, mixed>> keyed by report id */
    public static function all(): array
    {
        return [

            // ── Sales ───────────────────────────────────────────────────────
            'lead-pipeline' => [
                'title'       => 'Lead pipeline',
                'category'    => 'Sales',
                'description' => 'Every lead with its stage, owner, temperature and what it is quoted at.',
                'date_column' => 'l.created_at',
                'columns'     => [
                    self::col('lead_code', 'Code'),
                    self::col('name', 'Lead'),
                    self::col('company', 'Company'),
                    self::col('phone', 'Phone'),
                    self::col('status', 'Status', 'badge'),
                    self::col('temperature', 'Temp', 'badge'),
                    self::col('owner_name', 'Owner'),
                    self::col('quoted_amount', 'Quoted', 'money'),
                    self::col('source', 'Source'),
                    self::col('next_followup_at', 'Next follow-up', 'datetime'),
                    self::col('last_activity_at', 'Last activity', 'datetime'),
                    self::col('created_at', 'Created', 'date'),
                ],
                'sql' => "SELECT l.lead_code, l.name, l.company, l.phone, l.status, l.temperature,
                                 u.name AS owner_name, l.quoted_amount, l.source,
                                 l.next_followup_at, l.last_activity_at, l.created_at
                            FROM sales_leads l
                            LEFT JOIN users u ON u.user_id = l.assigned_to
                           WHERE l.tenant_id = ?",
                'order' => 'l.created_at DESC, l.id DESC',
            ],

            'lead-conversion' => [
                'title'       => 'Pipeline by stage',
                'category'    => 'Sales',
                'description' => 'How many leads sit at each stage, and what they are worth together.',
                'date_column' => 'l.created_at',
                'columns'     => [
                    self::col('status', 'Stage', 'badge'),
                    self::col('leads', 'Leads', 'number'),
                    self::col('quoted_total', 'Quoted total', 'money'),
                    self::col('hot', 'Hot', 'number'),
                    self::col('warm', 'Warm', 'number'),
                    self::col('cold', 'Cold', 'number'),
                ],
                'sql' => "SELECT l.status,
                                 COUNT(*) AS leads,
                                 COALESCE(SUM(l.quoted_amount), 0) AS quoted_total,
                                 SUM(l.temperature = 'hot')  AS hot,
                                 SUM(l.temperature = 'warm') AS warm,
                                 SUM(l.temperature = 'cold') AS cold
                            FROM sales_leads l
                           WHERE l.tenant_id = ?",
                'group' => 'l.status',
                'order' => 'leads DESC',
            ],

            'call-activity' => [
                'title'       => 'Call activity',
                'category'    => 'Sales',
                'description' => 'Every logged call: who made it, to whom, how long and how it ended.',
                'date_column' => 'c.call_date',
                'columns'     => [
                    self::col('call_date', 'Date', 'date'),
                    self::col('call_time', 'Time'),
                    self::col('subject', 'Lead / client'),
                    self::col('subject_type', 'Kind', 'badge'),
                    self::col('called_by_name', 'Called by'),
                    self::col('outcome', 'Outcome', 'badge'),
                    self::col('duration_minutes', 'Minutes', 'number'),
                    self::col('notes', 'Notes'),
                ],
                'sql' => "SELECT c.call_date, c.call_time,
                                 COALESCE(NULLIF(oc.name, ''), NULLIF(l.company, ''), l.name, '') AS subject,
                                 IF(c.client_id IS NOT NULL, 'client', 'lead') AS subject_type,
                                 c.called_by_name, c.outcome, c.duration_minutes, c.notes
                            FROM sales_calls c
                            LEFT JOIN sales_leads l  ON l.id  = c.lead_id   AND l.tenant_id  = c.tenant_id
                            LEFT JOIN ops_clients oc ON oc.id = c.client_id AND oc.tenant_id = c.tenant_id
                           WHERE c.tenant_id = ?",
                'order' => 'c.call_date DESC, c.id DESC',
            ],

            'caller-performance' => [
                'title'       => 'Calls by person',
                'category'    => 'Sales',
                'description' => 'Calls made, minutes spent and how many landed as interested, per caller.',
                'date_column' => 'c.call_date',
                'columns'     => [
                    self::col('called_by_name', 'Caller'),
                    self::col('calls', 'Calls', 'number'),
                    self::col('total_minutes', 'Minutes', 'number'),
                    self::col('interested', 'Interested', 'number'),
                    self::col('no_response', 'No response', 'number'),
                    self::col('first_call', 'First call', 'date'),
                    self::col('last_call', 'Last call', 'date'),
                ],
                'sql' => "SELECT NULLIF(c.called_by_name, '') AS called_by_name,
                                 COUNT(*) AS calls,
                                 COALESCE(SUM(c.duration_minutes), 0) AS total_minutes,
                                 SUM(c.outcome = 'interested')  AS interested,
                                 SUM(c.outcome = 'no_response') AS no_response,
                                 MIN(c.call_date) AS first_call,
                                 MAX(c.call_date) AS last_call
                            FROM sales_calls c
                           WHERE c.tenant_id = ?",
                'group' => 'c.called_by_name',
                'order' => 'calls DESC',
            ],

            'followup-compliance' => [
                'title'       => 'Follow-up compliance',
                'category'    => 'Sales',
                'description' => 'Promised follow-ups against kept ones, and what is overdue right now.',
                'date_column' => 'f.due_date',
                'columns'     => [
                    self::col('owner_name', 'Owner'),
                    self::col('total', 'Total', 'number'),
                    self::col('completed', 'Completed', 'number'),
                    self::col('pending', 'Pending', 'number'),
                    self::col('overdue', 'Overdue now', 'number'),
                ],
                'sql' => "SELECT COALESCE(u.name, 'Unassigned') AS owner_name,
                                 COUNT(*) AS total,
                                 SUM(f.status = 'completed') AS completed,
                                 SUM(f.status = 'pending')   AS pending,
                                 SUM(f.status = 'pending' AND f.due_date < CURDATE()) AS overdue
                            FROM sales_followups f
                            LEFT JOIN users u ON u.user_id = f.assigned_to
                           WHERE f.tenant_id = ?",
                'group' => 'u.name',
                'order' => 'overdue DESC, total DESC',
            ],

            'followup-register' => [
                'title'       => 'Follow-up register',
                'category'    => 'Sales',
                'description' => 'Every follow-up with what it was for, who owns it and how it closed.',
                'date_column' => 'f.due_date',
                'columns'     => [
                    self::col('due_date', 'Due', 'date'),
                    self::col('due_time', 'Time'),
                    self::col('subject', 'Lead / client'),
                    self::col('subject_type', 'Kind', 'badge'),
                    self::col('owner_name', 'Owner'),
                    self::col('status', 'Status', 'badge'),
                    self::col('purpose', 'Purpose'),
                    self::col('outcome', 'Outcome', 'badge'),
                    self::col('completed_at', 'Completed', 'datetime'),
                ],
                'sql' => "SELECT f.due_date, f.due_time,
                                 COALESCE(NULLIF(oc.name, ''), NULLIF(l.company, ''), l.name, '') AS subject,
                                 IF(f.client_id IS NOT NULL, 'client', 'lead') AS subject_type,
                                 COALESCE(u.name, 'Unassigned') AS owner_name,
                                 f.status, f.purpose, f.outcome, f.completed_at
                            FROM sales_followups f
                            LEFT JOIN sales_leads l  ON l.id  = f.lead_id   AND l.tenant_id  = f.tenant_id
                            LEFT JOIN ops_clients oc ON oc.id = f.client_id AND oc.tenant_id = f.tenant_id
                            LEFT JOIN users u ON u.user_id = f.assigned_to
                           WHERE f.tenant_id = ?",
                'order' => 'f.due_date DESC, f.id DESC',
            ],

            // ── Clients & projects ──────────────────────────────────────────
            'client-register' => [
                'title'       => 'Client register',
                'category'    => 'Clients & Projects',
                'description' => 'Every client, the stage they are at, who owns them and what they are worth.',
                'date_column' => 'c.created_at',
                'columns'     => [
                    self::col('name', 'Client'),
                    self::col('phone', 'Phone'),
                    self::col('email', 'Email'),
                    self::col('stage', 'Stage', 'badge'),
                    self::col('health', 'Health', 'badge'),
                    self::col('owner', 'Owner'),
                    self::col('projects', 'Projects', 'number'),
                    self::col('quoted', 'Quoted', 'money'),
                    self::col('received', 'Received', 'money'),
                    self::col('balance', 'Balance', 'money'),
                    self::col('source', 'Source'),
                    self::col('created_at', 'Client since', 'date'),
                ],
                'sql' => "SELECT c.name, c.phone, c.email, c.stage, c.health, c.owner,
                                 COUNT(p.id) AS projects,
                                 COALESCE(SUM(p.quoted), 0)   AS quoted,
                                 COALESCE(SUM(p.received), 0) AS received,
                                 COALESCE(SUM(p.balance), 0)  AS balance,
                                 c.source, c.created_at
                            FROM ops_clients c
                            LEFT JOIN ops_projects p ON p.client_id = c.id AND p.tenant_id = c.tenant_id
                           WHERE c.tenant_id = ?",
                'group' => 'c.id',
                'order' => 'c.created_at DESC',
            ],

            'project-status' => [
                'title'       => 'Project status',
                'category'    => 'Clients & Projects',
                'description' => 'Where every project stands: stage, health, deadline and money outstanding.',
                'date_column' => 'p.created_at',
                'columns'     => [
                    self::col('project', 'Project'),
                    self::col('client', 'Client'),
                    self::col('stage', 'Stage', 'badge'),
                    self::col('health', 'Health', 'badge'),
                    self::col('priority', 'Priority', 'badge'),
                    self::col('owner', 'Owner'),
                    self::col('quoted', 'Quoted', 'money'),
                    self::col('received', 'Received', 'money'),
                    self::col('balance', 'Balance', 'money'),
                    self::col('payment_status', 'Payment', 'badge'),
                    self::col('deadline', 'Deadline', 'date'),
                ],
                'sql' => "SELECT p.name AS project, c.name AS client, p.stage, p.health, p.priority,
                                 p.owner, p.quoted, p.received, p.balance, p.payment_status, p.deadline
                            FROM ops_projects p
                            LEFT JOIN ops_clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
                           WHERE p.tenant_id = ?",
                'order' => 'p.deadline IS NULL, p.deadline ASC, p.id DESC',
            ],

            // ── Finance ─────────────────────────────────────────────────────
            'payments-received' => [
                'title'       => 'Payments received',
                'category'    => 'Finance',
                'description' => 'Money actually collected, against the client and project it came in for.',
                'date_column' => 'pay.payment_date',
                'columns'     => [
                    self::col('payment_date', 'Date', 'date'),
                    self::col('client', 'Client'),
                    self::col('project', 'Project'),
                    self::col('amount', 'Amount', 'money'),
                    self::col('type', 'Type', 'badge'),
                    self::col('mode', 'Mode', 'badge'),
                    self::col('reference', 'Reference'),
                    self::col('recorded_by', 'Recorded by'),
                ],
                'sql' => "SELECT pay.payment_date, c.name AS client, p.name AS project,
                                 pay.amount, pay.type, pay.mode, pay.reference, pay.recorded_by
                            FROM ops_payments pay
                            LEFT JOIN ops_clients c  ON c.id = pay.client_id  AND c.tenant_id = pay.tenant_id
                            LEFT JOIN ops_projects p ON p.id = pay.project_id AND p.tenant_id = pay.tenant_id
                           WHERE pay.tenant_id = ?",
                'order' => 'pay.payment_date DESC, pay.id DESC',
            ],

            'outstanding-balances' => [
                'title'       => 'Outstanding balances',
                'category'    => 'Finance',
                'description' => 'What is still owed, oldest first, with who to chase it from.',
                'date_column' => null,
                'columns'     => [
                    self::col('client', 'Client'),
                    self::col('project', 'Project'),
                    self::col('owner', 'Owner'),
                    self::col('quoted', 'Quoted', 'money'),
                    self::col('received', 'Received', 'money'),
                    self::col('balance', 'Outstanding', 'money'),
                    self::col('payment_status', 'Status', 'badge'),
                    self::col('phone', 'Phone'),
                ],
                'sql' => "SELECT c.name AS client, p.name AS project, p.owner,
                                 p.quoted, p.received, p.balance, p.payment_status, c.phone
                            FROM ops_projects p
                            LEFT JOIN ops_clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
                           WHERE p.tenant_id = ? AND p.balance > 0",
                'order' => 'p.balance DESC',
            ],

            'amc-renewals' => [
                'title'       => 'AMC renewals',
                'category'    => 'Finance',
                'description' => 'Maintenance contracts by renewal date, so none of them lapse unnoticed.',
                'date_column' => 'a.renewal_date',
                'columns'     => [
                    self::col('renewal_date', 'Renews', 'date'),
                    self::col('client', 'Client'),
                    self::col('project', 'Project'),
                    self::col('amount', 'Amount', 'money'),
                    self::col('status', 'Status', 'badge'),
                    self::col('start_date', 'Started', 'date'),
                    self::col('payment_mode', 'Mode'),
                ],
                'sql' => "SELECT a.renewal_date, c.name AS client, p.name AS project,
                                 a.amount, a.status, a.start_date, a.payment_mode
                            FROM ops_amc_records a
                            LEFT JOIN ops_clients c  ON c.id = a.client_id  AND c.tenant_id = a.tenant_id
                            LEFT JOIN ops_projects p ON p.id = a.project_id AND p.tenant_id = a.tenant_id
                           WHERE a.tenant_id = ?",
                'order' => 'a.renewal_date IS NULL, a.renewal_date ASC',
            ],

            // ── Delivery ────────────────────────────────────────────────────
            'meeting-log' => [
                'title'       => 'Meeting log',
                'category'    => 'Delivery',
                'description' => 'Meetings held, what came out of them and what was promised next.',
                'date_column' => 'm.date',
                'columns'     => [
                    self::col('date', 'Date', 'date'),
                    self::col('client', 'Client'),
                    self::col('project', 'Project'),
                    self::col('type', 'Type', 'badge'),
                    self::col('attendees', 'Attendees'),
                    self::col('outcome', 'Outcome'),
                    self::col('next_action', 'Next action'),
                    self::col('next_followup', 'Next follow-up', 'date'),
                    self::col('booked_by', 'Booked by'),
                ],
                'sql' => "SELECT m.date, c.name AS client, p.name AS project, m.type,
                                 m.attendees, m.outcome, m.next_action, m.next_followup, m.booked_by
                            FROM ops_meetings m
                            LEFT JOIN ops_clients c  ON c.id = m.client_id  AND c.tenant_id = m.tenant_id
                            LEFT JOIN ops_projects p ON p.id = m.project_id AND p.tenant_id = m.tenant_id
                           WHERE m.tenant_id = ?",
                'order' => 'm.date DESC, m.id DESC',
            ],

            'bug-register' => [
                'title'       => 'Bug register',
                'category'    => 'Delivery',
                'description' => 'Reported bugs and change requests by priority, with how long each has been open.',
                'date_column' => 'b.created_at',
                'columns'     => [
                    self::col('description', 'Issue'),
                    self::col('project', 'Project'),
                    self::col('module', 'Module'),
                    self::col('type', 'Type', 'badge'),
                    self::col('priority', 'Priority', 'badge'),
                    self::col('status', 'Status', 'badge'),
                    self::col('reported_by', 'Reported by'),
                    self::col('developer', 'Developer'),
                    self::col('target_date', 'Target', 'date'),
                    self::col('created_at', 'Reported', 'date'),
                    self::col('days_open', 'Days open', 'number'),
                ],
                'sql' => "SELECT b.description, p.name AS project, b.module, b.type, b.priority,
                                 b.status, b.reported_by, u.name AS developer, b.target_date,
                                 b.created_at, DATEDIFF(CURDATE(), DATE(b.created_at)) AS days_open
                            FROM ops_bugs b
                            LEFT JOIN ops_projects p ON p.id = b.project_id AND p.tenant_id = b.tenant_id
                            LEFT JOIN users u ON u.user_id = b.developer_id
                           WHERE b.tenant_id = ?",
                'order' => 'b.created_at DESC',
            ],
        ];
    }

    /** One definition, or null when the id is not a report this system has. */
    public static function find(string $id): ?array
    {
        $all = self::all();
        return $all[$id] ?? null;
    }

    /** The catalogue the Reports page lists, without the SQL. */
    public static function catalogue(): array
    {
        $out = [];
        foreach (self::all() as $id => $def) {
            $out[] = [
                'id'          => $id,
                'title'       => $def['title'],
                'category'    => $def['category'],
                'description' => $def['description'],
                'columns'     => $def['columns'],
                'has_dates'   => !empty($def['date_column']),
            ];
        }
        return $out;
    }
}
