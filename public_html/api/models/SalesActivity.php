<?php
declare(strict_types=1);

/**
 * SalesActivity — the chronological sales history for a lead (spec §15/§48).
 *
 * Every meaningful event (lead created/assigned, call logged, follow-up
 * created/completed, temperature changed, meeting scheduled/completed,
 * conversion) writes one row here. Nothing is ever deleted, so the timeline
 * survives conversion and remains the single sales-history view for a lead.
 */
class SalesActivity
{
    public const TYPES = [
        'lead_created',
        'lead_updated',
        'lead_assigned',
        'call_logged',
        'followup_created',
        'followup_updated',
        'followup_completed',
        'temperature_changed',
        'meeting_scheduled',
        'meeting_updated',
        'meeting_completed',
        'lead_onboarding',
        'lead_converted',
        'comment_added',
    ];

    public static function log(
        int $leadId,
        string $type,
        string $title,
        ?array $actor = null,
        string $description = '',
        string $referenceType = '',
        ?int $referenceId = null,
        ?array $metadata = null
    ): int {
        return Database::insert('sales_lead_activities', [
            'tenant_id'      => Database::tenantId(),
            'lead_id'        => $leadId,
            'activity_type'  => $type,
            'title'          => mb_substr($title, 0, 200),
            'description'    => $description !== '' ? $description : null,
            'reference_type' => $referenceType,
            'reference_id'   => $referenceId,
            'metadata'       => $metadata !== null ? json_encode($metadata, JSON_UNESCAPED_UNICODE) : null,
            'actor_id'       => isset($actor['user_id']) ? (int)$actor['user_id'] : null,
            'actor_name'     => (string)($actor['name'] ?? ''),
            'occurred_at'    => date('Y-m-d H:i:s'),
        ]);
    }

    /** Full timeline for one lead, newest first. */
    public static function forLead(int $leadId): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM sales_lead_activities
              WHERE tenant_id = ? AND lead_id = ?
              ORDER BY occurred_at DESC, id DESC',
            [Database::tenantId(), $leadId]
        );
        return array_map([self::class, 'format'], $rows);
    }

    /**
     * Recent activity across leads, optionally restricted to the leads a user
     * may see (record-level scoping is applied by the caller via $leadScope).
     */
    public static function recent(int $limit = 50, array $leadScope = ['sql' => '', 'params' => []]): array
    {
        $limit = max(1, min(200, $limit));
        $rows  = Database::fetchAll(
            'SELECT a.*, l.name AS lead_name, l.company AS lead_company
               FROM sales_lead_activities a
               JOIN sales_leads l ON l.id = a.lead_id AND l.tenant_id = a.tenant_id
              WHERE a.tenant_id = ?' . str_replace('assigned_to', 'l.assigned_to', $leadScope['sql']) . '
              ORDER BY a.occurred_at DESC, a.id DESC
              LIMIT ' . $limit,
            [Database::tenantId(), ...$leadScope['params']]
        );
        return array_map([self::class, 'format'], $rows);
    }

    public static function format(array $row): array
    {
        return [
            'id'             => (int)$row['id'],
            'lead_id'        => (int)$row['lead_id'],
            'lead_name'      => $row['lead_name']    ?? null,
            'lead_company'   => $row['lead_company'] ?? null,
            'activity_type'  => $row['activity_type'],
            'title'          => $row['title'],
            'description'    => $row['description'],
            'reference_type' => $row['reference_type'],
            'reference_id'   => $row['reference_id'] !== null ? (int)$row['reference_id'] : null,
            'metadata'       => $row['metadata'] ? json_decode((string)$row['metadata'], true) : null,
            'actor_id'       => $row['actor_id'] !== null ? (int)$row['actor_id'] : null,
            'actor_name'     => $row['actor_name'],
            'occurred_at'    => $row['occurred_at'],
        ];
    }
}
