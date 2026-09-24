<?php
declare(strict_types=1);
/**
 * One-off (2026-09-24): remove the CRM clients that were only ever sales leads,
 * together with their projects — the same removal as the Delete button on the
 * Clients page (api/services/OpsRecordRemoval.php). A sales lead converted into
 * one of them goes back to being a lead.
 *
 *   php database/legacy/remove_lead_clients.php         preview: lists what matches, deletes nothing
 *   php database/legacy/remove_lead_clients.php --yes   deletes what the preview listed
 *
 * Names match exactly (ignoring case and surrounding spaces). A name that
 * matches nothing is reported and skipped.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const LEAD_CLIENTS = [
    'Krish agency vendor',
    'Gokul Tours',
    'GE',
    'BrickMe Constructions',
    'Krish Agencies',
    'VaramBlessing',
    'Data Corp',
];

define('ROOT_PATH', dirname(__DIR__, 2) . '/api');
require_once ROOT_PATH . '/config/app.php';
require_once ROOT_PATH . '/core/Response.php';
require_once ROOT_PATH . '/config/database.php';
require_once ROOT_PATH . '/config/tenancy.php';
require_once ROOT_PATH . '/core/AppException.php';
require_once ROOT_PATH . '/core/Database.php';
require_once ROOT_PATH . '/services/OpsRecordRemoval.php';

$apply    = in_array('--yes', array_slice($argv, 1), true);
$tenantId = defined('FOUNDING_TENANT_ID') ? (int)FOUNDING_TENANT_ID : 1;

$matches = [];
foreach (LEAD_CLIENTS as $name) {
    $rows = Database::fetchAll(
        "SELECT c.id, c.name, c.client_code,
                (SELECT COUNT(*) FROM ops_projects p WHERE p.client_id = c.id AND p.tenant_id = c.tenant_id) AS projects,
                (SELECT COALESCE(SUM(amount), 0) FROM ops_payments y WHERE y.client_id = c.id AND y.tenant_id = c.tenant_id) AS paid
           FROM ops_clients c
          WHERE c.tenant_id = ? AND LOWER(TRIM(c.name)) = LOWER(TRIM(?))",
        [$tenantId, $name]
    );
    if (!$rows) {
        fwrite(STDOUT, "  not found: $name\n");
        continue;
    }
    foreach ($rows as $r) {
        $matches[] = $r;
        fwrite(STDOUT, sprintf(
            "  %-10s %-28s projects: %d  payments: Rs %s\n",
            $r['client_code'] ?? '#' . $r['id'], $r['name'], (int)$r['projects'], number_format((float)$r['paid'])
        ));
    }
}

if (!$matches) {
    fwrite(STDOUT, "Nothing to remove.\n");
    exit(0);
}
if (!$apply) {
    fwrite(STDOUT, "\nPreview only. Re-run with --yes to delete these " . count($matches) . " client(s) and their projects.\n");
    exit(0);
}

foreach ($matches as $r) {
    $done = OpsRecordRemoval::deleteClient($tenantId, (int)$r['id']);
    fwrite(STDOUT, "  deleted {$done['client']} ({$done['projects']} project(s), {$done['payments']} payment(s))\n");
}
fwrite(STDOUT, "Done.\n");
