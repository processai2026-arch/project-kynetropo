<?php
declare(strict_types=1);

/**
 * Sales Calls Controller — "Log Call" is the highest-frequency sales action,
 * so a single POST records the call, optionally updates the lead temperature
 * and optionally schedules the next follow-up (spec §9/§12).
 *
 *   GET  /admin/sales/calls        — call history (record-scoped)
 *   POST /admin/sales/calls        — log a call
 *   GET  /admin/sales/calls/meta   — outcome options for the form
 */
class AdminSalesCallController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.calls.view');

        $result = SalesCall::all([
            'lead_id'   => $request->query('lead_id'),
            'outcome'   => $request->query('outcome'),
            'date_from' => $request->query('date_from'),
            'date_to'   => $request->query('date_to'),
        ], SalesPermissions::leadScope($request->user), (int)$request->query('page', 1), (int)$request->query('limit', 100));

        Response::paginated($result['rows'], $result['pagination']);
    }

    public function meta(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.calls.view');
        Response::success([
            'outcomes'     => SalesCall::OUTCOMES,
            'temperatures' => SalesLead::TEMPERATURES,
        ]);
    }

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.calls.create');

        $leadId = (int)$request->input('lead_id');
        $lead   = SalesLead::findRaw($leadId);
        if (!$lead) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $lead);

        $outcome = strtolower(trim((string)$request->input('outcome', '')));
        if (!in_array($outcome, SalesCall::OUTCOMES, true)) {
            Response::error('Invalid call outcome. Allowed: ' . implode(', ', SalesCall::OUTCOMES), 422);
        }

        $callDate = (string)$request->input('call_date', date('Y-m-d'));
        if (!$this->isValidDate($callDate)) {
            Response::error('Invalid call date', 422);
        }

        $callTime = $request->input('call_time');
        if ($callTime !== null && $callTime !== '' && !$this->isValidTime((string)$callTime)) {
            Response::error('Invalid call time', 422);
        }

        $duration = (int)$request->input('duration_minutes', 0);
        if ($duration < 0 || $duration > 1440) {
            Response::error('Call duration must be between 0 and 1440 minutes', 422);
        }

        $temperatureAfter = $request->input('temperature_after');
        if ($temperatureAfter !== null && $temperatureAfter !== '' && !in_array($temperatureAfter, SalesLead::TEMPERATURES, true)) {
            Response::error('Invalid temperature', 422);
        }

        $nextDate = $request->input('next_followup_date');
        $nextTime = $request->input('next_followup_time');
        if (!empty($nextDate)) {
            if (!$this->isValidDate((string)$nextDate)) {
                Response::error('Invalid next follow-up date', 422);
            }
            if ($nextDate < date('Y-m-d')) {
                Response::error('The next follow-up date cannot be in the past', 422);
            }
            if (!empty($nextTime) && !$this->isValidTime((string)$nextTime)) {
                Response::error('Invalid next follow-up time', 422);
            }
        }

        $callId = SalesCall::create([
            'lead_id'           => $leadId,
            'call_date'         => $callDate,
            'call_time'         => $callTime ?: null,
            'duration_minutes'  => $duration,
            'outcome'           => $outcome,
            'notes'             => $request->input('notes'),
            'temperature_after' => $temperatureAfter ?: null,
        ], $request->user ?? []);

        SalesActivity::log(
            $leadId, 'call_logged',
            'Call logged — ' . str_replace('_', ' ', $outcome),
            $request->user,
            trim($duration . ' minutes. ' . (string)$request->input('notes', '')),
            'call',
            $callId,
            ['outcome' => $outcome, 'duration_minutes' => $duration]
        );

        // Optional temperature update captured during the call.
        if ($temperatureAfter && $temperatureAfter !== $lead['temperature']) {
            SalesLead::update($leadId, ['temperature' => $temperatureAfter]);
            SalesActivity::log(
                $leadId, 'temperature_changed',
                'Temperature changed to ' . strtoupper((string)$temperatureAfter),
                $request->user,
                'Updated while logging a call'
            );
        }

        // Optional next follow-up created straight from the call.
        $followupId = null;
        if (!empty($nextDate)) {
            $followupId = SalesFollowup::create([
                'lead_id'     => $leadId,
                'call_id'     => $callId,
                'due_date'    => $nextDate,
                'due_time'    => $nextTime ?: null,
                'assigned_to' => $lead['assigned_to'] ?? ($request->user['user_id'] ?? null),
                'purpose'     => (string)$request->input('next_followup_purpose', 'Follow-up from call'),
            ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

            SalesCall::linkFollowup($callId, $followupId);
            SalesActivity::log(
                $leadId, 'followup_created',
                'Follow-up scheduled for ' . $nextDate . ($nextTime ? ' ' . $nextTime : ''),
                $request->user, '', 'followup', $followupId
            );
        }

        // A logged call always advances a brand-new lead to "contacted".
        if ($lead['status'] === 'new') {
            SalesLead::update($leadId, ['status' => 'contacted']);
        }

        SalesLead::touchActivity($leadId, $outcome);
        SalesLead::refreshSchedule($leadId);

        Response::success([
            'call'        => SalesCall::forLead($leadId)[0] ?? null,
            'followup_id' => $followupId,
            'lead'        => SalesLead::find($leadId),
        ], 'Call logged', 201);
    }

    private function isValidDate(string $value): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $value);
        return $d !== false && $d->format('Y-m-d') === $value;
    }

    private function isValidTime(string $value): bool
    {
        return (bool)preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $value);
    }
}
